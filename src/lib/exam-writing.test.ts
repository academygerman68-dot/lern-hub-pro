import { describe, expect, it } from "vitest";
import {
  attemptGradingStatus,
  canRetakeExam,
  combineExamScore,
  countCompletedExamAttempts,
  countWritingStats,
  examAttemptsLeft,
  filterGroupsByLevel,
  groupAverage,
  isManualQuestionType,
  studentExamProgressLabel,
} from "./exam-writing";

describe("writing stats", () => {
  it("counts words and characters", () => {
    expect(countWritingStats("Hallo Welt")).toEqual({ characters: 10, words: 2 });
    expect(countWritingStats("   ")).toEqual({ characters: 3, words: 0 });
  });
});

describe("exam final score with QCM + writing", () => {
  it("combines objective and writing points", () => {
    expect(combineExamScore(8, 4, 20)).toEqual({ score: 12, percentage: 60 });
  });

  it("computes group average", () => {
    expect(groupAverage([80, 60, 70])).toBe(70);
    expect(groupAverage([])).toBeNull();
  });

  it("flags manual question types", () => {
    expect(isManualQuestionType("writing")).toBe(true);
    expect(isManualQuestionType("text")).toBe(true);
    expect(isManualQuestionType("speaking")).toBe(true);
    expect(isManualQuestionType("single_choice")).toBe(false);
    expect(isManualQuestionType("form_fill")).toBe(false);
  });

  it("maps grading status", () => {
    expect(attemptGradingStatus("graded", false)).toBe("corrigé");
    expect(attemptGradingStatus("submitted", true)).toBe("non corrigé");
  });

  it("maps student progress labels", () => {
    expect(studentExamProgressLabel(null, false)).toBe("À faire");
    expect(studentExamProgressLabel("in_progress", false)).toBe("En cours");
    expect(studentExamProgressLabel("submitted", true)).toBe("En attente de correction");
    expect(studentExamProgressLabel("graded", false)).toBe("Terminé");
    expect(studentExamProgressLabel("graded", true)).toBe("En attente de correction");
  });

  it("counts completed attempts and allows retake under max_attempts", () => {
    const attempts = [
      { exam_id: "e1", status: "graded" },
      { exam_id: "e1", status: "submitted" },
      { exam_id: "e1", status: "in_progress" },
      { exam_id: "e2", status: "graded" },
    ];
    expect(countCompletedExamAttempts(attempts, "e1")).toBe(2);
    expect(examAttemptsLeft(2, 3)).toBe(1);
    expect(
      canRetakeExam({ latestStatus: "graded", completedAttempts: 2, maxAttempts: 3 }),
    ).toBe(true);
    expect(
      canRetakeExam({ latestStatus: "graded", completedAttempts: 3, maxAttempts: 3 }),
    ).toBe(false);
    expect(
      canRetakeExam({ latestStatus: "in_progress", completedAttempts: 1, maxAttempts: 3 }),
    ).toBe(false);
  });
});

describe("Niveau → Groupe selectors", () => {
  it("filters groups by level", () => {
    const groups = [
      { id: "1", levelId: "a1", name: "A1-SEP-2026" },
      { id: "2", levelId: "a1", name: "A1-OCT-2026" },
      { id: "3", levelId: "b1", name: "B1-SEP-2026" },
    ];
    expect(filterGroupsByLevel(groups, "a1").map((g) => g.name)).toEqual([
      "A1-SEP-2026",
      "A1-OCT-2026",
    ]);
  });
});
