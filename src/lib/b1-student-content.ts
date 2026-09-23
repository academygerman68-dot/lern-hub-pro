/**
 * Student-facing B1 content: never expose OCR, placeholders, or storage paths.
 */
import { cleanupGluedOcrMarkers } from "@/lib/b1-ocr-transform";

export type StudentFacingChoice = {
  id: string;
  label: string;
  value: string;
  text: string;
};

export type StudentFacingQuestion = {
  id: string;
  skill: string;
  teil: number | null;
  type: string;
  sortOrder: number;
  instruction: string | null;
  passage: string | null;
  prompt: string;
  choices: StudentFacingChoice[];
  role: string | null;
  requirements: string[];
  recommendedWords: string | null;
  accessible: boolean;
  inaccessibleReason: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Detect remaining glued OCR (many lowercase-Uppercase joins without spaces). */
export function looksHeavilyGlued(text: string): boolean {
  if (!text || text.length < 20) return false;
  const joins = text.match(/[a-zäöüß][A-ZÄÖÜ]/g);
  if ((joins?.length ?? 0) >= 2) return true;
  // Long token without spaces often indicates glued OCR
  const longToken = text.split(/\s+/).some((t) => t.length >= 28 && /[a-zäöüß]{10,}/i.test(t));
  return longToken;
}

export function isPlaceholderPrompt(prompt: string, metadata?: unknown): boolean {
  const meta = asRecord(metadata);
  if (meta?.["transform_status"] === "placeholder") return true;
  return /OCR (in)?compl|Frage \d+ —|Situation \d+ —|Aussage \d+ —/i.test(prompt || "");
}

export function isStudentSafeQuestion(input: {
  prompt?: string | null;
  metadata?: unknown;
}): boolean {
  const prompt = input.prompt ?? "";
  if (isPlaceholderPrompt(prompt, input.metadata)) return false;
  if (/needs_review|ocr_raw|page_bundle/i.test(prompt)) return false;
  if (looksHeavilyGlued(prompt)) return false;
  return prompt.trim().length > 0;
}

/**
 * High-confidence display cleanup only — never invents German wording.
 */
export function formatStudentFacingText(text: string): string {
  if (!text) return "";
  let out = cleanupGluedOcrMarkers(text);
  out = out.replace(/([.!?…])([A-ZÄÖÜ])/g, "$1 $2");
  out = out.replace(/ {2,}/g, " ").trim();
  return out;
}

export function toStudentFacingQuestion(input: {
  id: string;
  prompt?: string | null;
  type?: string | null;
  skill?: string | null;
  sort_order?: number | null;
  metadata?: unknown;
  options?: Array<{
    id?: string;
    label?: string | null;
    value?: string | null;
    text?: string | null;
  }> | null;
}): StudentFacingQuestion {
  const meta = asRecord(input.metadata) ?? {};
  const promptRaw = String(input.prompt ?? "");
  const accessible = isStudentSafeQuestion({ prompt: promptRaw, metadata: meta });
  const teil = Number(meta["teil"] ?? meta["audio_slot"] ?? meta["part"]);
  const instruction =
    typeof meta["instruction"] === "string" ? formatStudentFacingText(meta["instruction"]) : null;
  const passage =
    typeof meta["passage"] === "string" ? formatStudentFacingText(meta["passage"]) : null;
  const role =
    typeof meta["role"] === "string" && meta["role"].trim() ? meta["role"].trim() : null;
  const requirements = Array.isArray(meta["requirements"])
    ? meta["requirements"]
        .filter((x): x is string => typeof x === "string")
        .map(formatStudentFacingText)
    : [];
  const recommendedWords =
    typeof meta["recommended_words"] === "string" ? meta["recommended_words"] : null;

  const choices: StudentFacingChoice[] = (input.options ?? []).map((o, idx) => {
    const value = String(o.value ?? o.label ?? idx);
    const label = String(o.label ?? o.value ?? "");
    const text = formatStudentFacingText(String(o.text ?? o.label ?? o.value ?? ""));
    return {
      id: String(o.id ?? `${value}-${idx}`),
      label,
      value,
      text: text || label,
    };
  });

  return {
    id: input.id,
    skill: String(input.skill ?? ""),
    teil: Number.isFinite(teil) ? teil : null,
    type: String(input.type ?? "text"),
    sortOrder: Number(input.sort_order ?? 0),
    instruction,
    passage,
    prompt: accessible ? formatStudentFacingText(promptRaw) : "",
    choices,
    role,
    requirements,
    recommendedWords,
    accessible,
    inaccessibleReason: accessible
      ? null
      : "Cette question n’est pas encore disponible pour les étudiants.",
  };
}

/** Strip staff-only fields from question metadata for student UI payloads. */
export function stripStaffMetadata(metadata: unknown): Record<string, unknown> {
  const meta = asRecord(metadata) ?? {};
  const allow = [
    "teil",
    "audio_slot",
    "part",
    "instruction",
    "passage",
    "role",
    "requirements",
    "recommended_words",
    "audio_url",
  ] as const;
  const out: Record<string, unknown> = {};
  for (const key of allow) {
    if (key in meta) out[key] = meta[key];
  }
  return out;
}
