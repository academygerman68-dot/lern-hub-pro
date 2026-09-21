import type { studentExamProgressLabel } from "./exam-writing";

export type ExamQuestionTypeLabel =
  | "Vrai / Faux"
  | "Choix unique"
  | "Choix multiple"
  | "Écoute"
  | "Expression écrite"
  | "Formulaire"
  | "Texte"
  | "Question";

export function examQuestionTypeLabel(type: string | null | undefined): ExamQuestionTypeLabel {
  if (type === "true_false") return "Vrai / Faux";
  if (type === "single_choice") return "Choix unique";
  if (type === "multiple_choice") return "Choix multiple";
  if (type === "listening" || type === "audio") return "Écoute";
  if (type === "writing" || type === "text" || type === "open_text" || type === "speaking") {
    return "Expression écrite";
  }
  if (type === "form_fill") return "Formulaire";
  if (type === "short_text") return "Texte";
  return "Question";
}

export function examSkillLabel(skill: string | null | undefined): string {
  if (skill === "lesen" || skill === "reading") return "Lecture";
  if (skill === "hoeren" || skill === "listening") return "Écoute";
  if (skill === "schreiben" || skill === "writing") return "Écriture";
  if (skill === "sprechen" || skill === "speaking") return "Oral";
  return skill ?? "Section";
}

export type ExamCatalogAction = "start" | "resume" | "provisional" | "final";

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
  if (status === "graded" && !input.hasUngradedWriting) {
    return { label: "Terminé", cta: "Voir mes résultats", action: "final" };
  }
  if (status === "submitted" || status === "expired" || input.hasUngradedWriting) {
    return {
      label: "En attente de correction",
      cta: "Voir le résultat provisoire",
      action: "provisional",
    };
  }
  return { label: "À faire", cta: "Démarrer", action: "start" };
}
