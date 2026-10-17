import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ackDraftIfCurrent,
  acquireSubmitLock,
  draftSaveStatus,
  listDrafts,
  mergeServerAnswersWithDrafts,
  noteDraftEntry,
  readAttemptDraft,
  releaseSubmitLock,
  writeAttemptDraft,
} from "./exam-attempt-draft";
import { officialExamResultFigures } from "./exam-writing";

describe("exam attempt drafts", () => {
  it("keeps an empty answer so a cleared response can be saved", () => {
    const noted = noteDraftEntry({}, { questionId: "q1", answer: "", flagged: false });
    expect(listDrafts(noted.drafts)).toEqual([
      { questionId: "q1", answer: "", flagged: false, revision: 1 },
    ]);
  });

  it("does not drop a newer keystroke when an older save returns", () => {
    const first = noteDraftEntry({}, { questionId: "q1", answer: "Hel", flagged: false });
    const second = noteDraftEntry(first.drafts, {
      questionId: "q1",
      answer: "Hallo",
      flagged: false,
    });
    const afterStaleAck = ackDraftIfCurrent(second.drafts, "q1", first.entry.revision);
    expect(afterStaleAck["q1"]?.answer).toBe("Hallo");
    const afterCurrentAck = ackDraftIfCurrent(second.drafts, "q1", second.entry.revision);
    expect(afterCurrentAck["q1"]).toBeUndefined();
  });

  it("prefers the unsaved draft over the last server row after a refresh", () => {
    const merged = mergeServerAnswersWithDrafts(
      [{ question_id: "q1", answer: "Hel", flagged: false }],
      {
        q1: { questionId: "q1", answer: "Hallo", flagged: true, revision: 2 },
      },
    );
    expect(merged.answers["q1"]).toBe("Hallo");
    expect(merged.flagged["q1"]).toBe(true);
  });

  it("refuses a second submit while the first lock is held", () => {
    const lock = { held: false };
    expect(acquireSubmitLock(lock)).toBe(true);
    expect(acquireSubmitLock(lock)).toBe(false);
    releaseSubmitLock(lock);
    expect(acquireSubmitLock(lock)).toBe(true);
  });

  it("reports pending before unsaved, and idle when nothing is waiting", () => {
    expect(draftSaveStatus({ pending: true, unsaved: 2, failed: false })).toBe("pending");
    expect(draftSaveStatus({ pending: false, unsaved: 1, failed: true })).toBe("failed");
    expect(draftSaveStatus({ pending: false, unsaved: 1, failed: false })).toBe("unsaved");
    expect(draftSaveStatus({ pending: false, unsaved: 0, failed: false })).toBe("idle");
  });

  it("round-trips unsaved drafts in sessionStorage", () => {
    const mem = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mem.set(key, value);
      },
      removeItem: (key: string) => {
        mem.delete(key);
      },
    });
    writeAttemptDraft("attempt-1", {
      q1: { questionId: "q1", answer: "Hallo", flagged: false, revision: 3 },
    });
    expect(readAttemptDraft("attempt-1")["q1"]?.answer).toBe("Hallo");
    writeAttemptDraft("attempt-1", {});
    expect(readAttemptDraft("attempt-1")).toEqual({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});

describe("official exam result figures", () => {
  it("shows the server percentage for a finalized Goethe attempt", () => {
    expect(
      officialExamResultFigures({
        goetheA1: true,
        awaiting: false,
        serverScore: 36,
        serverMax: 60,
        serverPercentage: 60,
        automaticScore: 30,
        automaticMax: 30,
      }),
    ).toEqual({ score: 36, max: 60, percentage: 60 });
  });

  it("shows the automatic score while manual grading is pending, including zero", () => {
    expect(
      officialExamResultFigures({
        goetheA1: true,
        awaiting: true,
        serverScore: 0,
        serverMax: 60,
        serverPercentage: 0,
        automaticScore: 0,
        automaticMax: 0,
      }),
    ).toEqual({ score: 0, max: 0, percentage: 0 });
  });

  it("does not replace a non-Goethe server percentage with a client ratio", () => {
    expect(
      officialExamResultFigures({
        goetheA1: false,
        awaiting: false,
        serverScore: 10,
        serverMax: 50,
        serverPercentage: 20,
        automaticScore: 10,
        automaticMax: 50,
      }).percentage,
    ).toBe(20);
  });
});
