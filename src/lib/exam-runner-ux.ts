import type { Json } from "@/types/database";
import { isB1ModelltestCode } from "@/lib/b1-exam-readiness";

export type ExamLevelFilter = "all" | "A1" | "A2" | "B1" | "B2";

export const EXAM_LEVEL_FILTERS: ExamLevelFilter[] = ["all", "A1", "A2", "B1", "B2"];

export function asMetaRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Teil / audio_slot from question metadata (1–4 when present). */
export function questionTeil(metadata: unknown): number | null {
  const meta = asMetaRecord(metadata);
  const raw = meta["audio_slot"] ?? meta["teil"] ?? meta["part"];
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

/**
 * Stable key for Hören player: same Teil keeps the same key so the audio
 * element does not remount when navigating questions inside that Teil.
 */
export function stableHorenAudioKey(input: {
  skill?: string | null;
  type?: string | null;
  metadata?: unknown;
  audioUrl?: string | null;
  questionId?: string;
}): string {
  const needsAudio = input.skill === "hoeren" || input.type === "listening";
  if (!needsAudio) return input.questionId ?? "none";
  const teil = questionTeil(input.metadata);
  if (teil != null && input.audioUrl) return `horen-teil-${teil}`;
  if (teil != null) return `horen-teil-${teil}-missing`;
  return input.audioUrl ? `horen-url-${input.audioUrl}` : `horen-q-${input.questionId ?? "none"}`;
}

export function isChoiceQuestionType(type: string | null | undefined): boolean {
  return (
    type === "single_choice" ||
    type === "true_false" ||
    type === "listening" ||
    type === "matching"
  );
}

export function examLevelCode(exam: {
  level?: { code?: string | null } | null;
  code?: string | null;
}): string {
  const fromLevel = exam.level?.code?.trim().toUpperCase();
  if (fromLevel) return fromLevel;
  const code = exam.code?.trim().toUpperCase() ?? "";
  const match = code.match(/^(A1|A2|B1|B2)\b/);
  return match?.[1] ?? "";
}

export function filterExamsByLevel<T extends { level?: { code?: string | null } | null; code?: string | null }>(
  exams: T[],
  filter: ExamLevelFilter,
): T[] {
  if (filter === "all") return exams;
  return exams.filter((exam) => examLevelCode(exam) === filter);
}

/** B1 Modelltests sort numerically (MT01…MT15); others keep title order. */
export function sortExamsForCatalog<
  T extends { title?: string | null; code?: string | null; level?: { code?: string | null } | null },
>(exams: T[]): T[] {
  return exams.slice().sort((a, b) => {
    const aB1 = isB1ModelltestCode(a.code);
    const bB1 = isB1ModelltestCode(b.code);
    if (aB1 && bB1) {
      return String(a.code ?? "").localeCompare(String(b.code ?? ""), "en", { numeric: true });
    }
    if (aB1 !== bB1) return aB1 ? 1 : -1;
    return String(a.title ?? "").localeCompare(String(b.title ?? ""), "fr");
  });
}

export function previewStorageKey(examId: string): string {
  return `ga_exam_preview_${examId}`;
}

export type PreviewDraft = {
  answers: Record<string, Json>;
  flagged: Record<string, boolean>;
  index: number;
};

export function loadPreviewDraft(examId: string): PreviewDraft {
  try {
    if (typeof sessionStorage === "undefined") {
      return { answers: {}, flagged: {}, index: 0 };
    }
    const raw = sessionStorage.getItem(previewStorageKey(examId));
    if (!raw) return { answers: {}, flagged: {}, index: 0 };
    const parsed = JSON.parse(raw) as Partial<PreviewDraft>;
    return {
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
      flagged: parsed.flagged && typeof parsed.flagged === "object" ? parsed.flagged : {},
      index: Number.isFinite(parsed.index) ? Number(parsed.index) : 0,
    };
  } catch {
    return { answers: {}, flagged: {}, index: 0 };
  }
}

export function savePreviewDraft(examId: string, draft: PreviewDraft) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(previewStorageKey(examId), JSON.stringify(draft));
  } catch {
    /* ignore quota / private-mode write failures */
  }
}

/** Discrete draft blockers for staff catalog cards (never shown to students). */
export function pedagogicalQuestionLabel(input: {
  skill?: string | null;
  sortOrder?: number | null;
  metadata?: unknown;
  indexInSkill: number;
}): string {
  const meta = asMetaRecord(input.metadata);
  const explicit =
    typeof meta["expected_number"] === "number"
      ? meta["expected_number"]
      : typeof meta["question_number"] === "number"
        ? meta["question_number"]
        : null;
  const n = explicit ?? (Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : input.indexInSkill + 1);
  const skill = input.skill ?? "";
  if (skill === "schreiben") return `Aufgabe ${n}`;
  if (skill === "sprechen") {
    const role = typeof meta["role"] === "string" ? meta["role"].trim() : "";
    const teil = questionTeil(input.metadata);
    if (teil === 2 && role) return `Teil 2 · Kandidat ${role}`;
    if (teil != null) return `Teil ${teil}`;
    return `Sprechen ${n}`;
  }
  return `Frage ${n}`;
}

/** Discrete draft blockers for staff catalog cards (never shown to students). */
export function draftBlockersSummary(issues: string[], max = 3): string | null {
  if (!issues.length) return null;
  const head = issues.slice(0, max).join(" · ");
  const more = issues.length > max ? ` · +${issues.length - max}` : "";
  return head + more;
}
