/** Session-scoped collapse for the "Séances à venir" lobby list. */

export const UPCOMING_SESSIONS_COLLAPSE_KEY = "ga.live.upcomingSessionsCollapsed";

/**
 * Default: collapsed (masked).
 * "1" = collapsed, "0" = expanded.
 * Missing key / new browser session → collapsed.
 */
export function readUpcomingSessionsCollapsed(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): boolean {
  try {
    if (!storage) return true;
    const raw = storage.getItem(UPCOMING_SESSIONS_COLLAPSE_KEY);
    if (raw === null || raw === "") return true;
    return raw === "1";
  } catch {
    return true;
  }
}

export function writeUpcomingSessionsCollapsed(
  collapsed: boolean,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.setItem(UPCOMING_SESSIONS_COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

export function toggleUpcomingSessionsCollapsed(collapsed: boolean): boolean {
  const next = !collapsed;
  writeUpcomingSessionsCollapsed(next);
  return next;
}
