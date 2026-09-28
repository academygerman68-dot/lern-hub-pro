/**
 * Training modules (GA-*-M*) — practice content, not timed exam sims (A1-SIM / B1-MT).
 * Never apply Goethe scoring or exam pass/fail to these profiles.
 */

export const TRAINING_MODULE_PROFILE = "ga_training_module_v1";

export function isTrainingModuleProfile(input: {
  format_profile?: string | null | undefined;
  code?: string | null | undefined;
}): boolean {
  if (input.format_profile === TRAINING_MODULE_PROFILE) return true;
  const code = (input.code ?? "").toUpperCase();
  return /^GA-[A-C][0-9]-M\d{2}$/.test(code) || /^GA-[A-C][0-9]-MT\d{2}$/.test(code);
}

export function isExamSimulationCode(code: string | null | undefined): boolean {
  const c = (code ?? "").toUpperCase();
  return (
    c.startsWith("A1-SIM-") ||
    c.startsWith("A2-SIM-") ||
    c.startsWith("B1-SIM-") ||
    c.startsWith("B1-MT")
  );
}

export type TrainingSkill =
  | "wortschatz"
  | "grammatik"
  | "lesen"
  | "hoeren"
  | "schreiben"
  | "sprechen"
  | "revision";

export type TrainingActivityType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "form_fill"
  | "short_text"
  | "writing"
  | "speaking"
  | "listening";

export const TRAINING_LEVELS = ["A1", "A2", "B1", "B2"] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];

/** Forbidden commercial path / publisher markers in publishable module JSON. */
export const COMMERCIAL_SOURCE_MARKERS = [
  "schritte",
  "hueber",
  "klett",
  "cornelsen",
  "goethe-institut",
  "telc",
  "ösd",
  "oesd",
  "mega.nz",
  "a1-b1-series/source",
  "deutsch üben band",
  "prüfungstraining",
] as const;
