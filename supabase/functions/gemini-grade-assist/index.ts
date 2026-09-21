/**
 * Gemini grade-assist suggestions for teachers.
 * Never auto-publishes scores. Reads GEMINI_API_KEY from Deno.env only.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...cors, "Cache-Control": "no-store", "Content-Type": "application/json" };

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mockSuggestion(maxScore: number) {
  const suggested = Math.round(maxScore * 0.7 * 10) / 10;
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
      "Suggestion locale (mock) — aucune clé GEMINI_API_KEY configurée. Ajustez avant d’enregistrer.",
    mock: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return respond(503, { error: "SERVICE_UNAVAILABLE" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond(401, { error: "UNAUTHORIZED" });

  const caller = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return respond(401, { error: "UNAUTHORIZED" });

  const body = await req.json().catch(() => ({}));
  const level = asString(body.level);
  const subject = asString(body.subject);
  const instructions = asString(body.instructions);
  const responseText = asString(body.response);
  const rubric = asString(body.rubric);
  const maxScore = Math.max(1, asNumber(body.maxScore ?? body.max_score, 20));
  const targetKind = asString(body.targetKind ?? body.target_kind) || "assignment";
  const targetId = asString(body.targetId ?? body.target_id);
  const studentId = asString(body.studentId ?? body.student_id) || null;

  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!geminiKey) {
    return respond(200, mockSuggestion(maxScore));
  }

  const prompt = [
    "Tu es un assistant de correction pour une académie de langues.",
    "Propose une note et un feedback en français. Ne publie jamais la note automatiquement.",
    `Niveau: ${level || "non précisé"}`,
    `Matière / type: ${subject || targetKind}`,
    `Note maximale: ${maxScore}`,
    rubric ? `Barème / critères: ${rubric}` : "",
    instructions ? `Consigne: ${instructions}` : "",
    responseText ? `Réponse de l'étudiant: ${responseText}` : "Réponse vide.",
    "",
    "Réponds UNIQUEMENT en JSON valide avec les clés:",
    "suggested_score (number), criteria_scores (object of numbers),",
    "strengths (string[]), improvements (string[]), feedback (string).",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      },
    );

    if (!geminiRes.ok) {
      return respond(200, { ...mockSuggestion(maxScore), mock: true, model_error: true });
    }

    const geminiJson = await geminiRes.json();
    const text =
      geminiJson?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return respond(200, { ...mockSuggestion(maxScore), mock: true, parse_error: true });
    }

    const suggested = Math.min(
      maxScore,
      Math.max(0, asNumber(parsed.suggested_score, maxScore * 0.7)),
    );
    const criteria =
      parsed.criteria_scores &&
      typeof parsed.criteria_scores === "object" &&
      !Array.isArray(parsed.criteria_scores)
        ? (parsed.criteria_scores as Record<string, number>)
        : {};
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.map((s) => String(s)) : [];
    const improvements = Array.isArray(parsed.improvements)
      ? parsed.improvements.map((s) => String(s))
      : [];
    const feedback = asString(parsed.feedback) || "Suggestion Gemini — à valider.";

    // Optional audit trail (ignore failures).
    if (targetId) {
      void caller.from("ai_grade_suggestions").insert({
        target_kind: targetKind === "exam_writing" ? "exam_writing" : "assignment",
        target_id: targetId,
        student_id: studentId,
        requested_by: userData.user.id,
        level_code: level || null,
        prompt_meta: { subject, maxScore },
        suggestion: {
          suggested_score: suggested,
          criteria_scores: criteria,
          strengths,
          improvements,
          feedback,
        },
        model: "gemini-2.0-flash",
        status: "proposed",
      });
    }

    return respond(200, {
      suggested_score: suggested,
      criteria_scores: criteria,
      strengths,
      improvements,
      feedback,
      mock: false,
    });
  } catch {
    return respond(200, { ...mockSuggestion(maxScore), mock: true });
  }
});
