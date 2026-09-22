/** Pure helpers for optional Sprechen (oral) exam answers. */

export const DEFAULT_ORAL_RUBRIC: Record<string, number> = {
  task_completion: 4,
  fluency: 2,
  pronunciation: 2,
  vocabulary: 2,
};

export const ORAL_RUBRIC_LABELS: Record<string, string> = {
  task_completion: "Réalisation de la tâche",
  fluency: "Fluidité",
  pronunciation: "Prononciation",
  vocabulary: "Vocabulaire",
  grammar: "Grammaire",
  comprehensibility: "Compréhensibilité",
  grammar_and_spelling: "Grammaire et orthographe",
};

export function isSpeakingQuestionType(type: string | null | undefined): boolean {
  return type === "speaking";
}

export function isWritingOnlyQuestionType(type: string | null | undefined): boolean {
  return type === "writing" || type === "text" || type === "open_text";
}

export type OralAnswerPayload = {
  kind: "oral_audio";
  bucket: string;
  path: string;
  mime_type?: string | null;
};

export function parseOralAnswer(answer: unknown): OralAnswerPayload | null {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return null;
  const row = answer as Record<string, unknown>;
  if (row["kind"] !== "oral_audio") return null;
  const bucket = typeof row["bucket"] === "string" ? row["bucket"] : null;
  const path = typeof row["path"] === "string" ? row["path"] : null;
  if (!bucket || !path) return null;
  const mime =
    typeof row["mime_type"] === "string"
      ? row["mime_type"]
      : typeof row["mimeType"] === "string"
        ? row["mimeType"]
        : null;
  return {
    kind: "oral_audio",
    bucket,
    path,
    ...(mime ? { mime_type: mime } : {}),
  };
}

export function hasOralAudioAnswer(input: {
  answer?: unknown;
  answer_media_path?: string | null;
}): boolean {
  if (input.answer_media_path) return true;
  return Boolean(parseOralAnswer(input.answer));
}

export const ORAL_AUDIO_MAX_BYTES = 25 * 1024 * 1024;

export function validateOralAnswerAudioFile(file: File | null | undefined): string | null {
  if (!file) return "Choisissez ou enregistrez un fichier audio.";
  if (file.size <= 0) return "Le fichier audio est vide.";
  if (file.size > ORAL_AUDIO_MAX_BYTES) return "Fichier trop volumineux (max 25 Mo).";
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  const okMime =
    mime === "audio/webm" ||
    mime === "audio/ogg" ||
    mime === "audio/mpeg" ||
    mime === "audio/mp3" ||
    mime === "audio/wav" ||
    mime === "audio/x-wav" ||
    mime === "audio/wave" ||
    mime === "audio/mp4" ||
    mime === "audio/x-m4a" ||
    mime === "audio/m4a" ||
    mime === "audio/aac" ||
    mime === "";
  const okExt =
    name.endsWith(".webm") ||
    name.endsWith(".ogg") ||
    name.endsWith(".mp3") ||
    name.endsWith(".wav") ||
    name.endsWith(".m4a");
  if (!okMime && !okExt) {
    return "Format non autorisé (WebM, OGG, MP3, WAV ou M4A).";
  }
  return null;
}

export function buildOralStoragePath(input: {
  attemptId: string;
  studentId: string;
  questionId: string;
  fileName: string;
}): string {
  const ext = input.fileName.includes(".")
    ? input.fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") || "webm"
    : "webm";
  const safeExt = ext.slice(0, 8);
  return `exam-oral/${input.attemptId}/${input.studentId}/${input.questionId}-${crypto.randomUUID()}.${safeExt}`;
}

export function oralRubricFromMeta(
  meta: Record<string, unknown> | null | undefined,
  maxPoints: number,
): Record<string, number> {
  const raw = meta?.["rubric"];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) out[key] = n;
    }
    if (Object.keys(out).length) return out;
  }
  const scaled = { ...DEFAULT_ORAL_RUBRIC };
  const sum = Object.values(scaled).reduce((a, b) => a + b, 0);
  if (sum > 0 && maxPoints > 0 && sum !== maxPoints) {
    // Keep relative weights; last key absorbs rounding.
    const keys = Object.keys(scaled);
    let allocated = 0;
    keys.forEach((key, index) => {
      if (index === keys.length - 1) {
        scaled[key] = Math.max(0, maxPoints - allocated);
      } else {
        const part = Math.round(((scaled[key] ?? 0) / sum) * maxPoints * 2) / 2;
        scaled[key] = part;
        allocated += part;
      }
    });
  }
  return scaled;
}
