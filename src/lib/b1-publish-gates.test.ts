import { describe, expect, it } from "vitest";
import { computeB1ExamReadiness } from "./b1-exam-readiness";
import { validateExamCompleteness } from "./exam-completeness";

/**
 * Unit-level publish gates: readiness / completeness helpers must block publish
 * when audio is unverified, OCR needs_review, or scoring is provisional.
 */
describe("b1 publish gates (readiness + completeness)", () => {
  it("blocks publish when Hören audio is present but not content_verified", () => {
    const questions = [
      {
        id: "h1",
        prompt: "Hören Teil 1",
        type: "listening",
        points: 1,
        skill: "hoeren",
        sectionTitle: "Hören",
        media_bucket: "course-materials",
        media_path: "exams/b1/t1.mp3",
        metadata: {
          audio_slot: 1,
          audio_verification_status: "unverified",
        },
        correct_values: ["a"],
      },
    ];
    const report = validateExamCompleteness(questions);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes("Audio Hören non vérifié (contenu)"))).toBe(
      true,
    );

    const readiness = computeB1ExamReadiness({
      code: "B1-MT01",
      status: "draft",
      sections: [
        {
          skill: "hoeren",
          title: "Hören",
          questions: [
            {
              id: "h1",
              prompt: "Hören Teil 1",
              type: "listening",
              points: 1,
              media_bucket: "course-materials",
              media_path: "exams/b1/t1.mp3",
              metadata: {
                audio_slot: 1,
                audio_verification_status: "unverified",
                points_rubric: "official",
              },
              options: [{ label: "a", value: "a" }],
              answer_key: { correct_values: ["a"] },
            },
          ],
        },
      ],
    });
    expect(readiness.readyForPublish).toBe(false);
    expect(readiness.audioVerified).toBe(0);
  });

  it("blocks publish when needs_review / OCR flags remain", () => {
    const report = validateExamCompleteness([
      {
        id: "l1",
        prompt: "Lesen Sie",
        type: "true_false",
        points: 1,
        skill: "lesen",
        sectionTitle: "Lesen",
        metadata: { needs_review: true, transcription_status: "ocr_unverified" },
        correct_values: ["richtig"],
      },
    ]);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes("OCR non validé"))).toBe(true);

    const readiness = computeB1ExamReadiness({
      code: "B1-MT01",
      status: "draft",
      sections: [
        {
          skill: "lesen",
          title: "Lesen",
          questions: [
            {
              id: "l1",
              prompt: "Lesen Sie",
              type: "true_false",
              points: 1,
              metadata: {
                needs_review: true,
                transcription_status: "ocr_unverified",
                points_rubric: "official",
              },
              options: [
                { label: "a", value: "richtig" },
                { label: "b", value: "falsch" },
              ],
              answer_key: { correct_values: ["richtig"] },
            },
          ],
        },
      ],
    });
    expect(readiness.readyForPublish).toBe(false);
    expect(readiness.pagesNeedingReview).toBeGreaterThan(0);
  });

  it("blocks publish when points_rubric is provisional_needs_review", () => {
    const report = validateExamCompleteness([
      {
        id: "l1",
        prompt: "Frage",
        type: "true_false",
        points: 1,
        skill: "lesen",
        sectionTitle: "Lesen",
        metadata: { points_rubric: "provisional_needs_review" },
        correct_values: ["richtig"],
      },
    ]);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes("Barème provisoire"))).toBe(true);

    const readiness = computeB1ExamReadiness({
      code: "B1-MT05",
      status: "draft",
      sections: [
        {
          skill: "lesen",
          title: "Lesen",
          questions: [
            {
              id: "l1",
              prompt: "Frage",
              type: "true_false",
              points: 1,
              metadata: { points_rubric: "provisional_needs_review" },
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
          questions: [1, 2, 3, 4].map((slot) => ({
            id: `h${slot}`,
            prompt: `H ${slot}`,
            type: "listening",
            points: 1,
            media_path: `a${slot}.mp3`,
            media_bucket: "course-materials",
            metadata: {
              audio_slot: slot,
              audio_verification_status: "content_verified",
              points_rubric: "provisional_needs_review",
            },
            options: [{ label: "a", value: "a" }],
            answer_key: { correct_values: ["a"] },
          })),
        },
      ],
    });
    expect(readiness.scoringStatus).toBe("provisional_needs_review");
    expect(readiness.readyForPublish).toBe(false);
    expect(readiness.blockers.some((b) => /Barème/i.test(b))).toBe(true);
  });

  it("blocks publish on Placeholder OCR", () => {
    const report = validateExamCompleteness([
      {
        id: "p1",
        prompt: "Frage 8 — OCR unvollständig",
        type: "single_choice",
        points: 1,
        skill: "lesen",
        sectionTitle: "Lesen",
        metadata: { transform_status: "placeholder" },
        correct_values: ["a"],
      },
    ]);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes("Placeholder OCR"))).toBe(true);
  });
});
