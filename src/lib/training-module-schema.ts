import { z } from "zod";
import {
  COMMERCIAL_SOURCE_MARKERS,
  TRAINING_LEVELS,
  TRAINING_MODULE_PROFILE,
  type TrainingLevel,
} from "./training-module";

const choiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const rubricCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  max_points: z.number().positive(),
});

const baseActivitySchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  skill: z.enum([
    "wortschatz",
    "grammatik",
    "lesen",
    "hoeren",
    "schreiben",
    "sprechen",
    "revision",
  ]),
  activity_type: z.enum([
    "single_choice",
    "multiple_choice",
    "true_false",
    "form_fill",
    "short_text",
    "writing",
    "speaking",
    "listening",
  ]),
  learning_objective: z.string().min(8),
  theme: z.string().min(2),
  focus: z.string().min(2),
  difficulty: z.enum(["guided", "semi_guided", "autonomous"]),
  instruction: z.string().min(3),
  prompt: z.string().min(1),
  points: z.number().positive(),
  explanation: z.string().min(8).optional(),
  positive_feedback: z.string().min(3).optional(),
  common_error: z.string().min(3).optional(),
  media: z
    .object({
      audio_url: z.string().min(1).optional(),
      audio_script_staff_only: z.string().min(1).optional(),
      duration_seconds: z.number().positive().optional(),
    })
    .optional(),
});

const objectiveActivitySchema = baseActivitySchema.extend({
  activity_type: z.enum(["single_choice", "multiple_choice", "true_false", "listening"]),
  choices: z.array(choiceSchema).min(2).optional(),
  correct_answer: z.union([z.string(), z.boolean(), z.array(z.string().min(1))]),
  explanation: z.string().min(8),
  positive_feedback: z.string().min(3),
  common_error: z.string().min(3),
  passage: z.string().optional(),
});

const formFillActivitySchema = baseActivitySchema.extend({
  activity_type: z.literal("form_fill"),
  fields: z.array(fieldSchema).min(1),
  correct_form: z.record(z.string(), z.string().min(1)),
  explanation: z.string().min(8),
  positive_feedback: z.string().min(3),
  common_error: z.string().min(3),
});

const writingActivitySchema = baseActivitySchema.extend({
  activity_type: z.literal("writing"),
  sample_answer_staff_only: z.string().min(8),
  recommended_words: z.number().int().positive(),
  rubric: z.array(rubricCriterionSchema).min(2),
  auto_grade_as_certain: z.literal(false),
});

const speakingActivitySchema = baseActivitySchema.extend({
  activity_type: z.literal("speaking"),
  speaking_card: z.string().min(8),
  sample_answer_staff_only: z.string().min(8),
  rubric: z.array(rubricCriterionSchema).min(2),
  mic_fallback: z.string().min(8),
  auto_grade_as_certain: z.literal(false),
});

const activitySchema = z.discriminatedUnion("activity_type", [
  objectiveActivitySchema,
  formFillActivitySchema,
  writingActivitySchema,
  speakingActivitySchema,
]);

const provenanceSchema = z.object({
  content_origin: z.literal("original"),
  publisher_content_embedded: z.literal(false),
  commercial_media_used: z.literal(false),
  author: z.literal("German Academy"),
  created_at: z.string().min(8),
  updated_at: z.string().min(8),
  version: z.string().min(1),
});

export const trainingModuleSchema = z
  .object({
    schema_version: z.literal("1.0"),
    module_id: z
      .string()
      .regex(/^GA-[A-C][0-9]-M\d{2}$/, "module_id must look like GA-A1-M01"),
    kind: z.literal("training_module"),
    format_profile: z.literal(TRAINING_MODULE_PROFILE),
    level: z.enum(TRAINING_LEVELS),
    sequence: z.number().int().positive(),
    title: z.string().min(3),
    theme: z.string().min(3),
    subtitle: z.string().min(3).optional(),
    estimated_minutes: z.number().int().positive().max(90),
    prerequisites: z.array(z.string()),
    learning_objectives: z.array(z.string().min(5)).min(3),
    vocabulary_targets: z.array(z.string().min(1)).min(3),
    grammar_targets: z.array(z.string().min(1)).min(3),
    skills: z
      .array(
        z.enum([
          "wortschatz",
          "grammatik",
          "lesen",
          "hoeren",
          "schreiben",
          "sprechen",
          "revision",
        ]),
      )
      .min(5),
    publication_status: z.enum(["draft", "published", "archived"]),
    provenance: provenanceSchema,
    media: z.object({
      audio_tracks: z.array(
        z.object({
          id: z.string().min(1),
          url: z.string().min(1),
          duration_seconds: z.number().positive(),
          script_staff_only: z.string().min(8),
        }),
      ),
    }),
    activities: z.array(activitySchema).min(8).max(20),
    correction: z.object({
      show_keys_before_submit: z.literal(false),
      allow_retry: z.boolean(),
      practice_scoring: z.literal(true),
      goethe_scoring: z.literal(false),
      pass_fail_certificate: z.literal(false),
      timed_exam: z.literal(false),
    }),
  })
  .superRefine((mod, ctx) => {
    const ids = new Set<string>();
    for (const activity of mod.activities) {
      if (ids.has(activity.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate activity id: ${activity.id}`,
          path: ["activities"],
        });
      }
      ids.add(activity.id);

      if (!activity.learning_objective.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Activity ${activity.id} missing learning objective`,
          path: ["activities"],
        });
      }

      if (
        (activity.activity_type === "single_choice" ||
          activity.activity_type === "multiple_choice" ||
          activity.activity_type === "listening") &&
        (!("choices" in activity) || !activity.choices || activity.choices.length < 2)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Activity ${activity.id} needs choices`,
          path: ["activities"],
        });
      }

      if (activity.skill === "hoeren" || activity.activity_type === "listening") {
        const url = activity.media?.audio_url;
        if (!url) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Hören activity ${activity.id} missing audio_url`,
            path: ["activities"],
          });
        }
        if (!activity.media?.audio_script_staff_only) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Hören activity ${activity.id} missing staff script`,
            path: ["activities"],
          });
        }
      }

      if (activity.activity_type === "writing" || activity.activity_type === "speaking") {
        if (!("rubric" in activity) || !activity.rubric?.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Free activity ${activity.id} needs rubric criteria`,
            path: ["activities"],
          });
        }
      }

      if (activity.activity_type === "form_fill") {
        const keys = Object.keys(activity.correct_form);
        const fieldIds = activity.fields.map((f) => f.id);
        for (const key of keys) {
          if (!fieldIds.includes(key)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `form_fill ${activity.id}: correct_form key ${key} not in fields`,
              path: ["activities"],
            });
          }
        }
      }
    }

    const requiredSkills = [
      "wortschatz",
      "grammatik",
      "lesen",
      "hoeren",
      "schreiben",
      "sprechen",
      "revision",
    ] as const;
    for (const skill of requiredSkills) {
      if (!mod.skills.includes(skill)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Module skills must include ${skill}`,
          path: ["skills"],
        });
      }
      if (!mod.activities.some((a) => a.skill === skill)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `No activity covers skill ${skill}`,
          path: ["activities"],
        });
      }
    }

    const orders = mod.activities.map((a) => a.order);
    if (new Set(orders).size !== orders.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Activity order values must be unique",
        path: ["activities"],
      });
    }

    const blob = JSON.stringify(mod).toLowerCase();
    for (const marker of COMMERCIAL_SOURCE_MARKERS) {
      if (blob.includes(marker)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Commercial/source marker found in module payload: ${marker}`,
          path: ["provenance"],
        });
      }
    }

    if (mod.publication_status === "published") {
      for (const track of mod.media.audio_tracks) {
        if (track.url.includes("a1-b1-series/source") || track.url.includes("mega")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Published module cannot reference commercial source media paths",
            path: ["media"],
          });
        }
      }
    }

    if (!TRAINING_LEVELS.includes(mod.level as TrainingLevel)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid level",
        path: ["level"],
      });
    }
  });

export type TrainingModule = z.infer<typeof trainingModuleSchema>;

export type TrainingModuleValidationResult =
  | { ok: true; module: TrainingModule }
  | { ok: false; errors: string[] };

export function validateTrainingModule(raw: unknown): TrainingModuleValidationResult {
  const parsed = trainingModuleSchema.safeParse(raw);
  if (parsed.success) return { ok: true, module: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
  };
}

/** Student-safe view: strip keys, staff scripts, sample answers. */
export function toStudentTrainingPayload(mod: TrainingModule) {
  return {
    module_id: mod.module_id,
    kind: mod.kind,
    format_profile: mod.format_profile,
    level: mod.level,
    sequence: mod.sequence,
    title: mod.title,
    theme: mod.theme,
    subtitle: mod.subtitle,
    estimated_minutes: mod.estimated_minutes,
    learning_objectives: mod.learning_objectives,
    vocabulary_targets: mod.vocabulary_targets,
    grammar_targets: mod.grammar_targets,
    skills: mod.skills,
    publication_status: mod.publication_status,
    correction: {
      show_keys_before_submit: false,
      allow_retry: mod.correction.allow_retry,
      practice_scoring: true,
      goethe_scoring: false,
      pass_fail_certificate: false,
      timed_exam: false,
    },
    media: {
      audio_tracks: mod.media.audio_tracks.map((t) => ({
        id: t.id,
        url: t.url,
        duration_seconds: t.duration_seconds,
      })),
    },
    activities: mod.activities.map((a) => {
      const base = {
        id: a.id,
        order: a.order,
        skill: a.skill,
        activity_type: a.activity_type,
        learning_objective: a.learning_objective,
        theme: a.theme,
        focus: a.focus,
        difficulty: a.difficulty,
        instruction: a.instruction,
        prompt: a.prompt,
        points: a.points,
        media: a.media
          ? {
              audio_url: a.media.audio_url,
              duration_seconds: a.media.duration_seconds,
            }
          : undefined,
      };
      if (a.activity_type === "writing") {
        return {
          ...base,
          recommended_words: a.recommended_words,
          rubric: a.rubric,
          auto_grade_as_certain: false as const,
        };
      }
      if (a.activity_type === "speaking") {
        return {
          ...base,
          speaking_card: a.speaking_card,
          rubric: a.rubric,
          mic_fallback: a.mic_fallback,
          auto_grade_as_certain: false as const,
        };
      }
      if (a.activity_type === "form_fill") {
        return { ...base, fields: a.fields };
      }
      return {
        ...base,
        choices: "choices" in a ? a.choices : undefined,
        passage: "passage" in a ? a.passage : undefined,
      };
    }),
  };
}
