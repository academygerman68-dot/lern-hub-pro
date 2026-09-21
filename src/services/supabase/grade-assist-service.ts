import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { GRADE_ASSIST_UNCONFIGURED_MESSAGE } from "@/lib/grade-assist-ux";

export type GradeAssistSuggestion = {
  suggested_score: number;
  criteria_scores: Record<string, number>;
  strengths: string[];
  improvements: string[];
  feedback: string;
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
      message: string;
    };

export const SupabaseGradeAssistService = {
  async suggest(input: GradeAssistInput): Promise<GradeAssistOutcome> {
    if (!isSupabaseConfigured) {
      return {
        ok: false,
        reason: "unconfigured",
        message: GRADE_ASSIST_UNCONFIGURED_MESSAGE,
      };
    }

    try {
      const { data, error } = await getSupabase().functions.invoke<
        GradeAssistSuggestion & {
          error?: string;
          unconfigured?: boolean;
          mock?: boolean;
        }
      >("gemini-grade-assist", {
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
      });

      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        const message = error.message ?? "";
        if (status === 403 || /forbidden|not.?allowed/i.test(message)) {
          return {
            ok: false,
            reason: "forbidden",
            message: "Vous n’avez pas l’autorisation d’utiliser la pré-correction IA.",
          };
        }
        if (status === 401 || /unauthorized/i.test(message)) {
          return {
            ok: false,
            reason: "forbidden",
            message: "Session expirée — reconnectez-vous pour utiliser la pré-correction IA.",
          };
        }
        // Missing function / not configured → clear UX, never invent a score.
        if (
          status === 404 ||
          /not.?found|failed to send|functions?/i.test(message) ||
          /NOT_CONFIGURED/i.test(message)
        ) {
          return {
            ok: false,
            reason: "unconfigured",
            message: GRADE_ASSIST_UNCONFIGURED_MESSAGE,
          };
        }
        return {
          ok: false,
          reason: "error",
          message: message || "La pré-correction IA est temporairement indisponible.",
        };
      }

      if (data?.unconfigured || data?.error === "NOT_CONFIGURED" || data?.mock === true) {
        return {
          ok: false,
          reason: "unconfigured",
          message: GRADE_ASSIST_UNCONFIGURED_MESSAGE,
        };
      }

      if (data?.error === "FORBIDDEN") {
        return {
          ok: false,
          reason: "forbidden",
          message: "Vous n’avez pas l’autorisation d’utiliser la pré-correction IA.",
        };
      }

      if (!data || typeof data.suggested_score !== "number") {
        return {
          ok: false,
          reason: "error",
          message: "La pré-correction IA n’a pas renvoyé de proposition exploitable.",
        };
      }

      return {
        ok: true,
        suggestion: {
          suggested_score: data.suggested_score,
          criteria_scores: data.criteria_scores ?? {},
          strengths: Array.isArray(data.strengths) ? data.strengths : [],
          improvements: Array.isArray(data.improvements) ? data.improvements : [],
          feedback: typeof data.feedback === "string" ? data.feedback : "",
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/not.?configured|NOT_CONFIGURED/i.test(message)) {
        return {
          ok: false,
          reason: "unconfigured",
          message: GRADE_ASSIST_UNCONFIGURED_MESSAGE,
        };
      }
      return {
        ok: false,
        reason: "error",
        message: message || "La pré-correction IA est temporairement indisponible.",
      };
    }
  },
};
