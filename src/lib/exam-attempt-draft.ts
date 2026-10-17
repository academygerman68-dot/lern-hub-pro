import type { Json } from "@/types/database";

export type AttemptDraftEntry = {
  questionId: string;
  answer: Json;
  flagged: boolean;
  revision: number;
};

const STORAGE_PREFIX = "ga_exam_unsaved_";

export function attemptDraftStorageKey(attemptId: string) {
  return `${STORAGE_PREFIX}${attemptId}`;
}

export function noteDraftEntry(
  drafts: Record<string, AttemptDraftEntry>,
  input: { questionId: string; answer: Json; flagged: boolean },
): { drafts: Record<string, AttemptDraftEntry>; entry: AttemptDraftEntry } {
  const previous = drafts[input.questionId];
  const entry: AttemptDraftEntry = {
    questionId: input.questionId,
    answer: input.answer,
    flagged: input.flagged,
    revision: (previous?.revision ?? 0) + 1,
  };
  return { drafts: { ...drafts, [input.questionId]: entry }, entry };
}

export function listDrafts(drafts: Record<string, AttemptDraftEntry>): AttemptDraftEntry[] {
  return Object.values(drafts);
}

/** Drop a draft only when the saved payload is still the latest revision. */
export function ackDraftIfCurrent(
  drafts: Record<string, AttemptDraftEntry>,
  questionId: string,
  revision: number,
): Record<string, AttemptDraftEntry> {
  const current = drafts[questionId];
  if (!current || current.revision !== revision) return drafts;
  const next = { ...drafts };
  delete next[questionId];
  return next;
}

export function mergeServerAnswersWithDrafts(
  server: Array<{ question_id: string; answer: Json; flagged: boolean }>,
  drafts: Record<string, AttemptDraftEntry>,
): { answers: Record<string, Json>; flagged: Record<string, boolean> } {
  const answers: Record<string, Json> = {};
  const flagged: Record<string, boolean> = {};
  for (const row of server) {
    answers[row.question_id] = row.answer;
    flagged[row.question_id] = row.flagged;
  }
  for (const draft of Object.values(drafts)) {
    answers[draft.questionId] = draft.answer;
    flagged[draft.questionId] = draft.flagged;
  }
  return { answers, flagged };
}

export function acquireSubmitLock(lock: { held: boolean }): boolean {
  if (lock.held) return false;
  lock.held = true;
  return true;
}

export function releaseSubmitLock(lock: { held: boolean }) {
  lock.held = false;
}

export function draftSaveStatus(input: {
  pending: boolean;
  unsaved: number;
  failed: boolean;
}): "pending" | "unsaved" | "failed" | "idle" {
  if (input.pending) return "pending";
  if (input.unsaved > 0 && input.failed) return "failed";
  if (input.unsaved > 0) return "unsaved";
  if (input.failed) return "failed";
  return "idle";
}

export function writeAttemptDraft(attemptId: string, drafts: Record<string, AttemptDraftEntry>) {
  if (typeof sessionStorage === "undefined") return;
  try {
    const key = attemptDraftStorageKey(attemptId);
    if (Object.keys(drafts).length === 0) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, JSON.stringify(drafts));
  } catch {
    /* private mode or quota: the in-memory draft still flushes in this page */
  }
}

export function readAttemptDraft(attemptId: string): Record<string, AttemptDraftEntry> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(attemptDraftStorageKey(attemptId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, AttemptDraftEntry> = {};
    for (const [questionId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const row = value as Partial<AttemptDraftEntry>;
      if (row.answer === undefined) continue;
      const revision = Number(row.revision);
      out[questionId] = {
        questionId,
        answer: row.answer,
        flagged: Boolean(row.flagged),
        revision: Number.isFinite(revision) && revision > 0 ? revision : 1,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function clearAttemptDraft(attemptId: string) {
  writeAttemptDraft(attemptId, {});
}
