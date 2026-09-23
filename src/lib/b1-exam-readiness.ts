/**
 * Browser-safe B1 exam readiness scoring (no node:fs).
 * Used by the director B1 OCR bank panel.
 *
 * Progress never treats as complete:
 * - unverified Hören audio (missing content_verified)
 * - OCR placeholders
 * - missing / incompatible answer keys
 * - provisional scoring (points_rubric)
 */

import type { Json } from "@/types/database";
import {
  questionHasAudio,
  questionNeedsHorenAudio,
  validateExamCompleteness,
  type ExamCompletenessQuestion,
} from "@/lib/exam-completeness";

export type B1ReadinessQuestion = {
  id?: string;
  prompt?: string | null;
  type?: string | null;
  points?: number | null;
  sort_order?: number | null;
  media_path?: string | null;
  media_bucket?: string | null;
  metadata?: Record<string, unknown> | Json | null;
  correct_values?: string[] | null;
  teacher_payload?: Record<string, unknown> | Json | null;
  options?: Array<{ label?: string | null; value?: string | null }> | null;
  answer_key?: {
    correct_values?: string[] | null;
    teacher_payload?: Json | null;
  } | null;
};

export type B1ReadinessSection = {
  skill?: string | null;
  title?: string | null;
  questions?: B1ReadinessQuestion[] | null;
};

export type B1ReadinessExamInput = {
  code?: string | null;
  status?: string | null;
  sections?: B1ReadinessSection[] | null;
};

export type B1ExamReadiness = {
  examCode: string;
  status: string;
  questionCount: number;
  pagesNeedingReview: number;
  placeholderCount: number;
  missingKeysCount: number;
  audioReady: number;
  audioTotal: number;
  /** Distinct Hören audio slots with content_verified (out of 4). */
  audioVerified: number;
  audioSlotsTotal: number;
  schreibenTasks: number;
  sprechenTasks: number;
  confirmedAnswerKeys: number;
  scoringStatus: "provisional_needs_review" | "official" | "mixed_or_unknown";
  blockers: string[];
  readyForPublish: boolean;
  progress: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function flattenQuestions(exam: B1ReadinessExamInput): ExamCompletenessQuestion[] {
  const out: ExamCompletenessQuestion[] = [];
  for (const section of exam.sections ?? []) {
    const skill = section.skill ?? "";
    const sectionTitle = section.title ?? (skill || "Section");
    for (const q of section.questions ?? []) {
      const meta = asRecord(q.metadata);
      out.push({
        id: q.id ?? "",
        prompt: q.prompt ?? "",
        type: q.type ?? "text",
        points: Number(q.points ?? 0),
        media_path: q.media_path ?? null,
        media_bucket: q.media_bucket ?? null,
        metadata: meta,
        skill,
        sectionTitle,
        correct_values: q.correct_values ?? q.answer_key?.correct_values ?? null,
        teacher_payload:
          asRecord(q.teacher_payload) ?? asRecord(q.answer_key?.teacher_payload) ?? null,
        options: q.options ?? null,
      });
    }
  }
  return out;
}

function isPlaceholderQuestion(q: ExamCompletenessQuestion): boolean {
  const meta = asRecord(q.metadata);
  if (meta?.["transform_status"] === "placeholder") return true;
  return /OCR (in)?compl[eè]te|placeholder|Frage \d+ —/i.test(q.prompt || "");
}

function optionMatches(
  options: ExamCompletenessQuestion["options"],
  token: string,
): boolean {
  const want = token.toLowerCase();
  return (options ?? []).some(
    (o) =>
      String(o.value ?? "").toLowerCase() === want ||
      String(o.label ?? "").toLowerCase() === want,
  );
}

function questionHasCompatibleKey(q: ExamCompletenessQuestion): boolean {
  const cv = q.correct_values?.[0];
  if (!cv) return false;
  const opts = q.options ?? [];
  if (opts.length === 0) return true;
  return optionMatches(opts, cv);
}

function countAnswerKeys(questions: ExamCompletenessQuestion[]): number {
  let n = 0;
  for (const q of questions) {
    if (q.skill !== "lesen" && q.skill !== "hoeren") continue;
    if (questionHasCompatibleKey(q)) n += 1;
  }
  return n;
}

function countMissingKeys(questions: ExamCompletenessQuestion[]): number {
  let n = 0;
  for (const q of questions) {
    if (q.skill !== "lesen" && q.skill !== "hoeren") continue;
    if (!questionHasCompatibleKey(q)) n += 1;
  }
  return n;
}

function countAudioVerifiedSlots(questions: ExamCompletenessQuestion[]): number {
  const bySlot = new Map<number, boolean>();
  for (const q of questions) {
    if (!questionNeedsHorenAudio(q.skill, q.type)) continue;
    const meta = asRecord(q.metadata);
    const slot = Number(meta?.["audio_slot"] ?? meta?.["teil"]);
    if (!Number.isFinite(slot) || slot < 1 || slot > 4) continue;
    if (meta?.["audio_verification_status"] === "content_verified") {
      bySlot.set(slot, true);
    } else if (!bySlot.has(slot)) {
      bySlot.set(slot, false);
    }
  }
  return [1, 2, 3, 4].filter((s) => bySlot.get(s) === true).length;
}

function resolveScoringStatus(
  questions: ExamCompletenessQuestion[],
): B1ExamReadiness["scoringStatus"] {
  if (questions.length === 0) return "mixed_or_unknown";
  const allProvisional = questions.every((q) => {
    const meta = asRecord(q.metadata);
    return meta?.["points_rubric"] === "provisional_needs_review";
  });
  if (allProvisional) return "provisional_needs_review";
  const anyOfficial = questions.some((q) => {
    const meta = asRecord(q.metadata);
    return meta?.["points_basis"] === "official_pdf" || meta?.["points_rubric"] === "official";
  });
  if (anyOfficial) return "official";
  return "mixed_or_unknown";
}

/**
 * Compute publish readiness for a B1-MT* exam from an ExamDetail-like shape.
 */
export function computeB1ExamReadiness(exam: B1ReadinessExamInput): B1ExamReadiness {
  const examCode = (exam.code ?? "").trim() || "—";
  const status = (exam.status ?? "draft").trim() || "draft";
  const questions = flattenQuestions(exam);
  const completeness = validateExamCompleteness(questions);

  let pagesNeedingReview = 0;
  let audioReady = 0;
  let audioTotal = 0;
  let schreibenTasks = 0;
  let sprechenTasks = 0;
  let placeholderCount = 0;

  for (const q of questions) {
    const meta = asRecord(q.metadata);
    if (meta?.["needs_review"] === true || meta?.["transcription_status"] === "ocr_unverified") {
      pagesNeedingReview += 1;
    }
    if (isPlaceholderQuestion(q)) placeholderCount += 1;
    if (questionNeedsHorenAudio(q.skill, q.type)) {
      audioTotal += 1;
      if (questionHasAudio(q)) audioReady += 1;
    }
    if (q.skill === "schreiben" || q.type === "writing") schreibenTasks += 1;
    if (q.skill === "sprechen" || q.type === "speaking") sprechenTasks += 1;
  }

  const objectiveTotal = questions.filter((q) => q.skill === "lesen" || q.skill === "hoeren").length;
  const confirmedAnswerKeys = countAnswerKeys(questions);
  const missingKeysCount = countMissingKeys(questions);
  const audioSlotsTotal = 4;
  const audioVerified = countAudioVerifiedSlots(questions);
  const scoringStatus = resolveScoringStatus(questions);
  const blockers = [...completeness.issues];

  if (pagesNeedingReview > 0 && !blockers.some((b) => b.includes("OCR non validé"))) {
    blockers.push(`${pagesNeedingReview} page(s) OCR à vérifier`);
  }
  if (placeholderCount > 0 && !blockers.some((b) => /Placeholder OCR/i.test(b))) {
    blockers.push(`${placeholderCount} placeholder(s) OCR`);
  }
  if (missingKeysCount > 0 && !blockers.some((b) => /clé|réponse/i.test(b))) {
    blockers.push(`${missingKeysCount} clé(s) manquante(s) ou incompatible(s)`);
  }
  if (audioTotal > 0 && audioReady < audioTotal) {
    const missing = audioTotal - audioReady;
    if (!blockers.some((b) => b.includes("Audio Hören manquant"))) {
      blockers.push(`${missing} audio(s) Hören manquant(s)`);
    }
  }
  if (audioVerified < audioSlotsTotal) {
    if (!blockers.some((b) => /non vérifié \(contenu\)|content_verified/i.test(b))) {
      blockers.push(`Audio Hören vérifié ${audioVerified}/${audioSlotsTotal}`);
    }
  }
  if (scoringStatus === "provisional_needs_review") {
    if (!blockers.some((b) => /Barème/i.test(b))) {
      blockers.push("Barème pédagogique interne, à confirmer");
    }
  }
  if (confirmedAnswerKeys === 0 && objectiveTotal > 0 && !blockers.some((b) => /clé|réponse/i.test(b))) {
    blockers.push("clés de correction structurées non fournies");
  }

  const readyForPublish =
    completeness.ok &&
    blockers.length === 0 &&
    status !== "published" &&
    placeholderCount === 0 &&
    missingKeysCount === 0 &&
    audioVerified === audioSlotsTotal &&
    scoringStatus !== "provisional_needs_review";

  // Stricter progress: do not credit unverified audio, placeholders, missing keys,
  // or provisional scoring as complete.
  const weights = {
    structure: 15,
    nonPlaceholder: 25,
    audioVerified: 25,
    keys: 25,
    scoring: 10,
  };
  let progress = 0;
  if (questions.length > 0) progress += weights.structure;

  if (questions.length > 0) {
    const nonPh = questions.length - placeholderCount;
    progress += Math.round((Math.max(0, nonPh) / questions.length) * weights.nonPlaceholder);
  }

  // Audio: only content_verified slots count (never credit mere media_path).
  progress += Math.round((audioVerified / audioSlotsTotal) * weights.audioVerified);

  if (objectiveTotal > 0) {
    progress += Math.round((confirmedAnswerKeys / objectiveTotal) * weights.keys);
  }

  // Scoring: provisional never contributes.
  if (scoringStatus === "official") {
    progress += weights.scoring;
  }

  progress = Math.max(0, Math.min(100, progress));

  return {
    examCode,
    status,
    questionCount: questions.length,
    pagesNeedingReview,
    placeholderCount,
    missingKeysCount,
    audioReady,
    audioTotal,
    audioVerified,
    audioSlotsTotal,
    schreibenTasks,
    sprechenTasks,
    confirmedAnswerKeys,
    scoringStatus,
    blockers: [...new Set(blockers)],
    readyForPublish: readyForPublish && completeness.ok,
    progress,
  };
}

export const B1_EXAM_CODE_RE = /^B1-MT\d{2}$/i;

export function isB1ModelltestCode(code: string | null | undefined): boolean {
  return Boolean(code && /^B1-MT/i.test(code));
}
