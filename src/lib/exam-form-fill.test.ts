import { describe, expect, it } from "vitest";
import {
  normalizeFormFillValue,
  sanitizeQuestionMetadataForStudent,
  scoreFormFillAnswer,
} from "./exam-form-fill";

describe("form fill helpers", () => {
  it("normalizes trim, case and whitespace", () => {
    expect(normalizeFormFillValue("  Adam  ")).toBe("adam");
    expect(normalizeFormFillValue("El\u00a0Mansouri")).toBe("el mansouri");
    expect(normalizeFormFillValue("A  B")).toBe("a b");
  });

  it("scores fields against source data", () => {
    const result = scoreFormFillAnswer({
      fields: [
        { key: "Vorname", points: 2 },
        { key: "Nachname", points: 2 },
      ],
      sourceData: { Vorname: "Adam", Nachname: "El Mansouri" },
      answer: { Vorname: " adam ", Nachname: "wrong" },
    });
    expect(result.awarded).toBe(2);
    expect(result.max).toBe(4);
    expect(result.fieldResults).toEqual({ Vorname: true, Nachname: false });
  });

  it("sanitizes student secrets from metadata", () => {
    const safe = sanitizeQuestionMetadataForStudent({
      instruction: "Fill the form",
      passage: "text",
      audio_url: "https://example.com/a.mp3",
      audio_script: "SECRET SCRIPT",
      source_data: { Vorname: "Adam" },
      sample_answer: "secret sample",
      explanation: "secret explanation",
      correct_answer: "Richtig",
      teacher_payload: { hidden: true },
      fields: [{ key: "Vorname", points: 2 }],
    });
    expect(safe).toEqual({
      instruction: "Fill the form",
      passage: "text",
      audio_url: "https://example.com/a.mp3",
      fields: [{ key: "Vorname", points: 2 }],
    });
    expect(safe).not.toHaveProperty("audio_script");
    expect(safe).not.toHaveProperty("source_data");
    expect(safe).not.toHaveProperty("sample_answer");
    expect(safe).not.toHaveProperty("explanation");
    expect(safe).not.toHaveProperty("correct_answer");
  });
});
