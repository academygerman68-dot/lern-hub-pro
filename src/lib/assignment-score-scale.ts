export const PRESET_SCORE_SCALES = [10, 20, 50, 100] as const;

export type ScoreScaleChoice =
  | { kind: "preset"; max: (typeof PRESET_SCORE_SCALES)[number]; label: string }
  | { kind: "custom"; max: number; label: string };

export function normalizeScoreScale(maxScore: number | null | undefined): ScoreScaleChoice {
  const max = Number(maxScore);
  if (!Number.isFinite(max) || max <= 0) {
    return { kind: "preset", max: 20, label: "/20" };
  }
  const preset = PRESET_SCORE_SCALES.find((n) => n === max);
  if (preset) return { kind: "preset", max: preset, label: `/${preset}` };
  return { kind: "custom", max, label: `/${max}` };
}

export function parseCustomMaxScore(raw: string): number | null {
  const n = Number(String(raw).replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** Display score using the scale frozen at grading time when available. */
export function formatGradedScore(input: {
  score: number | null | undefined;
  gradedMaxScore?: number | null;
  currentMaxScore?: number | null;
}): string {
  if (input.score == null || Number.isNaN(Number(input.score))) return "—";
  const max =
    input.gradedMaxScore != null && Number(input.gradedMaxScore) > 0
      ? Number(input.gradedMaxScore)
      : input.currentMaxScore != null && Number(input.currentMaxScore) > 0
        ? Number(input.currentMaxScore)
        : null;
  if (max == null) return String(input.score);
  return `${input.score} / ${max}`;
}

export function scoreScaleChangedWarning(input: {
  gradedMaxScore?: number | null;
  currentMaxScore?: number | null;
}): string | null {
  if (input.gradedMaxScore == null || input.currentMaxScore == null) return null;
  if (Number(input.gradedMaxScore) === Number(input.currentMaxScore)) return null;
  return `Note historique /${input.gradedMaxScore} — le barème actuel est /${input.currentMaxScore}. La note n’a pas été recalculée.`;
}
