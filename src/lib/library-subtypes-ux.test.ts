import { describe, expect, it } from "vitest";
import { subtypeOptionsForDomain } from "./library-resources";

/** Regression: subtypes are domain-scoped catalogue rows, not hardcoded form options. */
describe("library subtypes catalogue", () => {
  it("maps active subtype rows to select options by domain", () => {
    const rows = [
      { domain: "academic", code: "cours", label_fr: "Cours", active: true, sort_order: 10 },
      { domain: "academic", code: "exercices", label_fr: "Exercices", active: true, sort_order: 20 },
      {
        domain: "professional",
        code: "visa",
        label_fr: "Visa",
        active: true,
        sort_order: 10,
      },
      {
        domain: "academic",
        code: "legacy",
        label_fr: "Ancien",
        active: false,
        sort_order: 99,
      },
    ];
    const academicActive = subtypeOptionsForDomain(rows, "academic");
    expect(academicActive).toEqual([
      { code: "cours", label: "Cours" },
      { code: "exercices", label: "Exercices" },
    ]);
    expect(subtypeOptionsForDomain(rows, "academic", "legacy").at(-1)).toEqual({
      code: "legacy",
      label: "Ancien (désactivé)",
    });
  });
});
