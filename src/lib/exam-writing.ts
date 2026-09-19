/** Pure helpers for Writing exam UX and final score (QCM + writing). */

export function countWritingStats(text: string) {
  const trimmed = text.trim();
  const characters = text.length;
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  return { characters, words };
}

export function combineExamScore(
  objectivePoints: number,
  writingPoints: number,
  maxPoints: number,
) {
  const score = objectivePoints + writingPoints;
  const percentage = maxPoints > 0 ? Math.round((score / maxPoints) * 10000) / 100 : 0;
  return { score, percentage };
}

export function groupAverage(percentages: number[]) {
  if (percentages.length === 0) return null;
  const sum = percentages.reduce((a, b) => a + b, 0);
  return Math.round((sum / percentages.length) * 100) / 100;
}

export function isManualQuestionType(type: string) {
  return type === "writing" || type === "text" || type === "speaking" || type === "open_text";
}

export function studentExamProgressLabel(
  status: string | null | undefined,
  hasUngradedWriting: boolean,
): "À faire" | "En cours" | "En attente de correction" | "Terminé" {
  if (!status) return "À faire";
  if (status === "in_progress") return "En cours";
  if (status === "graded" && !hasUngradedWriting) return "Terminé";
  if (status === "submitted" || status === "expired" || hasUngradedWriting) {
    return "En attente de correction";
  }
  return "À faire";
}

/** Counts completed attempts the same way as start_exam_attempt (submitted + graded). */
export function countCompletedExamAttempts(
  attempts: Array<{ exam_id: string; status: string }>,
  examId: string,
): number {
  return attempts.filter(
    (attempt) =>
      attempt.exam_id === examId &&
      (attempt.status === "submitted" || attempt.status === "graded"),
  ).length;
}

export function canRetakeExam(input: {
  latestStatus: string | null | undefined;
  completedAttempts: number;
  maxAttempts: number;
}): boolean {
  if (!input.latestStatus || input.latestStatus === "in_progress") return false;
  return input.completedAttempts < input.maxAttempts;
}

export function examAttemptsLeft(completedAttempts: number, maxAttempts: number): number {
  return Math.max(0, maxAttempts - completedAttempts);
}

export function attemptGradingStatus(status: string, hasUngradedManual: boolean) {
  if (status === "graded" && !hasUngradedManual) return "corrigé";
  if (status === "submitted" || hasUngradedManual) return "non corrigé";
  return status;
}

/** Niveau = CEFR code; Groupe = class instance under that level. */
export function filterGroupsByLevel<T extends { levelId: string | null }>(
  groups: T[],
  levelId: string,
) {
  if (!levelId) return groups;
  return groups.filter((g) => g.levelId === levelId);
}
