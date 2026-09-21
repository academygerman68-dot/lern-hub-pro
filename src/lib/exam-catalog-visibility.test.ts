import { describe, expect, it } from "vitest";
import { shellNavPageIds } from "@/components/academy/shell";
import { isPageForRole } from "./academy-logic";
import {
  EXAM_BLANCS_PAGES_BY_ROLE,
  resolvePublishedExamCatalog,
} from "./exam-catalog-visibility";

describe("resolvePublishedExamCatalog", () => {
  /** Must match the published A1 bank already in DB (never re-seed to "fix" empty catalog). */
  const exams = [
    { id: "a1-01", title: "Examen blanc A1-01", subtitle: "Alltag & Familie" },
    { id: "a1-02", title: "Examen blanc A1-02", subtitle: "Reisen & Termine" },
    { id: "a1-03", title: "Examen blanc A1-03", subtitle: "Wohnen & Freizeit" },
  ];

  it("returns all published exams when no completeness probes are provided", () => {
    expect(resolvePublishedExamCatalog(exams)).toEqual(exams);
    expect(resolvePublishedExamCatalog(exams, null)).toEqual(exams);
  });

  it("fail-opens when any completeness probe errors (must not empty the catalog)", () => {
    // Regression: missing exam_is_complete RPC must not hide A1-01/02/03.
    const probes = [
      { complete: false, errored: true },
      { complete: false, errored: true },
      { complete: false, errored: true },
    ];
    const catalog = resolvePublishedExamCatalog(exams, probes);
    expect(catalog).toHaveLength(3);
    expect(catalog.map((e) => e.title)).toEqual([
      "Examen blanc A1-01",
      "Examen blanc A1-02",
      "Examen blanc A1-03",
    ]);
  });

  it("still lists published exams even if probes report incomplete", () => {
    const probes = [
      { complete: false, errored: false },
      { complete: true, errored: false },
      { complete: false, errored: false },
    ];
    expect(resolvePublishedExamCatalog(exams, probes)).toEqual(exams);
  });

  it("never silently drops the A1 published bank via completeness filtering", () => {
    expect(resolvePublishedExamCatalog(exams).map((e) => e.subtitle)).toEqual([
      "Alltag & Familie",
      "Reisen & Termine",
      "Wohnen & Freizeit",
    ]);
  });
});

describe("Examens blancs navigation pages", () => {
  it("keeps exams routes for student, teacher and admin/director", () => {
    for (const page of EXAM_BLANCS_PAGES_BY_ROLE.student) {
      expect(isPageForRole("student", page)).toBe(true);
    }
    for (const page of EXAM_BLANCS_PAGES_BY_ROLE.teacher) {
      expect(isPageForRole("teacher", page)).toBe(true);
    }
    for (const page of EXAM_BLANCS_PAGES_BY_ROLE.director) {
      expect(isPageForRole("director", page)).toBe(true);
    }
  });

  it("keeps corrections complementary without removing exams", () => {
    expect(isPageForRole("teacher", "corrections")).toBe(true);
    expect(isPageForRole("director", "corrections")).toBe(true);
    expect(isPageForRole("teacher", "exams")).toBe(true);
    expect(isPageForRole("director", "exams")).toBe(true);
  });

  it("keeps Examens blancs in Student / Teacher / Admin sidebars", () => {
    expect(shellNavPageIds("student")).toContain("exams");
    expect(shellNavPageIds("teacher")).toContain("exams");
    expect(shellNavPageIds("director")).toContain("exams");
    expect(shellNavPageIds("teacher")).toContain("corrections");
    expect(shellNavPageIds("director")).toContain("corrections");
  });
});
