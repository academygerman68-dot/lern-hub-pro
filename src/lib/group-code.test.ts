import { describe, expect, it } from "vitest";
import {
  buildGroupCodeParts,
  formatGroupCodeWithTeacher,
  periodCodeFromDate,
  suggestGroupCode,
  teacherInitials,
} from "./group-code";

describe("group-code", () => {
  it("builds A1-SEP26-WB-01 style codes", () => {
    const parts = buildGroupCodeParts({
      levelCode: "A1",
      periodCode: "SEP26",
      teacherName: "Warda Benali",
      sequence: 1,
    });
    expect(parts.code).toBe("A1-SEP26-WB-01");
    expect(teacherInitials("Warda Benali")).toBe("WB");
  });

  it("handles single-word names and accents", () => {
    expect(teacherInitials("Émile")).toBe("EM");
    expect(teacherInitials("José María")).toBe("JM");
  });

  it("increments sequence on collision of initials", () => {
    const code = suggestGroupCode({
      levelCode: "A1",
      teacherName: "Warda Benali",
      periodCode: "SEP26",
      existingReferences: ["A1-SEP26-WB-01", "A1-SEP26-WB-02", "B1-SEP26-WB-01"],
    });
    expect(code).toBe("A1-SEP26-WB-03");
  });

  it("does not rewrite unrelated existing references", () => {
    const code = suggestGroupCode({
      levelCode: "B1",
      teacherName: "Ali Karim",
      periodCode: "OCT26",
      existingReferences: ["LEGACY-GROUP-X", "A1-SEP26-WB-01"],
    });
    expect(code).toBe("B1-OCT26-AK-01");
  });

  it("formats teacher beside code", () => {
    expect(formatGroupCodeWithTeacher("A1-SEP26-WB-01", "Warda Benali")).toBe(
      "A1-SEP26-WB-01 · Warda Benali",
    );
    expect(periodCodeFromDate(new Date("2026-09-15T12:00:00Z"))).toBe("SEP26");
  });
});
