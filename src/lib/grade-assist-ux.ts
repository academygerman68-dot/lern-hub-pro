/** UX + parsing helpers for AI grade-assist (never auto-publishes scores). */

export const GRADE_ASSIST_UNCONFIGURED_MESSAGE =
  "Le service de correction IA n'est pas encore configuré.";

export const GRADE_ASSIST_NEEDS_TEXT_MESSAGE =
  "La pré-correction IA nécessite une réponse textuelle exploitable, ou un fichier image/PDF lisible. Ouvrez le fichier manuellement si le format n’est pas supporté.";

export const GRADE_ASSIST_UNREADABLE_ATTACHMENT_MESSAGE =
  "Le fichier de remise n’est pas analysable par l’IA. Ouvrez-le manuellement ; aucune analyse inventée.";

export const GRADE_ASSIST_ERROR_CATEGORIES = [
  "Ordre des mots",
  "Conjugaison",
  "Grammaire",
  "Orthographe",
  "Vocabulaire",
  "Cas / déclinaison",
  "Temps verbal",
  "Ponctuation",
  "Autre",
] as const;

export type GradeAssistErrorCategory = (typeof GRADE_ASSIST_ERROR_CATEGORIES)[number];

export type GradeAssistCriterion = {
  label: string;
  score: number;
  max_score: number;
  id?: string;
};

export type GradeAssistErrorItem = {
  category: string;
  original: string;
  correction: string;
  explanation: string;
};

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

const ERROR_CATEGORY_ALIASES: Record<string, GradeAssistErrorCategory> = {
  "ordre des mots": "Ordre des mots",
  word_order: "Ordre des mots",
  conjugaison: "Conjugaison",
  conjugation: "Conjugaison",
  grammaire: "Grammaire",
  grammar: "Grammaire",
  orthographe: "Orthographe",
  spelling: "Orthographe",
  vocabulaire: "Vocabulaire",
  vocabulary: "Vocabulaire",
  "cas / déclinaison": "Cas / déclinaison",
  cas: "Cas / déclinaison",
  declinaison: "Cas / déclinaison",
  déclinaison: "Cas / déclinaison",
  case: "Cas / déclinaison",
  "temps verbal": "Temps verbal",
  tense: "Temps verbal",
  ponctuation: "Ponctuation",
  punctuation: "Ponctuation",
  autre: "Autre",
  other: "Autre",
};

export function gradeAssistCriteriaLabel(key: string): string {
  return CRITERIA_LABELS[key] ?? key.replace(/_/g, " ");
}

export function normalizeGradeAssistErrorCategory(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "Autre";
  const exact = GRADE_ASSIST_ERROR_CATEGORIES.find(
    (item) => item.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) return exact;
  const alias = ERROR_CATEGORY_ALIASES[trimmed.toLowerCase()];
  return alias ?? "Autre";
}

export function clampGradeAssistScore(score: number, maxScore: number): number {
  const max = Math.max(1, maxScore);
  if (!Number.isFinite(score)) return 0;
  return Math.min(max, Math.max(0, Math.round(score * 10) / 10));
}

export function parseGradeAssistCriteria(raw: unknown, maxScore: number): GradeAssistCriterion[] {
  if (!Array.isArray(raw)) return [];
  const out: GradeAssistCriterion[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const id = typeof record["id"] === "string" ? record["id"].trim() : "";
    const labelRaw = typeof record["label"] === "string" ? record["label"].trim() : "";
    const label = labelRaw || (id ? gradeAssistCriteriaLabel(id) : "");
    const score = Number(record["score"]);
    const max = Number(record["max_score"] ?? record["max"] ?? maxScore);
    if (!label || !Number.isFinite(score) || !Number.isFinite(max) || max <= 0) continue;
    out.push({
      ...(id ? { id } : {}),
      label,
      score: clampGradeAssistScore(score, max),
      max_score: Math.max(1, max),
    });
  }
  return out;
}

export function criteriaToScoreMap(criteria: GradeAssistCriterion[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of criteria) {
    const key = item.id || item.label;
    map[key] = item.score;
  }
  return map;
}

export function parseGradeAssistErrors(raw: unknown): GradeAssistErrorItem[] {
  if (!Array.isArray(raw)) return [];
  const out: GradeAssistErrorItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const original = typeof record["original"] === "string" ? record["original"].trim() : "";
    const correction = typeof record["correction"] === "string" ? record["correction"].trim() : "";
    const explanation =
      typeof record["explanation"] === "string" ? record["explanation"].trim() : "";
    if (!original || !correction || !explanation) continue;
    out.push({
      category: normalizeGradeAssistErrorCategory(
        typeof record["category"] === "string" ? record["category"] : "",
      ),
      original,
      correction,
      explanation,
    });
  }
  return out;
}

export function parseOptionalModelAnswer(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

/** Map Edge Function error codes to user-facing French messages. */
export function mapGradeAssistErrorCode(
  code: string | null | undefined,
  providerMessage?: string | null,
): string {
  switch (code) {
    case "GEMINI_NOT_CONFIGURED":
    case "NOT_CONFIGURED":
      return GRADE_ASSIST_UNCONFIGURED_MESSAGE;
    case "GEMINI_AUTH_ERROR":
      return "La clé du service de correction IA est refusée. Vérifiez la configuration côté serveur.";
    case "GEMINI_MODEL_ERROR":
      return "Le modèle de correction IA est indisponible ou invalide.";
    case "GEMINI_RATE_LIMIT":
      return "Le service de correction IA est temporairement saturé. Réessayez dans un instant.";
    case "GEMINI_INVALID_RESPONSE":
      return "La réponse du service de correction IA est invalide. Réessayez.";
    case "GEMINI_PROVIDER_ERROR":
    case "MODEL_UNAVAILABLE":
      return "Le fournisseur de correction IA est temporairement indisponible.";
    case "UNREADABLE_ATTACHMENT":
      return providerMessage?.trim()
        ? providerMessage.trim().slice(0, 200)
        : GRADE_ASSIST_UNREADABLE_ATTACHMENT_MESSAGE;
    case "FORBIDDEN":
      return "Vous n’avez pas l’autorisation d’utiliser la pré-correction IA.";
    case "UNAUTHORIZED":
      return "Session expirée — reconnectez-vous pour utiliser la pré-correction IA.";
    default:
      if (providerMessage?.trim()) {
        return `Correction IA indisponible (${providerMessage.trim().slice(0, 120)}).`;
      }
      return "La pré-correction IA est temporairement indisponible.";
  }
}

/** True when only a non-multimodal file exists and there is no student text for the model. */
export function isGradeAssistMultimodalPath(pathOrMime: string | null | undefined): boolean {
  const value = (pathOrMime ?? "").toLowerCase();
  if (!value) return false;
  if (
    value.includes("application/pdf") ||
    value.includes("image/jpeg") ||
    value.includes("image/jpg") ||
    value.includes("image/png") ||
    value.includes("image/webp") ||
    value.includes("image/gif")
  ) {
    return true;
  }
  return (
    value.endsWith(".pdf") ||
    value.endsWith(".jpg") ||
    value.endsWith(".jpeg") ||
    value.endsWith(".png") ||
    value.endsWith(".webp") ||
    value.endsWith(".gif")
  );
}

export function gradeAssistNeedsExploitableText(
  responseText: string | null | undefined,
  hasAttachment: boolean,
  attachmentHint?: string | null,
): boolean {
  if (responseText?.trim()) return false;
  if (!hasAttachment) return false;
  if (isGradeAssistMultimodalPath(attachmentHint)) return false;
  return true;
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

  const totalMax =
    keys.reduce((sum, key) => sum + Number(input.rubric[key] ?? 0), 0) || input.questionPoints;
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
