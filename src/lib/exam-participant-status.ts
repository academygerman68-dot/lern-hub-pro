export type ExamParticipantStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "awaiting_grade"
  | "graded"
  | "no_show";

export type ExamParticipantRow = {
  studentId: string;
  displayName: string;
  email: string | null;
  status: ExamParticipantStatus;
  attemptId: string | null;
  attemptStatus: string | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  startedAt: string | null;
  submittedAt: string | null;
};

export function examParticipantStatusLabel(status: ExamParticipantStatus): string {
  if (status === "not_started") return "Non commencé";
  if (status === "in_progress") return "En cours";
  if (status === "submitted") return "Remis";
  if (status === "awaiting_grade") return "En attente de correction";
  if (status === "graded") return "Corrigé";
  return "Non présenté après échéance";
}

/** Prefer the latest meaningful attempt for a student. */
export function pickLatestAttempt<T extends { started_at?: string | null; submitted_at?: string | null; created_at?: string | null }>(
  attempts: T[],
): T | null {
  if (!attempts.length) return null;
  return [...attempts].sort((a, b) => {
    const ta = Date.parse(a.submitted_at || a.started_at || a.created_at || "") || 0;
    const tb = Date.parse(b.submitted_at || b.started_at || b.created_at || "") || 0;
    return tb - ta;
  })[0]!;
}

export function resolveExamParticipantStatus(input: {
  attempt: {
    status: string;
    score?: number | null;
    percentage?: number | null;
  } | null;
  endsAt?: string | null;
  now?: Date;
}): ExamParticipantStatus {
  const now = input.now ?? new Date();
  const pastDeadline =
    Boolean(input.endsAt) && !Number.isNaN(Date.parse(input.endsAt!))
      ? now.getTime() > Date.parse(input.endsAt!)
      : false;

  if (!input.attempt) {
    return pastDeadline ? "no_show" : "not_started";
  }

  const status = input.attempt.status;
  if (status === "graded") return "graded";
  if (status === "submitted") {
    // Manual sections still pending → awaiting grade; fully auto → still show as remis briefly.
    return "awaiting_grade";
  }
  if (status === "in_progress") return "in_progress";
  if (status === "expired") return pastDeadline ? "no_show" : "not_started";
  return pastDeadline ? "no_show" : "not_started";
}

export function countExamParticipantStatuses(rows: ExamParticipantRow[]) {
  const counts: Record<ExamParticipantStatus, number> = {
    not_started: 0,
    in_progress: 0,
    submitted: 0,
    awaiting_grade: 0,
    graded: 0,
    no_show: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}
