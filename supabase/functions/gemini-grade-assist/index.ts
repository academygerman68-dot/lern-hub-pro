/**
 * Gemini grade-assist suggestions for teachers/admins.
 * Supports text + multimodal (images / PDF) from private submission storage.
 * Never auto-publishes scores. Reads GEMINI_API_KEY from Deno.env only.
 * Students must never receive suggestions from this endpoint.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...cors, "Cache-Control": "no-store", "Content-Type": "application/json" };

/** Prefer current Flash models; skip legacy 2.5 for new API keys (404). */
const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
] as const;

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const MULTIMODAL_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

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
  if (status === 503 || /high demand|try again later|unavailable|overloaded/i.test(providerMessage)) {
    return { code: "GEMINI_RATE_LIMIT", http: 429 };
  }
  if (status === 404 || /no longer available|not found|not supported for/i.test(providerMessage)) {
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
  if (/model/i.test(providerMessage) && /not|unavailable|invalid/i.test(providerMessage)) {
    return { code: "GEMINI_MODEL_ERROR", http: 502 };
  }
  return { code: "GEMINI_PROVIDER_ERROR", http: 502 };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function inferMimeFromPath(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return null;
}

function normalizeMime(raw: string | null | undefined, path?: string | null): string | null {
  const mime = (raw ?? "").split(";")[0]?.trim().toLowerCase() || "";
  if (mime === "image/jpg") return "image/jpeg";
  if (MULTIMODAL_MIME.has(mime)) return mime;
  if (path) return inferMimeFromPath(path);
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

  const mediaParts: GeminiPart[] = [];
  const analyzedAttachments: Array<{ mime: string; size: number; path: string }> = [];

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
        .select("id, file_bucket, file_path, student_id, content_text")
        .eq("id", targetId)
        .maybeSingle();
      if (sErr || !submission) return respond(403, { error: "FORBIDDEN" });

      if (submission.file_bucket && submission.file_path) {
        if (!serviceRoleKey) {
          logGeminiDiag({ event: "service_role_missing", code: "SERVICE_UNAVAILABLE" });
          return respond(503, { error: "SERVICE_UNAVAILABLE", secret_present: true });
        }

        const admin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: blob, error: dlErr } = await admin.storage
          .from(submission.file_bucket)
          .download(submission.file_path);

        if (dlErr || !blob) {
          logGeminiDiag({
            event: "attachment_download_failed",
            code: "UNREADABLE_ATTACHMENT",
            reason: dlErr?.message?.slice(0, 120) ?? "empty",
          });
          return respond(422, {
            error: "UNREADABLE_ATTACHMENT",
            secret_present: true,
            message:
              "Le fichier de remise n’a pas pu être lu. Ouvrez-le manuellement ; aucune analyse inventée.",
          });
        }

        const size = blob.size;
        if (size <= 0 || size > MAX_ATTACHMENT_BYTES) {
          return respond(422, {
            error: "UNREADABLE_ATTACHMENT",
            secret_present: true,
            message:
              size > MAX_ATTACHMENT_BYTES
                ? "Fichier trop volumineux pour l’analyse multimodale (max 15 Mo)."
                : "Fichier vide ou illisible.",
          });
        }

        const mime = normalizeMime(blob.type, submission.file_path);
        if (!mime || !MULTIMODAL_MIME.has(mime)) {
          // File present but not multimodal — require text; do not pretend to read it.
          if (!responseText && !asString(submission.content_text)) {
            return respond(422, {
              error: "UNREADABLE_ATTACHMENT",
              secret_present: true,
              message:
                "Ce type de fichier n’est pas analysable par l’IA (images JPEG/PNG/WEBP/GIF ou PDF uniquement). Ouvrez-le manuellement.",
            });
          }
          logGeminiDiag({
            event: "attachment_skipped_non_multimodal",
            mime: blob.type || null,
            path_ext: submission.file_path.split(".").pop() ?? null,
          });
        } else {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          mediaParts.push({
            inlineData: { mimeType: mime, data: bytesToBase64(bytes) },
          });
          analyzedAttachments.push({
            mime,
            size,
            path: submission.file_path.split("/").pop() ?? "attachment",
          });
        }
      }
    }
  }

  if (!responseText && mediaParts.length === 0) {
    return respond(422, {
      error: "UNREADABLE_ATTACHMENT",
      secret_present: true,
      message:
        "Aucune réponse textuelle ni fichier image/PDF lisible pour la pré-correction IA.",
    });
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
    responseText
      ? `Réponse textuelle de l'étudiant: ${responseText}`
      : mediaParts.length
        ? "Réponse textuelle: absente — analyse le(s) fichier(s) joints (image ou PDF)."
        : "Réponse vide.",
    analyzedAttachments.length
      ? `Fichiers joints analysés: ${analyzedAttachments
          .map((a) => `${a.path} (${a.mime}, ${a.size} octets)`)
          .join("; ")}`
      : "",
    "",
    "Exigences d'analyse:",
    "- Analyse pédagogique adaptée STRICTEMENT au niveau CECR.",
    "- Si un fichier image/PDF est fourni, lis réellement son contenu visible (texte manuscrit ou imprimé).",
    "- Si le fichier est illisible ou hors sujet, dis-le clairement dans feedback et ne fabrique pas d'erreurs.",
    "- Liste UNIQUEMENT de vraies erreurs présentes dans le texte (saisi ou lu dans le fichier).",
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

  const parts: GeminiPart[] = [{ text: prompt }, ...mediaParts];

  try {
    let lastStatus = 0;
    let lastProviderMessage = "";
    let lastCode = "GEMINI_PROVIDER_ERROR";
    let usedModel = GEMINI_MODELS[0];
    let text = "";
    let sawRateLimit = false;
    let sawModelError = false;

    for (const model of GEMINI_MODELS) {
      usedModel = model;
      let attempt = 0;
      while (attempt < 2) {
        attempt += 1;
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
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
          const classified = classifyGeminiHttp(geminiRes.status, lastProviderMessage);
          lastCode = classified.code;
          logGeminiDiag({
            event: "provider_http_error",
            model,
            http_status: geminiRes.status,
            provider_message: lastProviderMessage || null,
            multimodal: mediaParts.length > 0,
            attempt,
            classified: classified.code,
          });
          if (classified.code === "GEMINI_RATE_LIMIT") {
            sawRateLimit = true;
            if (attempt < 2) {
              await sleep(700 * attempt);
              continue;
            }
            break;
          }
          if (classified.code === "GEMINI_MODEL_ERROR") {
            sawModelError = true;
            break;
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
      if (text) break;
    }

    if (!text) {
      const code = sawRateLimit
        ? "GEMINI_RATE_LIMIT"
        : sawModelError
          ? "GEMINI_MODEL_ERROR"
          : lastCode;
      const classified = classifyGeminiHttp(lastStatus, lastProviderMessage);
      return respond(code === "GEMINI_RATE_LIMIT" ? 429 : classified.http, {
        error: code,
        secret_present: true,
        provider_status: lastStatus || undefined,
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
        prompt_meta: {
          subject,
          maxScore,
          model: usedModel,
          multimodal: analyzedAttachments,
        },
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
      multimodal_count: analyzedAttachments.length,
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
      multimodal: analyzedAttachments.length > 0,
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
