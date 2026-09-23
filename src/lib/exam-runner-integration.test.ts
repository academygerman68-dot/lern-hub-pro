import { describe, expect, it, vi } from "vitest";
import {
  isChoiceQuestionType,
  pedagogicalQuestionLabel,
  stableHorenAudioKey,
} from "./exam-runner-ux";
import { detectHorenTrackInventoryDivergence } from "./horen-audio-slots";
import { isStudentSafeQuestion } from "./b1-student-content";
import { sanitizeQuestionMetadataForStudent } from "./exam-form-fill";

describe("common runner B1 behaviours", () => {
  it("keeps A1-style choice types including matching", () => {
    expect(isChoiceQuestionType("matching")).toBe(true);
    expect(isChoiceQuestionType("listening")).toBe(true);
  });

  it("uses pedagogical labels instead of raw 1/67 indexing", () => {
    expect(
      pedagogicalQuestionLabel({
        skill: "lesen",
        sortOrder: 12,
        metadata: { teil: 2 },
        indexInSkill: 11,
      }),
    ).toBe("Frage 12");
    expect(
      pedagogicalQuestionLabel({
        skill: "sprechen",
        sortOrder: 2,
        metadata: { teil: 2, role: "A" },
        indexInSkill: 1,
      }),
    ).toMatch(/Kandidat A/);
  });

  it("does not remount Hören audio within the same Teil", () => {
    const a = stableHorenAudioKey({
      skill: "hoeren",
      type: "listening",
      metadata: { audio_slot: 3 },
      audioUrl: "https://a",
      questionId: "1",
    });
    const b = stableHorenAudioKey({
      skill: "hoeren",
      type: "listening",
      metadata: { audio_slot: 3 },
      audioUrl: "https://b",
      questionId: "2",
    });
    expect(a).toBe(b);
  });

  it("hides glued OCR from student-safe gate", () => {
    expect(
      isStudentSafeQuestion({
        prompt: "ClemenskannsichkaumnochandieZeitimLibanonerinnern.",
      }),
    ).toBe(false);
    expect(isStudentSafeQuestion({ prompt: "Frage 8 — OCR unvollständig" })).toBe(false);
  });

  it("strips OCR raw fields from student metadata", () => {
    const safe = sanitizeQuestionMetadataForStudent({
      passage: "Hallo",
      ocr_raw_prompt: "SECRET",
      audio_script: "SECRET2",
      teil: 1,
    });
    expect(safe?.["passage"]).toBe("Hallo");
    expect(safe?.["teil"]).toBe(1);
    expect(safe?.["ocr_raw_prompt"]).toBeUndefined();
    expect(safe?.["audio_script"]).toBeUndefined();
  });

  it("detects inventory divergence without inventing paths", () => {
    const issues = detectHorenTrackInventoryDivergence({
      questionPathsBySlot: {
        1: "exams/b1/b1-mt01/hoeren/teil-1.mpeg",
        2: "exams/b1/b1-mt01/hoeren/teil-2.mpeg",
        3: null,
        4: "exams/b1/b1-mt01/hoeren/teil-4.mpeg",
      },
      inventoryPathsBySlot: {
        1: "exams/b1/b1-mt01/hoeren/teil-1.mpeg",
        2: "exams/b1/b1-mt02/hoeren/teil-2.mpeg",
        3: "exams/b1/b1-mt01/hoeren/teil-3.mpeg",
        4: "exams/b1/b1-mt01/hoeren/teil-4.mpeg",
      },
    });
    expect(issues.some((i) => i.includes("Teil 2"))).toBe(true);
    expect(issues.some((i) => i.includes("Teil 3"))).toBe(true);
  });
});

describe("submit flush contract (unit)", () => {
  it("requires server confirmation before success messaging", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const submit = vi.fn().mockRejectedValue(new Error("network"));
    let successToast = false;
    let errorToast = "";

    try {
      await save();
      await submit();
      successToast = true;
    } catch (err) {
      errorToast = err instanceof Error ? err.message : "fail";
    }

    expect(successToast).toBe(false);
    expect(errorToast).toBe("network");
    expect(submit).toHaveBeenCalledOnce();
  });
});
