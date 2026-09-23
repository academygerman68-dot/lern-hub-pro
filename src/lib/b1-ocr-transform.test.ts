import { describe, expect, it } from "vitest";
import {
  classifyLesenBundle,
  detectSprechenRole,
  splitSchreibenPageBundle,
} from "./b1-ocr-transform";

describe("b1-ocr-transform — glued Aufgabe markers", () => {
  it("splits Aufgabe2Arbeitszeit glued OCR into structured tasks", () => {
    const glued = `SCHREIBEN
Aufgabe1Arbeitszeit:20Minuten
Schreiben Sie eine E-Mail (circa 80 Wörter).
- Bedanken Sie sich.
Aufgabe2Arbeitszeit:25Minuten
Schreiben Sie Ihre Meinung (circa 80 Wörter).
Aufgabe3Arbeitszit:15Minuten
Schreiben Sie eine E-Mail (circa 40 Wörter).
`;

    const tasks = splitSchreibenPageBundle(glued);
    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.idSuffix)).toEqual(["A1", "A2", "A3"]);
    expect(tasks.every((t) => t.transform_status === "structured")).toBe(true);
    expect(tasks.every((t) => t.needs_review === true)).toBe(true);
    expect(tasks[0]!.recommended_words).toMatch(/80/);
    expect(tasks[2]!.recommended_words).toMatch(/40/);
  });

  it("marks partial Aufgabe splits as needs_review transform_status", () => {
    const partial = `Aufgabe1Arbeitszeit:20Minuten
Text A
Aufgabe2Arbeitszeit:25Minuten
Text B
`;
    const tasks = splitSchreibenPageBundle(partial);
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.transform_status === "needs_review")).toBe(true);
  });
});

describe("b1-ocr-transform — sprechen roles", () => {
  it("detects Kandidat A/B and truncated OCR roles", () => {
    expect(detectSprechenRole("Kandidat A\nTeil 2")).toBe("A");
    expect(detectSprechenRole("Kandidat B\nTeil 2")).toBe("B");
    expect(detectSprechenRole("SPRECHEN\nandidat\nTeil2")).toBe("A");
    expect(detectSprechenRole("Kandida\nSPRECHEN\nB\nTeil2")).toBe("B");
    expect(detectSprechenRole("Kandid\nGemeinsam")).toBe("B");
    expect(detectSprechenRole("Teil 1\nSPRECHEN\nGemeinsam")).toBeNull();
  });
});

describe("b1-ocr-transform — lesen classification", () => {
  it("classifies bundles without inventing options", () => {
    const result = classifyLesenBundle("Richtig oder falsch?\nDer Text…");
    expect(result.needs_review).toBe(true);
    expect(result.suggestedType).toBeTruthy();
    expect(result).not.toHaveProperty("options");
    expect(result).not.toHaveProperty("answer_key");
  });
});
