export type AttemptTabLock = { tabId: string; at: number };

export function attemptTabLockKey(attemptId: string) {
  return `ga_exam_tab_${attemptId}`;
}

export function parseAttemptTabLock(raw: string | null): AttemptTabLock | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AttemptTabLock>;
    if (!parsed || typeof parsed.tabId !== "string" || !parsed.tabId) return null;
    if (typeof parsed.at !== "number" || !Number.isFinite(parsed.at)) return null;
    return { tabId: parsed.tabId, at: parsed.at };
  } catch {
    return null;
  }
}

/**
 * Another live tab keeps the attempt. A stale lock can be taken over.
 * force replaces the lock so the candidate can continue in this tab.
 */
export function decideAttemptTab(input: {
  stored: AttemptTabLock | null;
  tabId: string;
  now: number;
  staleAfterMs: number;
  force?: boolean;
}): { action: "own" | "blocked"; lock: AttemptTabLock } {
  const fresh =
    input.stored != null &&
    input.stored.tabId !== input.tabId &&
    input.now - input.stored.at < input.staleAfterMs;
  if (fresh && !input.force) {
    return { action: "blocked", lock: input.stored! };
  }
  return { action: "own", lock: { tabId: input.tabId, at: input.now } };
}
