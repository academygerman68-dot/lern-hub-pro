import { describe, expect, it } from "vitest";
import { studentNextStep } from "./student-next-step";

describe("studentNextStep", () => {
  it("prefers an open exam attempt over assignments", () => {
    expect(
      studentNextStep({
        hasInProgressExam: true,
        dueAssignmentCount: 2,
        availableExamCount: 1,
      }).page,
    ).toBe("exams");
  });

  it("points to assignments when nothing is in progress", () => {
    const step = studentNextStep({
      hasInProgressExam: false,
      dueAssignmentCount: 1,
      availableExamCount: 3,
    });
    expect(step.page).toBe("assignments");
    expect(step.detail).toContain("1 devoir");
  });

  it("falls back to courses when there is no exam and no assignment", () => {
    expect(
      studentNextStep({
        hasInProgressExam: false,
        dueAssignmentCount: 0,
        availableExamCount: 0,
      }).page,
    ).toBe("courses");
  });
});
