/**
 * Browser-safe B1 exam readiness scoring (no node:fs).
 * Used by the director B1 OCR bank panel.
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
  media_path?: string | null;
  media_bucket?: string | null;
  metadata?: Record<string, unknown> | Json | null;
  correct_values?: string[] | null;
  teacher_payload?: Record<string, unknown> | Json | null;
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
  audioReady: number;
  audioTotal: number;
  schreibenTasks: number;
  sprechenTasks: number;
  confirmedAnswerKeys: number;
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
      });
    }
  }
  return out;
}

function countAnswerKeys(questions: ExamCompletenessQuestion[]): number {
  let n = 0;
  for (const q of questions) {
    if (q.correct_values && q.correct_values.length > 0) {
      n += 1;
      continue;
    }
    const payload = asRecord(q.teacher_payload);
    if (payload && Object.keys(payload).length > 0) n += 1;
  }
  return n;
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

  for (const q of questions) {
    const meta = asRecord(q.metadata);
    if (meta?.["needs_review"] === true || meta?.["transcription_status"] === "ocr_unverified") {
      pagesNeedingReview += 1;
    }
    if (questionNeedsHorenAudio(q.skill, q.type)) {
      audioTotal += 1;
      if (questionHasAudio(q)) audioReady += 1;
    }
    if (q.skill === "schreiben" || q.type === "writing") schreibenTasks += 1;
    if (q.skill === "sprechen" || q.type === "speaking") sprechenTasks += 1;
  }

  const confirmedAnswerKeys = countAnswerKeys(questions);
  const blockers = [...completeness.issues];

  // Extra readiness blockers useful for the bank panel (deduped).
  if (pagesNeedingReview > 0 && !blockers.some((b) => b.includes("OCR non validé"))) {
    blockers.push(`${pagesNeedingReview} page(s) OCR à vérifier`);
  }
  if (audioTotal > 0 && audioReady < audioTotal) {
    const missing = audioTotal - audioReady;
    if (!blockers.some((b) => b.includes("Audio Hören manquant"))) {
      blockers.push(`${missing} audio(s) Hören manquant(s)`);
    }
  }
  if (confirmedAnswerKeys === 0 && !blockers.some((b) => /clé|réponse/i.test(b))) {
    blockers.push("clés de correction structurées non fournies");
  }

  const readyForPublish = completeness.ok && blockers.length === 0 && status !== "published";

  // Progress: weight structure, OCR review, audio, answer keys.
  const weights = {
    hasQuestions: 15,
    ocr: 35,
    audio: 30,
    keys: 20,
  };
  let progress = 0;
  if (questions.length > 0) progress += weights.hasQuestions;
  if (questions.length > 0) {
    const reviewed = questions.length - pagesNeedingReview;
    progress += Math.round((Math.max(0, reviewed) / questions.length) * weights.ocr);
  }
  if (audioTotal === 0) {
    progress += weights.audio;
  } else {
    progress += Math.round((audioReady / audioTotal) * weights.audio);
  }
  // Keys intentionally stay at 0 until real keys exist (never invent).
  if (confirmedAnswerKeys > 0) {
    progress += Math.min(
      weights.keys,
      Math.round((confirmedAnswerKeys / Math.max(questions.length, 1)) * weights.keys),
    );
  }
  progress = Math.max(0, Math.min(100, progress));

  return {
    examCode,
    status,
    questionCount: questions.length,
    pagesNeedingReview,
    audioReady,
    audioTotal,
    schreibenTasks,
    sprechenTasks,
    confirmedAnswerKeys,
    blockers: [...new Set(blockers)],
    readyForPublish: readyForPublish && completeness.ok,
    progress,
  };
}

export const B1_EXAM_CODE_RE = /^B1-MT\d{2}$/i;

export function isB1ModelltestCode(code: string | null | undefined): boolean {
  return Boolean(code && /^B1-MT/i.test(code));
}
