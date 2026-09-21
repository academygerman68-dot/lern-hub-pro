export type AssignmentUxStatus =
  "todo" | "in_progress" | "submitted" | "edited_after_submit" | "late" | "graded";

export type AssignmentUxFilter = "all" | "todo" | "submitted" | "graded" | "late";

export function assignmentUxLabel(status: AssignmentUxStatus): string {
  if (status === "todo") return "À faire";
  if (status === "in_progress") return "En cours";
  if (status === "submitted") return "Remis";
  if (status === "edited_after_submit") return "Modifié après remise";
  if (status === "late") return "En retard";
  return "Corrigé";
}

export function assignmentUxTone(
  status: AssignmentUxStatus,
): "green" | "amber" | "red" | "blue" | "gray" {
  if (status === "graded") return "green";
  if (status === "submitted") return "blue";
  if (status === "edited_after_submit") return "amber";
  if (status === "late") return "red";
  if (status === "in_progress") return "amber";
  return "gray";
}

export function assignmentCtaLabel(status: AssignmentUxStatus): string {
  if (status === "todo") return "Ouvrir";
  if (status === "in_progress") return "Continuer";
  if (status === "graded") return "Voir la correction";
  return "Voir / Modifier";
}

type SubmissionLike = {
  status?: string | null;
  content_text?: string | null;
  file_path?: string | null;
  submitted_at?: string | null;
  last_edited_at?: string | null;
  updated_at?: string | null;
  version?: number | null;
  edited_after_due?: boolean | null;
  score?: number | null;
};

export function resolveAssignmentUxStatus(input: {
  submission?: SubmissionLike | null;
  dueAt?: string | null;
  now?: Date;
}): AssignmentUxStatus {
  const now = input.now ?? new Date();
  const submission = input.submission;
  const dueMs = input.dueAt ? new Date(input.dueAt).getTime() : null;
  const pastDue = dueMs != null && !Number.isNaN(dueMs) && dueMs < now.getTime();

  if (!submission) {
    return pastDue ? "late" : "todo";
  }

  if (submission.status === "graded") return "graded";

  const hasContent = Boolean(submission.content_text?.trim() || submission.file_path);
  const submitted =
    submission.status === "submitted" ||
    submission.status === "graded" ||
    Boolean(submission.submitted_at);

  if (!submitted && !hasContent) {
    return pastDue ? "late" : "todo";
  }

  if (!submitted && hasContent) {
    return pastDue ? "late" : "in_progress";
  }

  const version = Number(submission.version ?? 1);
  const editedAfterDue = Boolean(submission.edited_after_due);
  const lastEdited = submission.last_edited_at ?? submission.updated_at;
  const submittedAt = submission.submitted_at;
  const editedAfterSubmit =
    version > 1 ||
    (Boolean(submittedAt) &&
      Boolean(lastEdited) &&
      new Date(lastEdited!).getTime() > new Date(submittedAt!).getTime() + 1000);

  if (editedAfterDue || (pastDue && editedAfterSubmit)) return "edited_after_submit";
  if (editedAfterSubmit) return "edited_after_submit";
  if (pastDue) return "late";
  return "submitted";
}

export function matchesAssignmentFilter(
  status: AssignmentUxStatus,
  filter: AssignmentUxFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "todo") return status === "todo" || status === "in_progress";
  if (filter === "submitted") return status === "submitted" || status === "edited_after_submit";
  if (filter === "late") return status === "late" || status === "edited_after_submit";
  return status === "graded";
}

export function formatAssignmentActivity(submission?: SubmissionLike | null): string {
  if (!submission) return "Aucune activité";
  const at = submission.last_edited_at ?? submission.submitted_at ?? submission.updated_at;
  if (!at) return "Aucune activité";
  return new Date(at).toLocaleString("fr-FR");
}

export type ResponseVersionSnapshot = {
  version: number;
  content_text: string | null;
  file_bucket: string | null;
  file_path: string | null;
  saved_at: string;
};

export function appendResponseVersion(
  existing: unknown,
  snapshot: ResponseVersionSnapshot,
): ResponseVersionSnapshot[] {
  const list = Array.isArray(existing) ? (existing as ResponseVersionSnapshot[]) : [];
  return [...list, snapshot];
}
