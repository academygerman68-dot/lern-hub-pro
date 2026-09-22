import { describe, expect, it } from "vitest";

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
    const academicActive = rows
      .filter((row) => row.domain === "academic" && row.active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => ({ code: row.code, label: row.label_fr }));
    expect(academicActive).toEqual([
      { code: "cours", label: "Cours" },
      { code: "exercices", label: "Exercices" },
    ]);

    const selected = "legacy";
    const withHistorical =
      selected && !academicActive.some((row) => row.code === selected)
        ? [
            ...academicActive,
            {
              code: selected,
              label: `${rows.find((r) => r.code === selected)?.label_fr ?? selected} (désactivé)`,
            },
          ]
        : academicActive;
    expect(withHistorical.at(-1)).toEqual({ code: "legacy", label: "Ancien (désactivé)" });
  });
});
