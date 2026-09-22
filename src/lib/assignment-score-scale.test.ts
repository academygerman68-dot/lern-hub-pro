import { describe, expect, it } from "vitest";
import {
  formatGradedScore,
  normalizeScoreScale,
  parseCustomMaxScore,
  scoreScaleChangedWarning,
} from "./assignment-score-scale";

describe("assignment-score-scale", () => {
  it("normalizes presets and custom positive values", () => {
    expect(normalizeScoreScale(20)).toEqual({ kind: "preset", max: 20, label: "/20" });
    expect(normalizeScoreScale(15)).toEqual({ kind: "custom", max: 15, label: "/15" });
    expect(parseCustomMaxScore("12,5")).toBe(12.5);
    expect(parseCustomMaxScore("-1")).toBeNull();
  });

  it("never silently reinterprets a grade after scale change", () => {
    expect(formatGradedScore({ score: 14, gradedMaxScore: 20, currentMaxScore: 100 })).toBe(
      "14 / 20",
    );
    expect(
      scoreScaleChangedWarning({ gradedMaxScore: 20, currentMaxScore: 100 }),
    ).toContain("n’a pas été recalculée");
  });
});
