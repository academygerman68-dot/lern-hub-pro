import type { studentExamProgressLabel } from "./exam-writing";

export type ExamQuestionTypeLabel =
  | "Vrai / Faux"
  | "Choix unique"
  | "Choix multiple"
  | "Écoute"
  | "Expression écrite"
  | "Expression orale"
  | "Formulaire"
  | "Texte"
  | "Question";

export function examQuestionTypeLabel(type: string | null | undefined): ExamQuestionTypeLabel {
  if (type === "true_false") return "Vrai / Faux";
  if (type === "single_choice") return "Choix unique";
  if (type === "multiple_choice") return "Choix multiple";
  if (type === "listening" || type === "audio") return "Écoute";
  if (type === "speaking") return "Expression orale";
  if (type === "writing" || type === "text" || type === "open_text") {
    return "Expression écrite";
  }
  if (type === "form_fill") return "Formulaire";
  if (type === "short_text") return "Texte";
  return "Question";
}

const HISTORICAL_PARTIAL_A1 = new Set(["A1-01", "A1-02", "A1-03"]);

/** Source bank has Hören/Lesen/Schreiben only, and every Hören audio_url is null. */
export type ExamCatalogKind = "historical-partial" | "a1-simulation" | "unspecified";

/** Only labels banks whose structure is known. Does not call an unknown exam complete. */
export function examCatalogKind(code: string | null | undefined): ExamCatalogKind {
  const normalized = (code ?? "").toUpperCase();
  if (HISTORICAL_PARTIAL_A1.has(normalized)) return "historical-partial";
  if (normalized === "A1-SIM-01" || normalized.startsWith("A1-SIM-")) return "a1-simulation";
  return "unspecified";
}

export function historicalPartialExamNotice(code: string | null | undefined): string | null {
  if (!code || !HISTORICAL_PARTIAL_A1.has(code.toUpperCase())) return null;
  return "Banque historique partielle : 50 points (Lesen 15, Hören 15, formulaire automatique 10, texte manuel 10). Pas d’oral. L’audio Hören n’est pas dans la source. Ce n’est pas la simulation complète à 60 points.";
}

export function examSkillLabel(skill: string | null | undefined): string {
  if (skill === "lesen" || skill === "reading") return "Lecture";
  if (skill === "hoeren" || skill === "listening") return "Écoute";
  if (skill === "schreiben" || skill === "writing") return "Écriture";
  if (skill === "sprechen" || skill === "speaking") return "Oral";
  return skill ?? "Section";
}

export type ExamCatalogAction = "start" | "resume" | "finalize" | "provisional" | "final";

export function examCatalogAction(input: {
  latestStatus: string | null | undefined;
  hasUngradedWriting: boolean;
}): {
  label: ReturnType<typeof studentExamProgressLabel>;
  cta: string;
  action: ExamCatalogAction;
} {
  const status = input.latestStatus;
  if (!status) {
    return { label: "À faire", cta: "Démarrer", action: "start" };
  }
  if (status === "in_progress") {
    return { label: "En cours", cta: "Reprendre", action: "resume" };
  }
  if (status === "expired") {
    return {
      label: "Temps écoulé",
      cta: "Clôturer la tentative",
      action: "finalize",
    };
  }
  if (status === "graded" && !input.hasUngradedWriting) {
    return { label: "Terminé", cta: "Voir la correction", action: "final" };
  }
  if (status === "submitted" || input.hasUngradedWriting) {
    return {
      label: "En attente de correction",
      cta: "Score provisoire",
      action: "provisional",
    };
  }
  return { label: "À faire", cta: "Démarrer", action: "start" };
}
