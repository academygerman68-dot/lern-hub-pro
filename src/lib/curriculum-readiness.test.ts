import { describe, expect, it } from "vitest";
import { courseLevelCoverage, examInventory } from "@/lib/curriculum-readiness";

describe("A1–B2 coverage and exam readiness", () => {
  it("does not mark any CEFR level as a complete course", () => {
    const coverage = courseLevelCoverage();
    expect(coverage.map((item) => item.level)).toEqual(["A1", "A2", "B1", "B2"]);
    expect(coverage.every((item) => item.persistedSkeleton && !item.pedagogicallyComplete)).toBe(
      true,
    );
  });

  it("keeps incomplete exams unavailable and historical A1 banks partial", () => {
    const exams = examInventory();
    expect(exams.filter((item) => item.status === "published-historical-partial")).toHaveLength(3);
    expect(exams.find((item) => item.code === "A1-SIM-01")?.sittable).toBe(false);
    expect(exams.filter((item) => item.status === "blocked-ocr")).toHaveLength(15);
    expect(exams.find((item) => item.code === "A2-SIM-01")?.sittable).toBe(false);
    expect(exams.find((item) => item.level === "B2")?.sittable).toBe(false);
    expect(exams.filter((item) => item.sittable).every((item) => item.level === "A1")).toBe(true);
  });
});
