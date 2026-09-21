import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  criteriaToScoreMap,
  GRADE_ASSIST_UNCONFIGURED_MESSAGE,
  mapGradeAssistErrorCode,
  parseGradeAssistCriteria,
  parseGradeAssistErrors,
  parseOptionalModelAnswer,
  type GradeAssistCriterion,
  type GradeAssistErrorItem,
} from "@/lib/grade-assist-ux";

export type GradeAssistSuggestion = {
  suggested_score: number;
  criteria_scores: Record<string, number>;
  criteria: GradeAssistCriterion[];
  strengths: string[];
  errors: GradeAssistErrorItem[];
  improvements: string[];
  feedback: string;
  max_score?: number;
  model_answer?: string;
  model?: string;
};

export type GradeAssistInput = {
  level?: string | null;
  subject?: string | null;
  instructions?: string | null;
  response?: string | null;
  rubric?: string | null;
  maxScore?: number | null;
  targetKind: "assignment" | "exam_writing";
  targetId: string;
  studentId?: string | null;
};

export type GradeAssistOutcome =
  | { ok: true; suggestion: GradeAssistSuggestion }
  | {
      ok: false;
      reason: "unconfigured" | "forbidden" | "error";
      code?: string;
      message: string;
    };

type AssistPayload = {
  suggested_score?: number;
  max_score?: number;
  criteria?: unknown;
  criteria_scores?: Record<string, number>;
  strengths?: string[];
  errors?: unknown;
  improvements?: string[];
  feedback?: string;
  model_answer?: string | null;
  model?: string;
  error?: string;
  secret_present?: boolean;
  provider_status?: number;
  provider_message?: string;
};

async function readInvokeErrorPayload(error: unknown): Promise<AssistPayload | null> {
  const context = (error as { context?: Response })?.context;
  if (!context || typeof context.json !== "function") return null;
  try {
    return (await context.json()) as AssistPayload;
  } catch {
    return null;
  }
}

function failureFromPayload(
  payload: AssistPayload | null,
  fallbackMessage?: string,
): GradeAssistOutcome {
  const code = payload?.error;
  if (code === "FORBIDDEN" || code === "UNAUTHORIZED") {
    return {
      ok: false,
      reason: "forbidden",
      code,
      message: mapGradeAssistErrorCode(code),
    };
  }
  if (code === "GEMINI_NOT_CONFIGURED" || code === "NOT_CONFIGURED") {
    return {
      ok: false,
      reason: "unconfigured",
      code: "GEMINI_NOT_CONFIGURED",
      message: GRADE_ASSIST_UNCONFIGURED_MESSAGE,
    };
  }
  if (code) {
    return {
      ok: false,
      reason: "error",
      code,
      message: mapGradeAssistErrorCode(code, payload?.provider_message),
    };
  }
  return {
    ok: false,
    reason: "error",
    message: fallbackMessage || "La pré-correction IA est temporairement indisponible.",
  };
}

function toSuggestion(data: AssistPayload, fallbackMax: number): GradeAssistSuggestion | null {
  if (typeof data.suggested_score !== "number") return null;
  const maxScore =
    typeof data.max_score === "number" && data.max_score > 0 ? data.max_score : fallbackMax;
  const criteria = parseGradeAssistCriteria(data.criteria, maxScore);
  const criteriaScores =
    Object.keys(data.criteria_scores ?? {}).length > 0
      ? (data.criteria_scores ?? {})
      : criteriaToScoreMap(criteria);
  const modelAnswer = parseOptionalModelAnswer(data.model_answer);

  return {
    suggested_score: data.suggested_score,
    criteria_scores: criteriaScores,
    criteria,
    strengths: Array.isArray(data.strengths) ? data.strengths.map(String) : [],
    errors: parseGradeAssistErrors(data.errors),
    improvements: Array.isArray(data.improvements) ? data.improvements.map(String) : [],
    feedback: typeof data.feedback === "string" ? data.feedback : "",
    ...(typeof data.max_score === "number" ? { max_score: data.max_score } : {}),
    ...(modelAnswer ? { model_answer: modelAnswer } : {}),
    ...(typeof data.model === "string" ? { model: data.model } : {}),
  };
}

export const SupabaseGradeAssistService = {
  async suggest(input: GradeAssistInput): Promise<GradeAssistOutcome> {
    if (!isSupabaseConfigured) {
      return {
        ok: false,
        reason: "unconfigured",
        code: "GEMINI_NOT_CONFIGURED",
        message: GRADE_ASSIST_UNCONFIGURED_MESSAGE,
      };
    }

    try {
      const { data, error } = await getSupabase().functions.invoke<AssistPayload>(
        "gemini-grade-assist",
        {
          body: {
            level: input.level ?? null,
            subject: input.subject ?? null,
            instructions: input.instructions ?? null,
            response: input.response ?? null,
            rubric: input.rubric ?? null,
            maxScore: input.maxScore ?? null,
            targetKind: input.targetKind,
            targetId: input.targetId,
            studentId: input.studentId ?? null,
          },
        },
      );

      if (error) {
        const payload = (data as AssistPayload | null) ?? (await readInvokeErrorPayload(error));
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 403 || payload?.error === "FORBIDDEN") {
          return {
            ok: false,
            reason: "forbidden",
            code: "FORBIDDEN",
            message: mapGradeAssistErrorCode("FORBIDDEN"),
          };
        }
        if (status === 401 || payload?.error === "UNAUTHORIZED") {
          return {
            ok: false,
            reason: "forbidden",
            code: "UNAUTHORIZED",
            message: mapGradeAssistErrorCode("UNAUTHORIZED"),
          };
        }
        if (
          payload?.error === "GEMINI_NOT_CONFIGURED" ||
          payload?.error === "NOT_CONFIGURED" ||
          payload?.secret_present === false
        ) {
          return {
            ok: false,
            reason: "unconfigured",
            code: "GEMINI_NOT_CONFIGURED",
            message: GRADE_ASSIST_UNCONFIGURED_MESSAGE,
          };
        }
        if (payload?.error) {
          return failureFromPayload(payload);
        }
        return {
          ok: false,
          reason: "error",
          code: "GEMINI_PROVIDER_ERROR",
          message: mapGradeAssistErrorCode("GEMINI_PROVIDER_ERROR"),
        };
      }

      if (data?.error === "GEMINI_NOT_CONFIGURED" || data?.error === "NOT_CONFIGURED") {
        return {
          ok: false,
          reason: "unconfigured",
          code: "GEMINI_NOT_CONFIGURED",
          message: GRADE_ASSIST_UNCONFIGURED_MESSAGE,
        };
      }

      if (data?.error) {
        return failureFromPayload(data);
      }

      const suggestion = data
        ? toSuggestion(data, Math.max(1, Number(input.maxScore ?? 20)))
        : null;
      if (!suggestion || !suggestion.feedback) {
        return {
          ok: false,
          reason: "error",
          code: "GEMINI_INVALID_RESPONSE",
          message: mapGradeAssistErrorCode("GEMINI_INVALID_RESPONSE"),
        };
      }

      return { ok: true, suggestion };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      return {
        ok: false,
        reason: "error",
        code: "GEMINI_PROVIDER_ERROR",
        message: message || mapGradeAssistErrorCode("GEMINI_PROVIDER_ERROR"),
      };
    }
  },
};
