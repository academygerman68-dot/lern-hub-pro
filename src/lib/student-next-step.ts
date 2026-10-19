export type StudentNextPage = "exams" | "assignments" | "courses";

export type StudentNextStep = {
  page: StudentNextPage;
  title: string;
  detail: string;
  cta: string;
};

/**
 * Next useful action from data the student already has.
 * French source strings are translated via ui-strings / l().
 */
export function studentNextStep(input: {
  hasInProgressExam: boolean;
  dueAssignmentCount: number;
  availableExamCount: number;
}): StudentNextStep {
  if (input.hasInProgressExam) {
    return {
      page: "exams",
      title: "Examen en cours",
      detail:
        "Une tentative d’examen blanc est ouverte. Reprenez-la avant l’échéance fixée par le serveur.",
      cta: "Reprendre l’examen",
    };
  }
  if (input.dueAssignmentCount > 0) {
    const n = input.dueAssignmentCount;
    return {
      page: "assignments",
      title: "Devoir à rendre",
      detail: n === 1 ? "1 devoir publié en attente." : `${n} devoirs publiés en attente.`,
      cta: "Voir les devoirs",
    };
  }
  if (input.availableExamCount > 0) {
    return {
      page: "exams",
      title: "Examen blanc",
      detail: "Des simulations sont disponibles pour votre niveau.",
      cta: "Ouvrir les examens",
    };
  }
  return {
    page: "courses",
    title: "Cours",
    detail: "Consultez vos cours et leçons.",
    cta: "Voir les cours",
  };
}
