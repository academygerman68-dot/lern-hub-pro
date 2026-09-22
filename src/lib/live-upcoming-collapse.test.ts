import { describe, expect, it } from "vitest";
import {
  readUpcomingSessionsCollapsed,
  toggleUpcomingSessionsCollapsed,
  UPCOMING_SESSIONS_COLLAPSE_KEY,
  writeUpcomingSessionsCollapsed,
} from "./live-upcoming-collapse";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("upcoming sessions collapse", () => {
  it("defaults to collapsed (masked) on first visit / empty session", () => {
    expect(readUpcomingSessionsCollapsed(memoryStorage())).toBe(true);
    expect(readUpcomingSessionsCollapsed(null)).toBe(true);
  });

  it("expands then collapses and persists within the same session storage", () => {
    const storage = memoryStorage();
    expect(readUpcomingSessionsCollapsed(storage)).toBe(true);

    const expanded = toggleUpcomingSessionsCollapsed(true);
    writeUpcomingSessionsCollapsed(expanded, storage);
    expect(expanded).toBe(false);
    expect(storage.getItem(UPCOMING_SESSIONS_COLLAPSE_KEY)).toBe("0");
    expect(readUpcomingSessionsCollapsed(storage)).toBe(false);

    const collapsedAgain = toggleUpcomingSessionsCollapsed(false);
    writeUpcomingSessionsCollapsed(collapsedAgain, storage);
    expect(collapsedAgain).toBe(true);
    expect(storage.getItem(UPCOMING_SESSIONS_COLLAPSE_KEY)).toBe("1");
    expect(readUpcomingSessionsCollapsed(storage)).toBe(true);
  });

  it("treats a fresh empty storage as a new session (masked again)", () => {
    const previous = memoryStorage({ [UPCOMING_SESSIONS_COLLAPSE_KEY]: "0" });
    expect(readUpcomingSessionsCollapsed(previous)).toBe(false);
    const freshSession = memoryStorage();
    expect(readUpcomingSessionsCollapsed(freshSession)).toBe(true);
  });
});
