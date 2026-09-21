import { describe, expect, it } from "vitest";
import {
  applySuggestionToWritingRubric,
  GRADE_ASSIST_NEEDS_TEXT_MESSAGE,
  GRADE_ASSIST_UNCONFIGURED_MESSAGE,
  gradeAssistCriteriaLabel,
  gradeAssistNeedsExploitableText,
  mapGradeAssistErrorCode,
} from "./grade-assist-ux";

describe("grade-assist UX helpers", () => {
  it("keeps the unconfigured message stable for UI", () => {
    expect(GRADE_ASSIST_UNCONFIGURED_MESSAGE).toBe(
      "Le service de correction IA n'est pas encore configuré.",
    );
  });

  it("does not map generic Edge Function failures to unconfigured", () => {
    expect(mapGradeAssistErrorCode("GEMINI_AUTH_ERROR")).not.toBe(GRADE_ASSIST_UNCONFIGURED_MESSAGE);
    expect(mapGradeAssistErrorCode("GEMINI_MODEL_ERROR")).not.toBe(GRADE_ASSIST_UNCONFIGURED_MESSAGE);
    expect(mapGradeAssistErrorCode("GEMINI_PROVIDER_ERROR")).not.toBe(
      GRADE_ASSIST_UNCONFIGURED_MESSAGE,
    );
    expect(mapGradeAssistErrorCode("GEMINI_NOT_CONFIGURED")).toBe(GRADE_ASSIST_UNCONFIGURED_MESSAGE);
  });

  it("requires exploitable text when only a file is present", () => {
    expect(gradeAssistNeedsExploitableText("", true)).toBe(true);
    expect(gradeAssistNeedsExploitableText("  ", true)).toBe(true);
    expect(gradeAssistNeedsExploitableText("Hallo", true)).toBe(false);
    expect(gradeAssistNeedsExploitableText("", false)).toBe(false);
    expect(GRADE_ASSIST_NEEDS_TEXT_MESSAGE.length).toBeGreaterThan(20);
  });

  it("labels writing criteria in French", () => {
    expect(gradeAssistCriteriaLabel("task_completion")).toBe("Respect de la consigne");
    expect(gradeAssistCriteriaLabel("comprehensibility")).toBe("Compréhensibilité");
    expect(gradeAssistCriteriaLabel("vocabulary")).toBe("Vocabulaire");
    expect(gradeAssistCriteriaLabel("grammar_and_spelling")).toBe("Grammaire / orthographe");
  });

  it("maps criteria scores onto the writing rubric without exceeding maxima", () => {
    const mapped = applySuggestionToWritingRubric({
      suggestedScore: 8,
      criteriaScores: {
        task_completion: 3.5,
        comprehensibility: 2,
        vocabulary: 1.5,
        grammar_and_spelling: 1,
      },
      rubric: {
        task_completion: 4,
        comprehensibility: 2,
        vocabulary: 2,
        grammar_and_spelling: 2,
      },
      questionPoints: 10,
    });
    expect(mapped).toEqual({
      task_completion: "3.5",
      comprehensibility: "2",
      vocabulary: "1.5",
      grammar_and_spelling: "1",
    });
  });

  it("distributes a total score when criteria are missing", () => {
    const mapped = applySuggestionToWritingRubric({
      suggestedScore: 8,
      criteriaScores: {},
      rubric: {
        task_completion: 4,
        comprehensibility: 2,
        vocabulary: 2,
        grammar_and_spelling: 2,
      },
      questionPoints: 10,
    });
    const sum =
      Number(mapped["task_completion"]) +
      Number(mapped["comprehensibility"]) +
      Number(mapped["vocabulary"]) +
      Number(mapped["grammar_and_spelling"]);
    expect(sum).toBeCloseTo(8, 1);
    expect(Number(mapped["task_completion"])).toBeLessThanOrEqual(4);
  });
});
