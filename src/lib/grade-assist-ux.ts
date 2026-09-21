/** UX helpers for AI grade-assist (never auto-publishes scores). */

export const GRADE_ASSIST_UNCONFIGURED_MESSAGE =
  "Le service de correction IA n'est pas encore configuré.";

export const GRADE_ASSIST_NEEDS_TEXT_MESSAGE =
  "La pré-correction IA nécessite une réponse textuelle exploitable. Ouvrez le fichier manuellement, puis saisissez ou collez le texte à évaluer.";

const CRITERIA_LABELS: Record<string, string> = {
  task_completion: "Respect de la consigne",
  respect_consigne: "Respect de la consigne",
  contenu: "Respect de la consigne",
  comprehensibility: "Compréhensibilité",
  vocabulary: "Vocabulaire",
  wortschatz: "Vocabulaire",
  grammar_and_spelling: "Grammaire / orthographe",
  langue: "Grammaire / orthographe",
  structure: "Structure",
};

export function gradeAssistCriteriaLabel(key: string): string {
  return CRITERIA_LABELS[key] ?? key.replace(/_/g, " ");
}

/** True when only a file exists and there is no student text for the model. */
export function gradeAssistNeedsExploitableText(
  responseText: string | null | undefined,
  hasAttachment: boolean,
): boolean {
  return !Boolean(responseText?.trim()) && hasAttachment;
}

export function formatGradeAssistRubric(rubric: Record<string, number> | null | undefined): string {
  if (!rubric) return "";
  return Object.entries(rubric)
    .map(([key, max]) => `${gradeAssistCriteriaLabel(key)}: /${max}`)
    .join(" · ");
}

/** Prefer criteria keys; otherwise distribute total across rubric maxes. */
export function applySuggestionToWritingRubric(input: {
  suggestedScore: number;
  criteriaScores: Record<string, number>;
  rubric: Record<string, number>;
  questionPoints: number;
}): Record<string, string> {
  const keys = [
    "task_completion",
    "comprehensibility",
    "vocabulary",
    "grammar_and_spelling",
  ] as const;
  const fromCriteria = keys.every((key) => Number.isFinite(Number(input.criteriaScores[key])));
  if (fromCriteria) {
    const next: Record<string, string> = {};
    for (const key of keys) {
      const max = Number(input.rubric[key] ?? 0);
      const raw = Number(input.criteriaScores[key] ?? 0);
      next[key] = String(Math.min(max, Math.max(0, Math.round(raw * 10) / 10)));
    }
    return next;
  }

  const totalMax = keys.reduce((sum, key) => sum + Number(input.rubric[key] ?? 0), 0) || input.questionPoints;
  const capped = Math.min(input.questionPoints, Math.max(0, input.suggestedScore));
  const next: Record<string, string> = {};
  let remaining = capped;
  keys.forEach((key, index) => {
    const max = Number(input.rubric[key] ?? 0);
    if (index === keys.length - 1) {
      next[key] = String(Math.min(max, Math.round(remaining * 10) / 10));
      return;
    }
    const share = totalMax > 0 ? (capped * max) / totalMax : 0;
    const value = Math.min(max, Math.round(share * 10) / 10);
    next[key] = String(value);
    remaining = Math.round((remaining - value) * 10) / 10;
  });
  return next;
}
