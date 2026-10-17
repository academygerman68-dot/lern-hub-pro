import { describe, expect, it } from "vitest";
import { decideAttemptTab, parseAttemptTabLock } from "./exam-attempt-tab";

describe("exam attempt tab lock", () => {
  it("blocks a second tab while the first lock is fresh", () => {
    const decision = decideAttemptTab({
      stored: { tabId: "tab-a", at: 1_000 },
      tabId: "tab-b",
      now: 5_000,
      staleAfterMs: 15_000,
    });
    expect(decision.action).toBe("blocked");
    expect(decision.lock.tabId).toBe("tab-a");
  });

  it("takes over a stale lock and allows an explicit switch", () => {
    expect(
      decideAttemptTab({
        stored: { tabId: "tab-a", at: 1_000 },
        tabId: "tab-b",
        now: 20_000,
        staleAfterMs: 15_000,
      }).action,
    ).toBe("own");
    const forced = decideAttemptTab({
      stored: { tabId: "tab-a", at: 19_000 },
      tabId: "tab-b",
      now: 20_000,
      staleAfterMs: 15_000,
      force: true,
    });
    expect(forced.action).toBe("own");
    expect(forced.lock.tabId).toBe("tab-b");
  });

  it("ignores a malformed lock payload", () => {
    expect(parseAttemptTabLock("not-json")).toBeNull();
    expect(parseAttemptTabLock(JSON.stringify({ tabId: "", at: 1 }))).toBeNull();
  });
});
