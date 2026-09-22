import { describe, expect, it } from "vitest";
import {
  applySuggestionToWritingRubric,
  clampGradeAssistScore,
  GRADE_ASSIST_NEEDS_TEXT_MESSAGE,
  GRADE_ASSIST_UNCONFIGURED_MESSAGE,
  gradeAssistCriteriaLabel,
  gradeAssistNeedsExploitableText,
  mapGradeAssistErrorCode,
  normalizeGradeAssistErrorCategory,
  parseGradeAssistCriteria,
  parseGradeAssistErrors,
  parseOptionalModelAnswer,
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
    expect(mapGradeAssistErrorCode("GEMINI_MODEL_ERROR", "models/gemini-2.5-flash is no longer available")).toMatch(
      /indisponible/i,
    );
    expect(mapGradeAssistErrorCode("GEMINI_RATE_LIMIT")).toMatch(/saturé|Réessayez/i);
    expect(mapGradeAssistErrorCode("GEMINI_PROVIDER_ERROR")).not.toBe(
      GRADE_ASSIST_UNCONFIGURED_MESSAGE,
    );
    expect(mapGradeAssistErrorCode("GEMINI_NOT_CONFIGURED")).toBe(GRADE_ASSIST_UNCONFIGURED_MESSAGE);
  });

  it("requires exploitable text only for non-multimodal file-only remises", () => {
    expect(gradeAssistNeedsExploitableText("", true, "doc.docx")).toBe(true);
    expect(gradeAssistNeedsExploitableText("  ", true, "notes.bin")).toBe(true);
    expect(gradeAssistNeedsExploitableText("", true, "scan.png")).toBe(false);
    expect(gradeAssistNeedsExploitableText("", true, "devoir.pdf")).toBe(false);
    expect(gradeAssistNeedsExploitableText("Hallo", true)).toBe(false);
    expect(gradeAssistNeedsExploitableText("", false)).toBe(false);
    expect(GRADE_ASSIST_NEEDS_TEXT_MESSAGE.length).toBeGreaterThan(20);
  });

  it("maps unreadable attachment errors", () => {
    expect(mapGradeAssistErrorCode("UNREADABLE_ATTACHMENT")).toMatch(/analysable|manuellement/i);
  });

  it("labels writing criteria in French", () => {
    expect(gradeAssistCriteriaLabel("task_completion")).toBe("Respect de la consigne");
    expect(gradeAssistCriteriaLabel("comprehensibility")).toBe("Compréhensibilité");
    expect(gradeAssistCriteriaLabel("vocabulary")).toBe("Vocabulaire");
    expect(gradeAssistCriteriaLabel("grammar_and_spelling")).toBe("Grammaire / orthographe");
  });

  it("clamps suggested scores within 0..max_score", () => {
    expect(clampGradeAssistScore(-2, 10)).toBe(0);
    expect(clampGradeAssistScore(12, 10)).toBe(10);
    expect(clampGradeAssistScore(7.26, 10)).toBe(7.3);
  });

  it("parses criteria with labels and max_score", () => {
    const criteria = parseGradeAssistCriteria(
      [
        { label: "Respect de la consigne", score: 22, max_score: 25 },
        { id: "vocabulary", score: 18, max: 25 },
        { label: "bad", score: "x", max_score: 25 },
      ],
      100,
    );
    expect(criteria).toEqual([
      { label: "Respect de la consigne", score: 22, max_score: 25 },
      { id: "vocabulary", label: "Vocabulaire", score: 18, max_score: 25 },
    ]);
  });

  it("parses errors[] and drops incomplete rows", () => {
    const errors = parseGradeAssistErrors([
      {
        category: "word_order",
        original: "Am Samstag wir gehen",
        correction: "Am Samstag gehen wir",
        explanation: "Verbe en 2e position.",
      },
      {
        category: "Temps verbal",
        original: "wir haben Fußball spielen",
        correction: "haben wir Fußball gespielt",
        explanation: "Participe passé requis.",
      },
      { category: "Autre", original: "x", correction: "", explanation: "y" },
    ]);
    expect(errors).toHaveLength(2);
    expect(errors[0]?.category).toBe("Ordre des mots");
    expect(errors[1]?.category).toBe("Temps verbal");
  });

  it("returns empty errors when omitted", () => {
    expect(parseGradeAssistErrors(undefined)).toEqual([]);
    expect(parseGradeAssistErrors(null)).toEqual([]);
  });

  it("treats missing model_answer as optional", () => {
    expect(parseOptionalModelAnswer(undefined)).toBeNull();
    expect(parseOptionalModelAnswer("")).toBeNull();
    expect(parseOptionalModelAnswer("  Am Wochenende...  ")).toBe("Am Wochenende...");
  });

  it("normalizes error categories", () => {
    expect(normalizeGradeAssistErrorCategory("Cas / déclinaison")).toBe("Cas / déclinaison");
    expect(normalizeGradeAssistErrorCategory("conjugation")).toBe("Conjugaison");
    expect(normalizeGradeAssistErrorCategory("")).toBe("Autre");
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
