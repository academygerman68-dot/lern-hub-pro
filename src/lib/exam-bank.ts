import { z } from "zod";

const choiceObjectSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const choiceSchema = z.union([z.string().min(1), choiceObjectSchema]);

const objectiveQuestionSchema = z.object({
  id: z.string().min(1),
  part: z.number().int().positive(),
  order: z.number().int().positive(),
  type: z.enum(["true_false", "single_choice"]),
  instruction: z.string().optional(),
  passage: z.string().optional(),
  prompt: z.string().min(1),
  choices: z.array(choiceSchema).min(2),
  correct_answer: z.string().min(1),
  points: z.number().positive(),
  explanation: z.string().min(1),
  audio_script: z.string().optional(),
  audio_url: z.string().nullable().optional(),
  playback_count: z.number().int().positive().optional(),
});

const formFillQuestionSchema = z.object({
  id: z.string().min(1),
  part: z.number().int().positive(),
  order: z.number().int().positive(),
  type: z.literal("form_fill"),
  automatic_grading: z.literal(true),
  points: z.number().positive(),
  instruction: z.string().min(1),
  source_data: z.record(z.string(), z.string()),
  fields: z
    .array(
      z.object({
        key: z.string().min(1),
        points: z.number().positive(),
      }),
    )
    .min(1),
});

const writingQuestionSchema = z.object({
  id: z.string().min(1),
  part: z.number().int().positive(),
  order: z.number().int().positive(),
  type: z.literal("writing"),
  automatic_grading: z.literal(false),
  points: z.number().positive(),
  instruction: z.string().min(1),
  requirements: z.array(z.string().min(1)).min(1),
  recommended_words: z.string().min(1),
  sample_answer: z.string().min(1),
  rubric: z.record(z.string(), z.number().positive()),
  allowed_scores: z.record(z.string(), z.array(z.number().nonnegative())).optional(),
});

const speakingQuestionSchema = z.object({
  id: z.string().min(1),
  part: z.number().int().min(1).max(3),
  order: z.number().int().positive(),
  type: z.literal("speaking"),
  automatic_grading: z.literal(false),
  points: z.number().positive(),
  instruction: z.string().min(1),
  requirements: z.array(z.string().min(1)).min(1),
  rubric: z.record(z.string(), z.number().positive()),
  allowed_scores: z.record(z.string(), z.array(z.number().nonnegative())).optional(),
});

const questionSchema = z.discriminatedUnion("type", [
  objectiveQuestionSchema,
  formFillQuestionSchema,
  writingQuestionSchema,
  speakingQuestionSchema,
]);

const sectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["lesen", "hoeren", "schreiben", "sprechen"]),
  title: z.string().min(1),
  max_points: z.number().positive(),
  questions: z.array(questionSchema).min(1),
});

const examSchema = z.object({
  id: z.string().min(1),
  level: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  duration_minutes: z.number().int().positive(),
  written_duration_minutes: z.number().int().positive().optional(),
  speaking_duration_minutes: z.number().int().positive().optional(),
  format_profile: z.string().min(1).optional(),
  conversion_factor: z.number().positive().optional(),
  pass_score_100: z.number().int().positive().optional(),
  total_points: z.number().positive(),
  automatic_points: z.number().positive(),
  manual_points: z.number().positive(),
  sections: z.array(sectionSchema).min(3).max(4),
});

export const examBankSchema = z.object({
  schema_version: z.string().min(1),
  bank: z.object({
    name: z.string().min(1),
    level: z.string().min(1),
    language: z.string().min(1),
    exams_count: z.number().int().positive(),
  }),
  exams: z.array(examSchema).min(1),
});

export type ExamBank = z.infer<typeof examBankSchema>;
export type BankExam = z.infer<typeof examSchema>;
export type BankQuestion = z.infer<typeof questionSchema>;

export type ExamBankValidationIssue = {
  path: string;
  message: string;
};

function choiceValues(choices: z.infer<typeof choiceSchema>[]): string[] {
  return choices.map((c) => (typeof c === "string" ? c : c.id));
}

function choiceLabels(choices: z.infer<typeof choiceSchema>[]): string[] {
  return choices.map((c) => (typeof c === "string" ? c : c.text));
}

export function validateExamBank(raw: unknown): {
  ok: boolean;
  data?: ExamBank;
  issues: ExamBankValidationIssue[];
} {
  const parsed = examBankSchema.safeParse(raw);
  const issues: ExamBankValidationIssue[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({ path: issue.path.join("."), message: issue.message });
    }
    return { ok: false, issues };
  }

  const bank = parsed.data;
  const examIds = new Set<string>();
  const questionIds = new Set<string>();

  if (bank.exams.length !== bank.bank.exams_count) {
    issues.push({
      path: "exams",
      message: `Expected ${bank.bank.exams_count} exams, found ${bank.exams.length}`,
    });
  }

  for (const exam of bank.exams) {
    if (examIds.has(exam.id)) {
      issues.push({ path: exam.id, message: "Duplicate exam id" });
    }
    examIds.add(exam.id);

    if (exam.total_points !== exam.automatic_points + exam.manual_points) {
      issues.push({
        path: `${exam.id}.total_points`,
        message: "total_points must equal automatic_points + manual_points",
      });
    }
    const isCompleteA1 = exam.sections.some((section) => section.type === "sprechen");
    const expected = isCompleteA1
      ? { total: 60, automatic: 35, manual: 25 }
      : { total: 50, automatic: 40, manual: 10 };
    if (
      exam.total_points !== expected.total ||
      exam.automatic_points !== expected.automatic ||
      exam.manual_points !== expected.manual
    ) {
      issues.push({
        path: `${exam.id}.points`,
        message: `Expected total=${expected.total}, automatic=${expected.automatic}, manual=${expected.manual}`,
      });
    }

    const sectionTypes = exam.sections
      .map((s) => s.type)
      .sort()
      .join(",");
    const expectedSections = isCompleteA1
      ? "hoeren,lesen,schreiben,sprechen"
      : "hoeren,lesen,schreiben";
    if (sectionTypes !== expectedSections) {
      issues.push({
        path: `${exam.id}.sections`,
        message: `Expected sections ${expectedSections}`,
      });
    }

    let sumPoints = 0;
    for (const section of exam.sections) {
      const orders = new Set<number>();
      if (section.type === "lesen" && section.questions.length !== 15) {
        issues.push({
          path: `${section.id}`,
          message: `Lesen must have 15 questions, found ${section.questions.length}`,
        });
      }
      if (section.type === "hoeren" && section.questions.length !== 15) {
        issues.push({
          path: `${section.id}`,
          message: `Hören must have 15 questions, found ${section.questions.length}`,
        });
      }
      if (section.type === "schreiben" && section.questions.length !== 2) {
        issues.push({
          path: `${section.id}`,
          message: `Schreiben must have 2 questions, found ${section.questions.length}`,
        });
      }
      if (section.type === "sprechen" && section.questions.length !== 3) {
        issues.push({
          path: `${section.id}`,
          message: `Sprechen must have 3 questions, found ${section.questions.length}`,
        });
      }

      for (const question of section.questions) {
        if (questionIds.has(question.id)) {
          issues.push({ path: question.id, message: "Duplicate question id" });
        }
        questionIds.add(question.id);
        if (orders.has(question.order)) {
          issues.push({
            path: `${question.id}.order`,
            message: "Duplicate order in section",
          });
        }
        orders.add(question.order);
        sumPoints += question.points;

        if (
          (question.type === "true_false" || question.type === "single_choice") &&
          !question.prompt?.trim()
        ) {
          issues.push({ path: `${question.id}.prompt`, message: "Missing prompt" });
        }
        if (question.type === "form_fill" && !question.instruction) {
          issues.push({ path: `${question.id}.instruction`, message: "Missing instruction" });
        }

        if (question.type === "true_false" || question.type === "single_choice") {
          const values = choiceValues(question.choices);
          if (new Set(values).size !== values.length) {
            issues.push({ path: `${question.id}.choices`, message: "Duplicate choice ids" });
          }
          if (!values.includes(question.correct_answer)) {
            // also allow match against label for string choices
            const labels = choiceLabels(question.choices);
            if (
              !labels.includes(question.correct_answer) &&
              !values.includes(question.correct_answer)
            ) {
              issues.push({
                path: `${question.id}.correct_answer`,
                message: `correct_answer "${question.correct_answer}" not in choices`,
              });
            }
          }
          if (!question.prompt?.trim()) {
            issues.push({ path: `${question.id}.prompt`, message: "Empty prompt" });
          }
        }

        if (question.type === "form_fill") {
          const fieldPoints = question.fields.reduce((a, f) => a + f.points, 0);
          if (fieldPoints !== question.points) {
            issues.push({
              path: `${question.id}.fields`,
              message: "Field points must sum to question points",
            });
          }
          for (const field of question.fields) {
            if (!(field.key in question.source_data)) {
              issues.push({
                path: `${question.id}.source_data`,
                message: `Missing source_data for ${field.key}`,
              });
            }
          }
        }

        if (question.type === "writing" || question.type === "speaking") {
          const rubricTotal = Object.values(question.rubric).reduce((sum, value) => sum + value, 0);
          if (rubricTotal !== question.points) {
            issues.push({
              path: `${question.id}.rubric`,
              message: "Rubric total must equal question points",
            });
          }
        }
      }

      const sectionPoints = section.questions.reduce((a, q) => a + q.points, 0);
      if (sectionPoints !== section.max_points) {
        issues.push({
          path: `${section.id}.max_points`,
          message: `max_points ${section.max_points} != sum ${sectionPoints}`,
        });
      }
    }

    if (sumPoints !== exam.total_points) {
      issues.push({
        path: `${exam.id}.total_points`,
        message: `Question points sum ${sumPoints} != total_points ${exam.total_points}`,
      });
    }
  }

  return { ok: issues.length === 0, data: bank, issues };
}

export function resolveChoiceOptions(
  choices: z.infer<typeof choiceSchema>[],
): Array<{ value: string; label: string }> {
  return choices.map((choice, index) => {
    if (typeof choice === "string") {
      return { value: choice, label: choice };
    }
    return { value: choice.id, label: choice.text || choice.id || String(index) };
  });
}
