import type { TrainingActivityType } from "@/lib/training-module";

export type TrainingSaveStatus = "idle" | "saving" | "saved" | "error";

export type TrainingAnswerStatusUi =
  | "todo"
  | "in_progress"
  | "answered"
  | "validated"
  | "review"
  | "pending_review"
  | "draft";

export const TRAINING_ANSWER_STATUS_LABELS: Record<TrainingAnswerStatusUi, string> = {
  todo: "À faire",
  in_progress: "En cours",
  answered: "Répondu",
  validated: "Validé",
  review: "À revoir",
  pending_review: "En attente de correction",
  draft: "Brouillon",
};

export const TRAINING_SAVE_STATUS_LABELS: Record<TrainingSaveStatus, string> = {
  idle: "",
  saving: "Sauvegarde…",
  saved: "Enregistré",
  error: "Erreur de sauvegarde",
};

export const TRAINING_ACTIVITY_TYPE_LABELS: Record<TrainingActivityType | "unknown", string> = {
  single_choice: "QCM",
  multiple_choice: "QCM multiple",
  true_false: "Vrai / faux",
  form_fill: "Formulaire",
  short_text: "Texte court",
  writing: "Schreiben",
  speaking: "Sprechen",
  listening: "Hören",
  unknown: "Type inconnu",
};

export const TRAINING_SKILL_LABELS: Record<string, string> = {
  wortschatz: "Wortschatz",
  grammatik: "Grammatik",
  lesen: "Lesen",
  hoeren: "Hören",
  schreiben: "Schreiben",
  sprechen: "Sprechen",
  revision: "Révision",
};

export type StudentTrainingActivity = {
  id: string;
  order: number;
  skill: string;
  activity_type: string;
  learning_objective: string;
  theme: string;
  focus: string;
  difficulty: string;
  instruction: string;
  prompt: string;
  points: number;
  choices?: Array<{ id: string; text: string }>;
  passage?: string;
  fields?: Array<{ id: string; label: string }>;
  recommended_words?: number;
  rubric?: Array<{ id: string; label: string; max_points: number }>;
  speaking_card?: string;
  mic_fallback?: string;
  auto_grade_as_certain?: boolean;
  media?: { audio_url?: string; duration_seconds?: number };
};

export type StudentTrainingDefinition = {
  module_id: string;
  title: string;
  theme: string;
  subtitle?: string;
  level: string;
  estimated_minutes: number;
  prerequisites?: string[];
  learning_objectives?: string[];
  skills?: string[];
  vocabulary_targets?: string[];
  grammar_targets?: string[];
  publication_status?: string;
  correction?: {
    allow_retry?: boolean;
    practice_scoring?: boolean;
    goethe_scoring?: boolean;
    pass_fail_certificate?: boolean;
    timed_exam?: boolean;
  };
  media?: {
    audio_tracks?: Array<{ id: string; url: string; duration_seconds?: number }>;
  };
  activities: StudentTrainingActivity[];
};

export function mapAnswerStatusToUi(status: string | null | undefined): TrainingAnswerStatusUi {
  if (!status || status === "todo") return "todo";
  if (status === "in_progress" || status === "draft") return status === "draft" ? "draft" : "in_progress";
  if (status === "answered") return "answered";
  if (status === "validated") return "validated";
  if (status === "review") return "review";
  if (status === "pending_review") return "pending_review";
  return "todo";
}

export function activityStatusFromAnswer(row: {
  status: string;
  is_correct: boolean | null;
} | null): TrainingAnswerStatusUi {
  if (!row) return "todo";
  if (row.status === "validated" && row.is_correct === false) return "review";
  return mapAnswerStatusToUi(row.status);
}

export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

export function isObjectiveActivityType(type: string): boolean {
  return (
    type === "single_choice" ||
    type === "multiple_choice" ||
    type === "true_false" ||
    type === "listening" ||
    type === "form_fill"
  );
}

export function isManualActivityType(type: string): boolean {
  return type === "writing" || type === "speaking";
}

/** Known registry keys — unknown types fall back to controlled error UI. */
export const TRAINING_ACTIVITY_REGISTRY_KEYS = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "form_fill",
  "short_text",
  "writing",
  "speaking",
  "listening",
  "lesen",
  "revision",
] as const;

export function resolveActivityViewKey(activity: StudentTrainingActivity): string {
  if (activity.skill === "lesen" && activity.activity_type === "true_false") return "lesen";
  if (activity.skill === "revision") return "revision";
  return activity.activity_type;
}

export function validateActivityProps(activity: StudentTrainingActivity): string | null {
  if (!activity.id || !activity.activity_type) return "Activité incomplète (id / type).";
  const type = activity.activity_type;
  if (
    (type === "single_choice" || type === "multiple_choice" || type === "listening") &&
    (!activity.choices || activity.choices.length < 2)
  ) {
    return "Choix manquants pour cette activité.";
  }
  if (type === "form_fill" && (!activity.fields || activity.fields.length < 1)) {
    return "Champs de formulaire manquants.";
  }
  if (type === "writing" && !activity.rubric?.length) {
    return "Rubrique Schreiben manquante.";
  }
  if (type === "speaking" && !activity.speaking_card) {
    return "Carte Sprechen manquante.";
  }
  if (
    (activity.skill === "hoeren" || type === "listening") &&
    !activity.media?.audio_url
  ) {
    return "Audio Hören manquant.";
  }
  return null;
}

export const TRAINING_MODULE_SESSION_KEY = "ga-training-module-code";
export const TRAINING_ATTEMPT_SESSION_KEY = "ga-training-attempt-id";
export const TRAINING_PREVIEW_FLAG_KEY = "ga-training-preview";

export function persistTrainingNav(input: {
  code: string;
  attemptId?: string | null;
  preview?: boolean;
}) {
  const store =
    typeof sessionStorage !== "undefined"
      ? sessionStorage
      : ((globalThis as { __trainingNavMemory?: Storage }).__trainingNavMemory ??
        (() => {
          const mem = new Map<string, string>();
          const fake = {
            getItem: (k: string) => mem.get(k) ?? null,
            setItem: (k: string, v: string) => {
              mem.set(k, v);
            },
            removeItem: (k: string) => {
              mem.delete(k);
            },
          } as Storage;
          (globalThis as { __trainingNavMemory?: Storage }).__trainingNavMemory = fake;
          return fake;
        })());
  store.setItem(TRAINING_MODULE_SESSION_KEY, input.code);
  if (input.attemptId) store.setItem(TRAINING_ATTEMPT_SESSION_KEY, input.attemptId);
  else store.removeItem(TRAINING_ATTEMPT_SESSION_KEY);
  if (input.preview) store.setItem(TRAINING_PREVIEW_FLAG_KEY, "1");
  else store.removeItem(TRAINING_PREVIEW_FLAG_KEY);
}

export function readTrainingNav(): {
  code: string | null;
  attemptId: string | null;
  preview: boolean;
} {
  const store =
    typeof sessionStorage !== "undefined"
      ? sessionStorage
      : (globalThis as { __trainingNavMemory?: Storage }).__trainingNavMemory;
  if (!store) {
    return { code: null, attemptId: null, preview: false };
  }
  return {
    code: store.getItem(TRAINING_MODULE_SESSION_KEY),
    attemptId: store.getItem(TRAINING_ATTEMPT_SESSION_KEY),
    preview: store.getItem(TRAINING_PREVIEW_FLAG_KEY) === "1",
  };
}
