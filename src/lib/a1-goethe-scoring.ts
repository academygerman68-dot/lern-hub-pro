/** Goethe A1 adult simulation scoring (format_profile goethe_a1_adult_v1). */

export const GOETHE_A1_ADULT_PROFILE = "goethe_a1_adult_v1";
export const A1_CONVERSION_FACTOR = 1.66;
export const A1_PASS_SCORE_100 = 60;
export const A1_RAW_MAX = 60;
export const A1_SKILL_RAW_MAX = 15;

export type A1Mention =
  | "sehr gut"
  | "gut"
  | "befriedigend"
  | "ausreichend"
  | "nicht bestanden";

export function isGoetheA1AdultProfile(input: {
  format_profile?: string | null | undefined;
  code?: string | null | undefined;
}): boolean {
  if (input.format_profile === GOETHE_A1_ADULT_PROFILE) return true;
  const code = (input.code ?? "").toUpperCase();
  return code === "A1-SIM-01" || code.startsWith("A1-SIM-");
}

/** Convert raw /60 points to /100 (round half up). */
export function convertA1RawToHundred(rawTotal: number): number {
  if (!Number.isFinite(rawTotal) || rawTotal <= 0) return 0;
  return Math.round(rawTotal * A1_CONVERSION_FACTOR);
}

export function a1MentionFromHundred(score100: number): A1Mention {
  if (score100 >= 90) return "sehr gut";
  if (score100 >= 80) return "gut";
  if (score100 >= 70) return "befriedigend";
  if (score100 >= 60) return "ausreichend";
  return "nicht bestanden";
}

export function a1PassedFromHundred(score100: number): boolean {
  return score100 >= A1_PASS_SCORE_100;
}

/** Written skills convert to max 75/100; oral to max 25/100. */
export function convertA1SkillToHundred(
  skill: "hoeren" | "lesen" | "schreiben" | "sprechen",
  raw: number,
): number {
  const clamped = Math.max(0, Math.min(A1_SKILL_RAW_MAX, raw));
  if (skill === "sprechen") {
    return Math.round(clamped * (25 / 15));
  }
  return Math.round(clamped * (75 / 45));
}

export function summarizeA1Result(input: {
  rawBySkill: Partial<Record<"hoeren" | "lesen" | "schreiben" | "sprechen", number>>;
  awaitingManual?: boolean;
}) {
  const hoeren = Number(input.rawBySkill.hoeren ?? 0);
  const lesen = Number(input.rawBySkill.lesen ?? 0);
  const schreiben = Number(input.rawBySkill.schreiben ?? 0);
  const sprechen = Number(input.rawBySkill.sprechen ?? 0);
  const rawTotal = hoeren + lesen + schreiben + sprechen;
  const score100 = convertA1RawToHundred(rawTotal);
  return {
    rawTotal,
    rawMax: A1_RAW_MAX,
    score100,
    passed: a1PassedFromHundred(score100),
    mention: a1MentionFromHundred(score100),
    provisional: Boolean(input.awaitingManual),
    written100: convertA1RawToHundred(hoeren + lesen + schreiben),
    oral100: Math.round(sprechen * (25 / 15)),
  };
}

export const SCHREIBEN_TEIL2_ALLOWED: Record<string, number[]> = {
  content_point_1: [0, 1.5, 3],
  content_point_2: [0, 1.5, 3],
  content_point_3: [0, 1.5, 3],
  communicative_design: [0, 0.5, 1],
};

export function allowedScoresFromMeta(
  meta: Record<string, unknown> | null | undefined,
  rubric: Record<string, number>,
): Record<string, number[]> {
  const raw = meta?.["allowed_scores"];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, number[]> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
        out[key] = value as number[];
      }
    }
    if (Object.keys(out).length) return out;
  }
  // Fallback: 0 … max in 0.5 steps if no discrete list
  const out: Record<string, number[]> = {};
  for (const [key, max] of Object.entries(rubric)) {
    const steps: number[] = [];
    for (let v = 0; v <= max + 1e-9; v += 0.5) {
      steps.push(Math.round(v * 10) / 10);
    }
    out[key] = steps;
  }
  return out;
}
