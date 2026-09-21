/**
 * Gemini grade-assist suggestions for teachers/admins.
 * Never auto-publishes scores. Reads GEMINI_API_KEY from Deno.env only.
 * Students must never receive suggestions from this endpoint.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...cors, "Cache-Control": "no-store", "Content-Type": "application/json" };

/** Prefer current Flash model; fallback if provider returns 404/503 for the primary. */
const GEMINI_MODELS = [
  "gemini-flash-latest",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
] as const;

const ERROR_CATEGORIES = [
  "Ordre des mots",
  "Conjugaison",
  "Grammaire",
  "Orthographe",
  "Vocabulaire",
  "Cas / déclinaison",
  "Temps verbal",
  "Ponctuation",
  "Autre",
] as const;

const ERROR_CATEGORY_ALIASES: Record<string, (typeof ERROR_CATEGORIES)[number]> = {
  "ordre des mots": "Ordre des mots",
  word_order: "Ordre des mots",
  conjugaison: "Conjugaison",
  conjugation: "Conjugaison",
  grammaire: "Grammaire",
  grammar: "Grammaire",
  orthographe: "Orthographe",
  spelling: "Orthographe",
  vocabulaire: "Vocabulaire",
  vocabulary: "Vocabulaire",
  "cas / déclinaison": "Cas / déclinaison",
  cas: "Cas / déclinaison",
  declinaison: "Cas / déclinaison",
  déclinaison: "Cas / déclinaison",
  case: "Cas / déclinaison",
  "temps verbal": "Temps verbal",
  tense: "Temps verbal",
  ponctuation: "Ponctuation",
  punctuation: "Ponctuation",
  autre: "Autre",
  other: "Autre",
};

const DEFAULT_CRITERIA = [
  { id: "task_completion", label: "Respect de la consigne" },
  { id: "comprehensibility", label: "Compréhensibilité" },
  { id: "vocabulary", label: "Vocabulaire" },
  { id: "grammar_and_spelling", label: "Grammaire / orthographe" },
] as const;

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

function clampScore(score: number, maxScore: number): number {
  const max = Math.max(1, maxScore);
  if (!Number.isFinite(score)) return 0;
  return Math.min(max, Math.max(0, Math.round(score * 10) / 10));
}

function logGeminiDiag(payload: Record<string, unknown>) {
  // Never log API keys, Authorization headers, or full student PII dumps.
  console.log(JSON.stringify({ scope: "gemini-grade-assist", ...payload }));
}

function classifyGeminiHttp(status: number, providerMessage: string): {
  code: string;
  http: number;
} {
  if (status === 401 || status === 403) {
    return { code: "GEMINI_AUTH_ERROR", http: 502 };
  }
  if (status === 429) {
    return { code: "GEMINI_RATE_LIMIT", http: 429 };
  }
  if (status === 404) {
    return { code: "GEMINI_MODEL_ERROR", http: 502 };
  }
  if (status >= 500) {
    return { code: "GEMINI_PROVIDER_ERROR", http: 502 };
  }
  if (/quota|rate.?limit|resource.?exhausted/i.test(providerMessage)) {
    return { code: "GEMINI_RATE_LIMIT", http: 429 };
  }
  if (/API.?key|permission|unauth|invalid.?key/i.test(providerMessage)) {
    return { code: "GEMINI_AUTH_ERROR", http: 502 };
  }
  if (/model|not.?found/i.test(providerMessage)) {
    return { code: "GEMINI_MODEL_ERROR", http: 502 };
  }
  return { code: "GEMINI_PROVIDER_ERROR", http: 502 };
}

function extractProviderMessage(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const err = (raw as { error?: { message?: string; status?: string } }).error;
  if (err?.message) return String(err.message).slice(0, 240);
  if (err?.status) return String(err.status).slice(0, 80);
  return "";
}

function parseModelJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeCategory(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Autre";
  const exact = ERROR_CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;
  return ERROR_CATEGORY_ALIASES[trimmed.toLowerCase()] ?? "Autre";
}

function normalizeCriteria(raw: unknown, maxScore: number) {
  const out: Array<{ id?: string; label: string; score: number; max_score: number }> = [];
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const record = row as Record<string, unknown>;
      const id = asString(record.id);
      const label =
        asString(record.label) ||
        (id
          ? DEFAULT_CRITERIA.find((c) => c.id === id)?.label || id.replace(/_/g, " ")
          : "");
      const max = Math.max(1, asNumber(record.max_score ?? record.max, maxScore / 4));
      const score = clampScore(asNumber(record.score, Number.NaN), max);
      if (!label || !Number.isFinite(asNumber(record.score, Number.NaN))) continue;
      out.push({ ...(id ? { id } : {}), label, score, max_score: max });
    }
  }
  if (out.length > 0) return out;

  // Fallback equal split when Gemini omitted criteria.
  const part = Math.floor((maxScore / DEFAULT_CRITERIA.length) * 10) / 10;
  let remaining = maxScore;
  return DEFAULT_CRITERIA.map((item, index) => {
    const max =
      index === DEFAULT_CRITERIA.length - 1
        ? Math.max(1, Math.round(remaining * 10) / 10)
        : Math.max(1, part);
    remaining = Math.round((remaining - max) * 10) / 10;
    return {
      id: item.id,
      label: item.label,
      score: clampScore(max * 0.7, max),
      max_score: max,
    };
  });
}

function normalizeErrors(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    category: string;
    original: string;
    correction: string;
    explanation: string;
  }> = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const original = asString(record.original);
    const correction = asString(record.correction);
    const explanation = asString(record.explanation);
    if (!original || !correction || !explanation) continue;
    out.push({
      category: normalizeCategory(asString(record.category)),
      original,
      correction,
      explanation,
    });
  }
  return out;
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

  const [{ data: isAdmin }, { data: isTeacher }] = await Promise.all([
    caller.rpc("is_admin"),
    caller.rpc("is_teacher"),
  ]);
  if (!isAdmin && !isTeacher) {
    return respond(403, { error: "FORBIDDEN" });
  }

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

  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim() ?? "";
  const secretPresent = geminiKey.length > 0;
  if (!secretPresent) {
    logGeminiDiag({ event: "secret_missing", code: "GEMINI_NOT_CONFIGURED" });
    return respond(503, {
      error: "GEMINI_NOT_CONFIGURED",
      secret_present: false,
    });
  }

  // Scope: teacher may only assist on rows their RLS can read (own groups). Admin sees all.
  if (targetId) {
    if (targetKind === "exam_writing") {
      const { data: question, error: qErr } = await caller
        .from("exam_questions")
        .select("id")
        .eq("id", targetId)
        .maybeSingle();
      if (qErr || !question) return respond(403, { error: "FORBIDDEN" });
    } else {
      const { data: submission, error: sErr } = await caller
        .from("assignment_submissions")
        .select("id")
        .eq("id", targetId)
        .maybeSingle();
      if (sErr || !submission) return respond(403, { error: "FORBIDDEN" });
    }
  }

  const prompt = [
    "Tu es un assistant de correction pédagogique pour une académie d'allemand.",
    "Tu aides un professeur : propose une note, une analyse précise et un feedback.",
    "Ne publie jamais la note automatiquement.",
    "",
    `Niveau CECR de l'étudiant: ${level || "non précisé"}`,
    `Type: ${subject || targetKind}`,
    `Note maximale (max_score): ${maxScore}`,
    rubric ? `Barème / critères existants: ${rubric}` : "",
    instructions ? `Consigne: ${instructions}` : "",
    responseText ? `Réponse de l'étudiant: ${responseText}` : "Réponse vide.",
    "",
    "Exigences d'analyse:",
    "- Analyse pédagogique adaptée STRICTEMENT au niveau CECR.",
    "- Liste UNIQUEMENT de vraies erreurs présentes dans le texte de l'étudiant.",
    "- Ne jamais inventer une erreur absente du texte.",
    "- Pour chaque erreur: reprendre le segment fautif exact (original), donner la correction allemande, expliquer brièvement en français.",
    "- category doit être l'une de: Ordre des mots | Conjugaison | Grammaire | Orthographe | Vocabulaire | Cas / déclinaison | Temps verbal | Ponctuation | Autre.",
    "- feedback: français, utile au professeur/étudiant.",
    "- model_answer: UNE version améliorée en allemand, respectant la consigne, le niveau CECR, les idées de l'étudiant, et la longueur demandée. Pas trop avancée.",
    "- Les phrases allemandes corrigées restent en allemand; les explications restent en français.",
    "",
    "Réponds UNIQUEMENT en JSON valide avec ce schéma:",
    "{",
    '  "suggested_score": number,',
    '  "max_score": number,',
    '  "criteria": [',
    '    {"label":"Respect de la consigne","score":number,"max_score":number},',
    '    {"label":"Compréhensibilité","score":number,"max_score":number},',
    '    {"label":"Vocabulaire","score":number,"max_score":number},',
    '    {"label":"Grammaire / orthographe","score":number,"max_score":number}',
    "  ],",
    '  "strengths": string[],',
    '  "errors": [',
    '    {"category":"Ordre des mots","original":"...","correction":"...","explanation":"..."}',
    "  ],",
    '  "improvements": string[],',
    '  "feedback": string,',
    '  "model_answer": string',
    "}",
    "suggested_score doit être entre 0 et max_score.",
    "Si aucune erreur: errors = [].",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    let lastStatus = 0;
    let lastProviderMessage = "";
    let usedModel = GEMINI_MODELS[0];
    let text = "";

    for (const model of GEMINI_MODELS) {
      usedModel = model;
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      lastStatus = geminiRes.status;
      const geminiJson = await geminiRes.json().catch(() => ({}));
      lastProviderMessage = extractProviderMessage(geminiJson);

      if (!geminiRes.ok) {
        logGeminiDiag({
          event: "provider_http_error",
          model,
          http_status: geminiRes.status,
          provider_message: lastProviderMessage || null,
        });
        const classified = classifyGeminiHttp(geminiRes.status, lastProviderMessage);
        // Try next model on not-found / temporary overload.
        if (
          geminiRes.status === 404 ||
          geminiRes.status === 503 ||
          classified.code === "GEMINI_MODEL_ERROR"
        ) {
          continue;
        }
        return respond(classified.http, {
          error: classified.code,
          secret_present: true,
          provider_status: geminiRes.status,
          provider_message: lastProviderMessage || undefined,
        });
      }

      text =
        geminiJson?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") ?? "";
      break;
    }

    if (!text && (lastStatus === 404 || lastStatus === 503)) {
      const classified = classifyGeminiHttp(lastStatus, lastProviderMessage);
      return respond(classified.http, {
        error: classified.code,
        secret_present: true,
        provider_status: lastStatus,
        provider_message: lastProviderMessage || undefined,
      });
    }

    const parsed = parseModelJson(text);
    if (!parsed) {
      logGeminiDiag({
        event: "invalid_response",
        code: "GEMINI_INVALID_RESPONSE",
        model: usedModel,
        http_status: lastStatus || 200,
      });
      return respond(502, {
        error: "GEMINI_INVALID_RESPONSE",
        secret_present: true,
        provider_status: lastStatus || 200,
      });
    }

    const suggested = clampScore(asNumber(parsed.suggested_score, Number.NaN), maxScore);
    if (!Number.isFinite(asNumber(parsed.suggested_score, Number.NaN))) {
      return respond(502, {
        error: "GEMINI_INVALID_RESPONSE",
        secret_present: true,
      });
    }

    const criteria = normalizeCriteria(parsed.criteria, maxScore);
    const criteriaScores: Record<string, number> = {};
    for (const item of criteria) {
      criteriaScores[item.id || item.label] = item.score;
    }

    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const improvements = Array.isArray(parsed.improvements)
      ? parsed.improvements.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const errors = normalizeErrors(parsed.errors);
    const modelAnswer = asString(parsed.model_answer) || null;
    const feedback = asString(parsed.feedback);
    if (!feedback) {
      return respond(502, {
        error: "GEMINI_INVALID_RESPONSE",
        secret_present: true,
      });
    }

    if (targetId) {
      void caller.from("ai_grade_suggestions").insert({
        target_kind: targetKind === "exam_writing" ? "exam_writing" : "assignment",
        target_id: targetId,
        student_id: studentId,
        requested_by: userData.user.id,
        level_code: level || null,
        prompt_meta: { subject, maxScore, model: usedModel },
        suggestion: {
          suggested_score: suggested,
          max_score: maxScore,
          criteria,
          criteria_scores: criteriaScores,
          strengths,
          errors,
          improvements,
          feedback,
          model_answer: modelAnswer,
        },
        model: usedModel,
        status: "proposed",
      });
    }

    logGeminiDiag({
      event: "success",
      model: usedModel,
      http_status: 200,
      suggested_score: suggested,
      max_score: maxScore,
      errors_count: errors.length,
      has_model_answer: Boolean(modelAnswer),
    });

    return respond(200, {
      suggested_score: suggested,
      max_score: maxScore,
      criteria,
      criteria_scores: criteriaScores,
      strengths,
      errors,
      improvements,
      feedback,
      ...(modelAnswer ? { model_answer: modelAnswer } : {}),
      model: usedModel,
      secret_present: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 160) : "unknown";
    logGeminiDiag({
      event: "provider_exception",
      code: "GEMINI_PROVIDER_ERROR",
      message,
    });
    return respond(502, {
      error: "GEMINI_PROVIDER_ERROR",
      secret_present: true,
    });
  }
});
