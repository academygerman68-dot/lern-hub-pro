/**
 * Honest content status for B1 questions loaded by the common runner.
 * Never counts placeholders or heavily glued OCR as ready.
 */
import {
  isPlaceholderPrompt,
  looksHeavilyGlued,
  isStudentSafeQuestion,
} from "@/lib/b1-student-content";
import type { Json } from "@/types/database";

export type B1ContentStatus = "ready" | "needs_review" | "blocked";

export type B1ContentStatusInput = {
  id?: string;
  prompt?: string | null;
  type?: string | null;
  skill?: string | null;
  sort_order?: number | null;
  media_path?: string | null;
  media_bucket?: string | null;
  metadata?: Record<string, unknown> | Json | null;
  options?: Array<{ label?: string | null; value?: string | null }> | null;
  correct_values?: string[] | null;
  answer_key?: { correct_values?: string[] | null } | Array<{ correct_values?: string[] | null }> | null;
};

export type B1ContentStatusResult = {
  status: B1ContentStatus;
  reasons: string[];
  teil: number | null;
  pedagogicalNumber: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function questionTeilFromMeta(metadata: unknown): number | null {
  const meta = asRecord(metadata);
  const n = Number(meta["audio_slot"] ?? meta["teil"] ?? meta["part"]);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

function keyValues(input: B1ContentStatusInput): string[] {
  if (Array.isArray(input.correct_values) && input.correct_values.length) {
    return input.correct_values.map(String);
  }
  const rawKey = input.answer_key;
  // PostgREST may return a one-to-many embed as an array — never throw on .correct_values.
  const keyObj = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  const fromKey =
    keyObj && typeof keyObj === "object" && !Array.isArray(keyObj)
      ? (keyObj as { correct_values?: string[] | null }).correct_values
      : null;
  if (Array.isArray(fromKey) && fromKey.length) return fromKey.map(String);
  return [];
}

function needsObjectiveKey(type: string, skill: string): boolean {
  if (skill !== "lesen" && skill !== "hoeren") return false;
  return (
    type === "single_choice" ||
    type === "true_false" ||
    type === "matching" ||
    type === "listening" ||
    type === "multiple_choice"
  );
}

function keyCompatible(opts: Array<{ label?: string | null; value?: string | null }>, keys: string[]) {
  if (!keys.length) return false;
  if (!opts.length) return false;
  return keys.every((k) => opts.some((o) => o.value === k || o.label === k));
}

/**
 * Classify one question for admin audit / publish gates.
 * Student safety uses isStudentSafeQuestion; blocked ≠ silently dropped.
 */
export function classifyB1QuestionContent(input: B1ContentStatusInput): B1ContentStatusResult {
  const meta = asRecord(input.metadata);
  const prompt = String(input.prompt ?? "");
  const type = String(input.type ?? "");
  const skill = String(input.skill ?? "");
  const teil = questionTeilFromMeta(meta);
  const pedagogicalNumber =
    typeof meta["expected_number"] === "number"
      ? meta["expected_number"]
      : Number.isFinite(Number(input.sort_order))
        ? Number(input.sort_order)
        : null;
  const reasons: string[] = [];
  const opts = Array.isArray(input.options) ? input.options : [];
  const keys = keyValues(input);

  if (isPlaceholderPrompt(prompt, meta) || meta["transform_status"] === "placeholder") {
    reasons.push("placeholder_ocr");
  }
  if (!prompt.trim()) {
    reasons.push("empty_prompt");
  }
  if (needsObjectiveKey(type, skill)) {
    if (opts.length === 0) reasons.push("empty_options");
    if (!keys.length) reasons.push("missing_key");
    else if (opts.length > 0 && !keyCompatible(opts, keys)) reasons.push("incompatible_key");
  }
  if (skill === "hoeren" || type === "listening") {
    const path = input.media_path?.trim();
    const bucket = input.media_bucket?.trim();
    const url = typeof meta["audio_url"] === "string" ? meta["audio_url"].trim() : "";
    if (!(path && bucket) && !url) reasons.push("missing_audio");
  }

  if (reasons.some((r) => r === "placeholder_ocr" || r === "empty_prompt" || r === "empty_options" || r === "missing_key" || r === "incompatible_key" || r === "missing_audio")) {
    return { status: "blocked", reasons, teil, pedagogicalNumber };
  }

  if (looksHeavilyGlued(prompt)) {
    reasons.push("glued_ocr");
  }
  if (meta["needs_review"] === true || meta["transcription_status"] === "ocr_unverified") {
    reasons.push("transcription_unverified");
  }
  if (meta["points_rubric"] === "provisional_needs_review") {
    reasons.push("provisional_rubric");
  }
  if ((skill === "hoeren" || type === "listening") && meta["audio_verification_status"] !== "content_verified") {
    reasons.push("audio_unverified");
  }
  if (!isStudentSafeQuestion({ prompt, metadata: meta })) {
    if (!reasons.includes("glued_ocr")) reasons.push("not_student_safe");
  }

  if (reasons.length > 0) {
    return { status: "needs_review", reasons, teil, pedagogicalNumber };
  }
  return { status: "ready", reasons: [], teil, pedagogicalNumber };
}

export type B1ExamContentAudit = {
  examCode: string;
  status: string;
  totals: { ready: number; needs_review: number; blocked: number; questions: number };
  bySkillTeil: Record<
    string,
    { ready: number; needs_review: number; blocked: number; questions: number }
  >;
  blockedItems: Array<{
    skill: string;
    teil: number | null;
    sortOrder: number | null;
    questionId: string;
    reasons: string[];
    promptPreview: string;
  }>;
  audio: {
    slotsReady: number;
    slotsVerified: number;
    paths: Array<{ slot: number; path: string | null }>;
  };
};

export function auditB1ExamContent(input: {
  code?: string | null;
  status?: string | null;
  sections?: Array<{
    skill?: string | null;
    questions?: B1ContentStatusInput[] | null;
  }> | null;
}): B1ExamContentAudit {
  const examCode = (input.code ?? "").trim() || "—";
  const totals = { ready: 0, needs_review: 0, blocked: 0, questions: 0 };
  const bySkillTeil: B1ExamContentAudit["bySkillTeil"] = {};
  const blockedItems: B1ExamContentAudit["blockedItems"] = [];
  const audioPaths = new Map<number, string | null>();
  let slotsVerified = 0;

  for (const section of input.sections ?? []) {
    const skill = String(section.skill ?? "other");
    for (const q of section.questions ?? []) {
      const classified = classifyB1QuestionContent({ ...q, skill });
      totals.questions += 1;
      totals[classified.status] += 1;
      const key = `${skill}:teil-${classified.teil ?? "?"}`;
      const bucket = bySkillTeil[key] ?? {
        ready: 0,
        needs_review: 0,
        blocked: 0,
        questions: 0,
      };
      bucket.questions += 1;
      bucket[classified.status] += 1;
      bySkillTeil[key] = bucket;

      if (classified.status === "blocked") {
        blockedItems.push({
          skill,
          teil: classified.teil,
          sortOrder: Number(q.sort_order ?? classified.pedagogicalNumber ?? 0) || null,
          questionId: String(q.id ?? ""),
          reasons: classified.reasons,
          promptPreview: String(q.prompt ?? "").slice(0, 120),
        });
      }

      if (skill === "hoeren") {
        const teil = classified.teil;
        if (teil != null && teil >= 1 && teil <= 4) {
          const path = q.media_path?.trim() || null;
          if (!audioPaths.has(teil)) audioPaths.set(teil, path);
          const meta = asRecord(q.metadata);
          if (meta["audio_verification_status"] === "content_verified") {
            /* counted below once per slot */
          }
        }
      }
    }
  }

  for (const slot of [1, 2, 3, 4]) {
    const sectionQs = (input.sections ?? [])
      .filter((s) => s.skill === "hoeren")
      .flatMap((s) => s.questions ?? []);
    const inSlot = sectionQs.filter((q) => questionTeilFromMeta(q.metadata) === slot);
    const verified = inSlot.some(
      (q) => asRecord(q.metadata)["audio_verification_status"] === "content_verified",
    );
    if (verified) slotsVerified += 1;
    if (!audioPaths.has(slot)) {
      const path = inSlot.find((q) => q.media_path?.trim())?.media_path?.trim() ?? null;
      audioPaths.set(slot, path);
    }
  }

  const slotsReady = [1, 2, 3, 4].filter((s) => Boolean(audioPaths.get(s))).length;

  return {
    examCode,
    status: (input.status ?? "draft").trim() || "draft",
    totals,
    bySkillTeil,
    blockedItems,
    audio: {
      slotsReady,
      slotsVerified,
      paths: [1, 2, 3, 4].map((slot) => ({ slot, path: audioPaths.get(slot) ?? null })),
    },
  };
}
