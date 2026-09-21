import { describe, expect, it } from "vitest";
import { examCatalogAction, examQuestionTypeLabel, examSkillLabel } from "./exam-labels";

describe("exam labels", () => {
  it("maps question types without raw codes in UI labels", () => {
    expect(examQuestionTypeLabel("true_false")).toBe("Vrai / Faux");
    expect(examQuestionTypeLabel("single_choice")).toBe("Choix unique");
    expect(examQuestionTypeLabel("multiple_choice")).toBe("Choix multiple");
    expect(examQuestionTypeLabel("writing")).toBe("Rédaction");
    expect(examQuestionTypeLabel("listening")).toBe("Écoute");
  });

  it("maps skills to french section names", () => {
    expect(examSkillLabel("lesen")).toBe("Lecture");
    expect(examSkillLabel("hoeren")).toBe("Écoute");
    expect(examSkillLabel("schreiben")).toBe("Écriture");
  });

  it("catalog actions never resume without in_progress", () => {
    expect(examCatalogAction({ latestStatus: null, hasUngradedWriting: false })).toEqual({
      label: "À faire",
      cta: "Démarrer",
      action: "start",
    });
    expect(examCatalogAction({ latestStatus: "in_progress", hasUngradedWriting: false })).toEqual({
      label: "En cours",
      cta: "Reprendre",
      action: "resume",
    });
    expect(examCatalogAction({ latestStatus: "submitted", hasUngradedWriting: true })).toEqual({
      label: "En attente de correction",
      cta: "Voir le résultat provisoire",
      action: "provisional",
    });
    expect(examCatalogAction({ latestStatus: "graded", hasUngradedWriting: false })).toEqual({
      label: "Terminé",
      cta: "Voir mes résultats",
      action: "final",
    });
    expect(examCatalogAction({ latestStatus: "graded", hasUngradedWriting: true }).action).toBe(
      "provisional",
    );
    expect(examCatalogAction({ latestStatus: "expired", hasUngradedWriting: false }).cta).toBe(
      "Voir le résultat provisoire",
    );
  });
});
