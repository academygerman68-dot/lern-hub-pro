import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type GradeAssistSuggestion = {
  suggested_score: number;
  criteria_scores: Record<string, number>;
  strengths: string[];
  improvements: string[];
  feedback: string;
  mock?: boolean;
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

export const SupabaseGradeAssistService = {
  async suggest(input: GradeAssistInput): Promise<GradeAssistSuggestion> {
    if (!isSupabaseConfigured) {
      return mockSuggestion(input);
    }

    try {
      const { data, error } = await getSupabase().functions.invoke<
        GradeAssistSuggestion & { error?: string }
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

      if (error) throw error;
      if (!data || typeof data.suggested_score !== "number") {
        return mockSuggestion(input);
      }
      return {
        suggested_score: data.suggested_score,
        criteria_scores: data.criteria_scores ?? {},
        strengths: Array.isArray(data.strengths) ? data.strengths : [],
        improvements: Array.isArray(data.improvements) ? data.improvements : [],
        feedback: typeof data.feedback === "string" ? data.feedback : "",
        mock: Boolean(data.mock),
      };
    } catch {
      return mockSuggestion(input);
    }
  },
};

function mockSuggestion(input: GradeAssistInput): GradeAssistSuggestion {
  const max = Math.max(1, Number(input.maxScore ?? 20));
  const suggested = Math.round(max * 0.7 * 10) / 10;
  return {
    suggested_score: suggested,
    criteria_scores: {
      contenu: Math.round(suggested * 0.4 * 10) / 10,
      langue: Math.round(suggested * 0.3 * 10) / 10,
      structure: Math.round(suggested * 0.3 * 10) / 10,
    },
    strengths: ["Réponse structurée", "Vocabulaire adapté au niveau"],
    improvements: ["Préciser davantage les exemples", "Relire l’orthographe"],
    feedback:
      "Suggestion locale (mock) — vérifiez et ajustez la note avant d’enregistrer la correction.",
    mock: true,
  };
}
