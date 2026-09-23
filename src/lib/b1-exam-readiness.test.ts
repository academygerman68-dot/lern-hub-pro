import { describe, expect, it } from "vitest";
import { computeB1ExamReadiness, isB1ModelltestCode } from "./b1-exam-readiness";

describe("b1-exam-readiness", () => {
  it("matches B1-MT codes", () => {
    expect(isB1ModelltestCode("B1-MT01")).toBe(true);
    expect(isB1ModelltestCode("B1-MT15")).toBe(true);
    expect(isB1ModelltestCode("A1-MT01")).toBe(false);
    expect(isB1ModelltestCode(null)).toBe(false);
  });

  it("scores OCR drafts with missing audio as not publishable", () => {
    const readiness = computeB1ExamReadiness({
      code: "B1-MT01",
      status: "draft",
      sections: [
        {
          skill: "hoeren",
          title: "Hören",
          questions: [
            {
              id: "1",
              prompt: "Teil 1",
              type: "listening",
              points: 0,
              metadata: {
                needs_review: true,
                transcription_status: "ocr_unverified",
                points_rubric: "provisional_needs_review",
                audio_slot: 1,
              },
            },
          ],
        },
        {
          skill: "schreiben",
          title: "Schreiben",
          questions: [
            {
              id: "2",
              prompt: "Aufgabe 1",
              type: "writing",
              points: 0,
              metadata: {
                needs_review: true,
                transcription_status: "ocr_unverified",
                import_mode: "schreiben_split",
                points_rubric: "provisional_needs_review",
              },
            },
          ],
        },
      ],
    });

    expect(readiness.examCode).toBe("B1-MT01");
    expect(readiness.questionCount).toBe(2);
    expect(readiness.pagesNeedingReview).toBe(2);
    expect(readiness.audioTotal).toBe(4);
    expect(readiness.audioReady).toBe(0);
    expect(readiness.audioVerified).toBe(0);
    expect(readiness.schreibenTasks).toBe(1);
    expect(readiness.confirmedAnswerKeys).toBe(0);
    expect(readiness.readyForPublish).toBe(false);
    expect(readiness.progress).toBeLessThan(100);
    expect(readiness.blockers.length).toBeGreaterThan(0);
  });

  it("does not credit unverified audio, placeholders, missing keys, or provisional scoring", () => {
    const readiness = computeB1ExamReadiness({
      code: "B1-MT02",
      status: "draft",
      sections: [
        {
          skill: "lesen",
          title: "Lesen",
          questions: [
            {
              id: "l1",
              prompt: "Frage 1 — OCR unvollständig",
              type: "true_false",
              points: 1,
              sort_order: 1,
              metadata: {
                transform_status: "placeholder",
                points_rubric: "provisional_needs_review",
                needs_review: true,
              },
              options: [
                { label: "a", value: "richtig" },
                { label: "b", value: "falsch" },
              ],
              answer_key: null,
            },
            {
              id: "l2",
              prompt: "Statement 2",
              type: "true_false",
              points: 1,
              sort_order: 2,
              metadata: {
                transform_status: "structured",
                points_rubric: "provisional_needs_review",
              },
              options: [
                { label: "a", value: "richtig" },
                { label: "b", value: "falsch" },
              ],
              answer_key: { correct_values: ["richtig"] },
            },
          ],
        },
        {
          skill: "hoeren",
          title: "Hören",
          questions: [
            {
              id: "h1",
              prompt: "Hören 1",
              type: "listening",
              points: 1,
              media_path: "exams/b1/audio.mp3",
              media_bucket: "course-materials",
              metadata: {
                audio_slot: 1,
                audio_verification_status: "unverified",
                points_rubric: "provisional_needs_review",
              },
              options: [{ label: "a", value: "a" }],
              answer_key: { correct_values: ["a"] },
            },
          ],
        },
      ],
    });

    expect(readiness.placeholderCount).toBeGreaterThanOrEqual(1);
    expect(readiness.missingKeysCount).toBeGreaterThanOrEqual(1);
    expect(readiness.audioReady).toBe(1);
    expect(readiness.audioVerified).toBe(0);
    expect(readiness.scoringStatus).toBe("provisional_needs_review");
    expect(readiness.readyForPublish).toBe(false);
    // Media present but unverified must not push progress to complete.
    expect(readiness.progress).toBeLessThan(70);
    expect(readiness.blockers.some((b) => /placeholder|Barème|clé|Audio/i.test(b))).toBe(true);
  });

  it("requires content_verified slots and official scoring for publish readiness", () => {
    const mkHoeren = (slot: number) => ({
      id: `h${slot}`,
      prompt: `Hören Teil ${slot}`,
      type: "listening" as const,
      points: 1,
      media_path: `exams/b1/t${slot}.mp3`,
      media_bucket: "course-materials",
      metadata: {
        audio_slot: slot,
        audio_verification_status: "content_verified",
        points_rubric: "official",
        points_basis: "official_pdf",
      },
      options: [
        { label: "a", value: "a" },
        { label: "b", value: "b" },
      ],
      answer_key: { correct_values: ["a"] },
    });

    const readiness = computeB1ExamReadiness({
      code: "B1-MT03",
      status: "draft",
      sections: [
        {
          skill: "lesen",
          title: "Lesen",
          questions: [
            {
              id: "l1",
              prompt: "Lesen 1",
              type: "true_false",
              points: 1,
              metadata: { points_rubric: "official", points_basis: "official_pdf" },
              options: [
                { label: "a", value: "richtig" },
                { label: "b", value: "falsch" },
              ],
              answer_key: { correct_values: ["richtig"] },
            },
          ],
        },
        {
          skill: "hoeren",
          title: "Hören",
          questions: [mkHoeren(1), mkHoeren(2), mkHoeren(3), mkHoeren(4)],
        },
      ],
    });

    expect(readiness.placeholderCount).toBe(0);
    expect(readiness.missingKeysCount).toBe(0);
    expect(readiness.audioVerified).toBe(4);
    expect(readiness.scoringStatus).toBe("official");
    expect(readiness.progress).toBeGreaterThan(80);
  });
});
