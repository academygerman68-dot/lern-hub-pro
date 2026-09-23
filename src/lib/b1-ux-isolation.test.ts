import { describe, expect, it } from "vitest";
import {
  assertB1AudioPathMatchesExam,
  expectedB1AudioPathPrefix,
  validateB1ExamIsolation,
} from "./b1-exam-isolation";
import {
  formatStudentFacingText,
  isStudentSafeQuestion,
  looksHeavilyGlued,
  toStudentFacingQuestion,
} from "./b1-student-content";
import { countHorenAudioReady, countHorenAudioVerifiedSlots } from "./horen-audio-slots";

describe("horen audio slots", () => {
  it("counts 4 tracks not 30 questions when audio_slot is present", () => {
    const questions = Array.from({ length: 30 }, (_, i) => ({
      skill: "hoeren",
      type: "listening",
      media_path: `exams/b1/b1-mt01/hoeren/teil-${(i % 4) + 1}.mpeg`,
      media_bucket: "course-materials",
      metadata: { audio_slot: (i % 4) + 1 },
    }));
    const result = countHorenAudioReady(questions);
    expect(result.mode).toBe("slots");
    expect(result.total).toBe(4);
    expect(result.ready).toBe(4);
  });

  it("does not credit content_verified without status", () => {
    const questions = [1, 2, 3, 4].map((slot) => ({
      skill: "hoeren",
      type: "listening",
      media_path: `exams/b1/b1-mt01/hoeren/teil-${slot}.mpeg`,
      media_bucket: "course-materials",
      metadata: { audio_slot: slot, audio_verification_status: "needs_review" },
    }));
    expect(countHorenAudioVerifiedSlots(questions)).toBe(0);
  });
});

describe("b1 student content", () => {
  it("hides placeholders and OCR from students", () => {
    expect(
      isStudentSafeQuestion({
        prompt: "Frage 8 — OCR unvollständig",
        metadata: { transform_status: "placeholder" },
      }),
    ).toBe(false);
    const q = toStudentFacingQuestion({
      id: "1",
      prompt: "Frage 8 — OCR unvollständig",
      type: "single_choice",
      skill: "lesen",
      metadata: { transform_status: "placeholder", ocr_raw_prompt: "SECRET OCR" },
      options: [{ label: "a", value: "a" }],
    });
    expect(q.accessible).toBe(false);
    expect(q.prompt).toBe("");
    expect(JSON.stringify(q)).not.toMatch(/OCR|SECRET/i);
  });

  it("detects heavily glued OCR and refuses student display", () => {
    const glued = "AufdemFestkonntemansichtrotzRegenundKaelte.";
    expect(looksHeavilyGlued(glued)).toBe(true);
    expect(isStudentSafeQuestion({ prompt: glued })).toBe(false);
  });

  it("applies high-confidence marker spacing only", () => {
    expect(formatStudentFacingText("Teil1LESEN")).toMatch(/Teil 1/);
  });
});

describe("b1 exam isolation", () => {
  it("validates audio paths for MT01/MT02/MT15", () => {
    expect(expectedB1AudioPathPrefix("B1-MT01")).toBe("exams/b1/b1-mt01/hoeren/");
    expect(assertB1AudioPathMatchesExam("B1-MT02", "exams/b1/b1-mt02/hoeren/teil-1.mpeg")).toBe(
      true,
    );
    expect(assertB1AudioPathMatchesExam("B1-MT02", "exams/b1/b1-mt01/hoeren/teil-1.mpeg")).toBe(
      false,
    );
    const issues = validateB1ExamIsolation({
      examId: "e15",
      examCode: "B1-MT15",
      sections: [
        {
          id: "s1",
          exam_id: "e15",
          questions: [
            {
              id: "q1",
              section_id: "s1",
              media_path: "exams/b1/b1-mt15/hoeren/teil-4.mpeg",
            },
          ],
        },
      ],
      tracks: [
        { exam_id: "e15", part_number: 1, media_path: "exams/b1/b1-mt15/hoeren/teil-1.mpeg" },
      ],
    });
    expect(issues).toEqual([]);
  });
});
