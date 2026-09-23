import type { ExamQuestionType, ExamSkill } from "@/services/supabase/exam-service";
import type { Json } from "@/types/database";

export type ExamCompletenessIssue = string;

export type ExamCompletenessReport = {
  ok: boolean;
  issues: ExamCompletenessIssue[];
  horenReady: number;
  horenTotal: number;
  questionCount: number;
};

export type ExamCompletenessQuestion = {
  id: string;
  prompt: string;
  type: ExamQuestionType | string;
  points: number;
  media_path?: string | null;
  media_bucket?: string | null;
  metadata?: Record<string, unknown> | Json | null;
  skill: ExamSkill | string;
  sectionTitle: string;
  correct_values?: string[] | null;
  teacher_payload?: Record<string, unknown> | Json | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function questionNeedsHorenAudio(skill: string, type: string): boolean {
  return skill === "hoeren" || type === "listening";
}

export function questionHasAudio(input: {
  media_path?: string | null;
  media_bucket?: string | null;
  metadata?: Record<string, unknown> | Json | null;
}): boolean {
  const path = input.media_path?.trim();
  const bucket = input.media_bucket?.trim();
  if (path && bucket) return true;
  const meta = asRecord(input.metadata);
  const url = meta?.["audio_url"];
  return typeof url === "string" && url.trim().length > 0;
}

export function countHorenAudioReady(questions: ExamCompletenessQuestion[]): {
  ready: number;
  total: number;
} {
  let ready = 0;
  let total = 0;
  for (const q of questions) {
    if (!questionNeedsHorenAudio(q.skill, q.type)) continue;
    total += 1;
    if (questionHasAudio(q)) ready += 1;
  }
  return { ready, total };
}

export function validateExamCompleteness(
  questions: ExamCompletenessQuestion[],
): ExamCompletenessReport {
  const issues: string[] = [];
  const { ready: horenReady, total: horenTotal } = countHorenAudioReady(questions);

  if (questions.length === 0) {
    issues.push("Aucune question dans l’examen");
  }

  for (const q of questions) {
    const label = q.prompt.trim().slice(0, 60) || "(sans titre)";
    const meta = asRecord(q.metadata);
    if (!q.prompt.trim()) {
      issues.push(`Consigne manquante · ${q.sectionTitle}`);
    }
    if (!(Number(q.points) > 0)) {
      issues.push(`Barème invalide · ${q.sectionTitle} · « ${label} »`);
    }
    if (questionNeedsHorenAudio(q.skill, q.type) && !questionHasAudio(q)) {
      issues.push(`Audio Hören manquant · « ${label} »`);
    }

    // B1 OCR gates — A1 stays unaffected when these metadata flags are absent.
    if (meta?.["needs_review"] === true || meta?.["transcription_status"] === "ocr_unverified") {
      issues.push(`OCR non validé · « ${label} »`);
    }

    // Audio verification: only when Hören media is present. Skip classic A1
    // uploads that never introduced audio_verification_status / OCR flags.
    if (questionNeedsHorenAudio(q.skill, q.type) && questionHasAudio(q)) {
      const verification = meta?.["audio_verification_status"];
      const isOcrDraft =
        meta?.["needs_review"] === true || meta?.["transcription_status"] === "ocr_unverified";
      if (verification != null && verification !== "confirmed") {
        issues.push(`Audio Hören non confirmé · « ${label} »`);
      } else if (verification == null && isOcrDraft) {
        issues.push(`Audio Hören non confirmé · « ${label} »`);
      }
    }

    if (q.type === "true_false" || q.type === "single_choice" || q.type === "multiple_choice") {
      if (!q.correct_values?.length) {
        issues.push(`Réponse correcte manquante · « ${label} »`);
      }
    } else if (q.type === "form_fill") {
      const payload = asRecord(q.teacher_payload);
      const fields = meta?.["fields"] ?? payload?.["fields"];
      const source = payload?.["source_data"];
      if (!Array.isArray(fields) || fields.length === 0) {
        issues.push(`Formulaire incomplet · « ${label} »`);
      }
      if (!source || typeof source !== "object" || Object.keys(source as object).length === 0) {
        issues.push(`Clé formulaire manquante · « ${label} »`);
      }
    } else if (
      q.type === "writing" ||
      q.type === "text" ||
      q.type === "open_text" ||
      q.type === "speaking"
    ) {
      if (!q.prompt.trim()) {
        issues.push(`Writing mal configuré · ${q.sectionTitle}`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    horenReady,
    horenTotal,
    questionCount: questions.length,
  };
}

export const EXAM_AUDIO_ACCEPT =
  ".mp3,.wav,.m4a,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/m4a,audio/aac";

export const EXAM_AUDIO_MAX_BYTES = 25 * 1024 * 1024;

export function validateExamAudioFile(file: File | null | undefined): string | null {
  if (!file) return "Choisissez un fichier audio MP3, WAV ou M4A.";
  if (file.size <= 0) return "Le fichier audio est vide.";
  if (file.size > EXAM_AUDIO_MAX_BYTES) return "Fichier trop volumineux (max 25 Mo).";
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  const okMime =
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
  const okExt = name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".m4a");
  if (!okMime && !okExt) return "Format non autorisé (MP3, WAV ou M4A uniquement).";
  if (!okExt && mime && !okMime) return "Format non autorisé (MP3, WAV ou M4A uniquement).";
  return null;
}

export function parseCompletenessReport(raw: unknown): ExamCompletenessReport {
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      issues: ["Rapport de complétude indisponible"],
      horenReady: 0,
      horenTotal: 0,
      questionCount: 0,
    };
  }
  const row = raw as Record<string, unknown>;
  const issues = Array.isArray(row["issues"])
    ? row["issues"].filter((item): item is string => typeof item === "string")
    : [];
  return {
    ok: Boolean(row["ok"]),
    issues,
    horenReady: Number(row["horen_ready"] ?? row["horenReady"] ?? 0),
    horenTotal: Number(row["horen_total"] ?? row["horenTotal"] ?? 0),
    questionCount: Number(row["question_count"] ?? row["questionCount"] ?? 0),
  };
}
