import { describe, expect, it } from "vitest";
import {
  examLevelCode,
  filterExamsByLevel,
  isChoiceQuestionType,
  loadPreviewDraft,
  questionTeil,
  savePreviewDraft,
  sortExamsForCatalog,
  stableHorenAudioKey,
} from "./exam-runner-ux";

describe("exam-runner-ux", () => {
  it("keeps Hören audio key stable within the same Teil", () => {
    const a = stableHorenAudioKey({
      skill: "hoeren",
      type: "listening",
      metadata: { audio_slot: 2 },
      audioUrl: "https://signed/a",
      questionId: "q1",
    });
    const b = stableHorenAudioKey({
      skill: "hoeren",
      type: "listening",
      metadata: { audio_slot: 2 },
      audioUrl: "https://signed/b-refreshed",
      questionId: "q2",
    });
    expect(a).toBe(b);
    expect(a).toBe("horen-teil-2");
  });

  it("changes key when Teil changes", () => {
    const t1 = stableHorenAudioKey({
      skill: "hoeren",
      type: "listening",
      metadata: { audio_slot: 1 },
      audioUrl: "https://x",
      questionId: "q1",
    });
    const t2 = stableHorenAudioKey({
      skill: "hoeren",
      type: "listening",
      metadata: { audio_slot: 2 },
      audioUrl: "https://x",
      questionId: "q2",
    });
    expect(t1).not.toBe(t2);
  });

  it("treats matching as a choice question type", () => {
    expect(isChoiceQuestionType("matching")).toBe(true);
    expect(isChoiceQuestionType("listening")).toBe(true);
    expect(isChoiceQuestionType("writing")).toBe(false);
  });

  it("filters and sorts B1 Modelltests numerically", () => {
    const exams = [
      { title: "Z", code: "B1-MT15", level: { code: "B1" } },
      { title: "A1 exam", code: "A1-MT01", level: { code: "A1" } },
      { title: "Y", code: "B1-MT02", level: { code: "B1" } },
      { title: "X", code: "B1-MT01", level: { code: "B1" } },
    ];
    const b1 = filterExamsByLevel(exams, "B1");
    expect(b1).toHaveLength(3);
    expect(sortExamsForCatalog(b1).map((e) => e.code)).toEqual([
      "B1-MT01",
      "B1-MT02",
      "B1-MT15",
    ]);
    expect(examLevelCode(exams[1]!)).toBe("A1");
  });

  it("reads teil from metadata", () => {
    expect(questionTeil({ teil: 3 })).toBe(3);
    expect(questionTeil({ audio_slot: 4 })).toBe(4);
    expect(questionTeil({})).toBeNull();
  });

  it("loadPreviewDraft does not throw when sessionStorage is unavailable", () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: undefined,
    });
    try {
      expect(loadPreviewDraft("exam-ssr")).toEqual({ answers: {}, flagged: {}, index: 0 });
      expect(() => savePreviewDraft("exam-ssr", { answers: {}, flagged: {}, index: 0 })).not.toThrow();
    } finally {
      if (previous) Object.defineProperty(globalThis, "sessionStorage", previous);
      else Reflect.deleteProperty(globalThis, "sessionStorage");
    }
  });
});
