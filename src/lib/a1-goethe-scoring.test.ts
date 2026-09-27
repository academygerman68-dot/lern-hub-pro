import { describe, expect, it } from "vitest";
import {
  A1_PASS_SCORE_100,
  A1_RAW_MAX,
  a1ConversionTable,
  a1MentionFromHundred,
  a1PassedFromHundred,
  convertA1RawToHundred,
  isGoetheA1AdultProfile,
  SCHREIBEN_TEIL2_ALLOWED,
  summarizeA1Result,
} from "./a1-goethe-scoring";

describe("a1 goethe scoring", () => {
  it("detects goethe_a1_adult_v1 and A1-SIM codes", () => {
    expect(isGoetheA1AdultProfile({ format_profile: "goethe_a1_adult_v1" })).toBe(true);
    expect(isGoetheA1AdultProfile({ code: "A1-SIM-01" })).toBe(true);
    expect(isGoetheA1AdultProfile({ code: "B1-MT01" })).toBe(false);
  });

  it("converts raw 60 to 100 and applies pass threshold", () => {
    expect(convertA1RawToHundred(60)).toBe(100);
    expect(convertA1RawToHundred(36)).toBe(60);
    expect(convertA1RawToHundred(0)).toBe(0);
    expect(A1_RAW_MAX).toBe(60);
    expect(a1PassedFromHundred(60)).toBe(true);
    expect(a1PassedFromHundred(59)).toBe(false);
    expect(A1_PASS_SCORE_100).toBe(60);
  });

  it("rounds every integer raw score 0..60 with half-up ×1.66 (60→100 exactly)", () => {
    const table = a1ConversionTable();
    expect(table).toHaveLength(61);
    expect(table[0]).toEqual({ raw: 0, score100: 0 });
    expect(table[36]).toEqual({ raw: 36, score100: 60 });
    expect(table[60]).toEqual({ raw: 60, score100: 100 });
    for (const { raw, score100 } of table) {
      expect(score100).toBe(Math.round(raw * 1.66));
      expect(score100).toBeGreaterThanOrEqual(0);
      expect(score100).toBeLessThanOrEqual(100);
    }
    // Guard against the buggy round(..., 2) SQL path that yielded 99.60.
    expect(Number((60 * 1.66).toFixed(2))).toBe(99.6);
    expect(convertA1RawToHundred(60)).not.toBe(99.6);
  });

  it("assigns mentions from /100 score", () => {
    expect(a1MentionFromHundred(95)).toBe("sehr gut");
    expect(a1MentionFromHundred(85)).toBe("gut");
    expect(a1MentionFromHundred(75)).toBe("befriedigend");
    expect(a1MentionFromHundred(65)).toBe("ausreichend");
    expect(a1MentionFromHundred(50)).toBe("nicht bestanden");
  });

  it("summarizes provisional vs final", () => {
    const provisional = summarizeA1Result({
      rawBySkill: { hoeren: 15, lesen: 15, schreiben: 10, sprechen: 0 },
      awaitingManual: true,
    });
    expect(provisional.rawTotal).toBe(40);
    expect(provisional.score100).toBe(66);
    expect(provisional.provisional).toBe(true);

    const full = summarizeA1Result({
      rawBySkill: { hoeren: 15, lesen: 15, schreiben: 15, sprechen: 15 },
      awaitingManual: false,
    });
    expect(full.score100).toBe(100);
    expect(full.passed).toBe(true);
    expect(full.mention).toBe("sehr gut");
  });

  it("keeps discrete Schreiben Teil 2 allowed scores", () => {
    expect(SCHREIBEN_TEIL2_ALLOWED["content_point_1"]).toEqual([0, 1.5, 3]);
    expect(SCHREIBEN_TEIL2_ALLOWED["communicative_design"]).toEqual([0, 0.5, 1]);
  });
});
