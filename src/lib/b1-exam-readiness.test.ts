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
              },
            },
          ],
        },
      ],
    });

    expect(readiness.examCode).toBe("B1-MT01");
    expect(readiness.questionCount).toBe(2);
    expect(readiness.pagesNeedingReview).toBe(2);
    expect(readiness.audioTotal).toBe(1);
    expect(readiness.audioReady).toBe(0);
    expect(readiness.schreibenTasks).toBe(1);
    expect(readiness.confirmedAnswerKeys).toBe(0);
    expect(readiness.readyForPublish).toBe(false);
    expect(readiness.progress).toBeLessThan(100);
    expect(readiness.blockers.length).toBeGreaterThan(0);
  });
});
