import { describe, expect, it } from "vitest";
import { computeFinalAmount } from "@/services/supabase/payment-service";
import {
  buildTeacherScope,
  scopedClassOrLevelItemVisible,
  scopedLibraryItemVisible,
} from "@/lib/academy-logic";
import { validateFileForKind, isValidHttpUrl } from "@/lib/academic-content";

describe("payment amount helpers", () => {
  it("applies percent and fixed discounts", () => {
    expect(computeFinalAmount(1000, "percent", 10)).toBe(900);
    expect(computeFinalAmount(1000, "fixed", 150)).toBe(850);
  });
});

describe("teacher scope for groups", () => {
  const scope = buildTeacherScope([
    { id: "c1", levelId: "l1", level: "A1" },
    { id: "c2", levelId: "l2", level: "B1" },
  ]);

  it("allows class-targeted items for assigned groups only", () => {
    expect(scopedClassOrLevelItemVisible({ class_id: "c1", level_id: "l1" }, scope)).toBe(true);
    expect(scopedClassOrLevelItemVisible({ class_id: "other", level_id: "l1" }, scope)).toBe(false);
  });

  it("scopes library items by audience class", () => {
    expect(
      scopedLibraryItemVisible({ audience: "class", class_id: "c1", level_code: "A1" }, scope),
    ).toBe(true);
    expect(
      scopedLibraryItemVisible({ audience: "everyone", class_id: null, level_code: null }, scope),
    ).toBe(true);
  });
});

describe("file validation for submissions and proofs", () => {
  it("accepts pdf for document/pdf kinds", () => {
    const file = new File(["x"], "devoir.pdf", { type: "application/pdf" });
    expect(validateFileForKind(file, "pdf")).toBeNull();
  });

  it("rejects invalid urls", () => {
    expect(isValidHttpUrl("not-a-url")).toBe(false);
    expect(isValidHttpUrl("https://example.com/doc")).toBe(true);
  });
});

describe("payment proof SLA copy", () => {
  it("computes 48h deadline from submission", () => {
    const submitted = new Date("2026-09-18T10:00:00.000Z");
    const deadline = new Date(submitted.getTime() + 48 * 60 * 60 * 1000);
    expect(deadline.toISOString()).toBe("2026-09-20T10:00:00.000Z");
  });
});
