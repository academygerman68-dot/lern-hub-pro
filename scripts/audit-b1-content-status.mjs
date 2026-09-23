/**
 * Full B1 content status audit → tmp/b1-content-status-audit.json
 * Uses service_role via supabase CLI (never logged). Read-only.
 *
 * Usage: node scripts/audit-b1-content-status.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Load compiled-less TS via vitest path is hard; inline minimal classify for Node.

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = "omxemusaqgzkogqvcdfw";
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
const OUT = resolve(__dirname, "../tmp");

function loadServiceRole() {
  const res = spawnSync(
    "supabase",
    ["projects", "api-keys", "--project-ref", PROJECT_REF, "-o", "json"],
    { encoding: "utf8", shell: true },
  );
  if (res.status !== 0) throw new Error(`CLI api-keys failed: ${res.status}`);
  let raw = (res.stdout || "").trim();
  const iArr = raw.indexOf("[");
  const iObj = raw.indexOf("{");
  let start = iArr >= 0 && (iObj < 0 || iArr < iObj) ? iArr : iObj;
  if (start < 0) throw new Error("no JSON from CLI");
  raw = raw.slice(start);
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  if (end >= 0) raw = raw.slice(0, end + 1);
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed.keys || [];
  const service = list.find((k) => k.id === "service_role" || k.name === "service_role");
  if (!service?.api_key) throw new Error("service_role missing");
  return service.api_key;
}

function asMeta(m) {
  return m && typeof m === "object" && !Array.isArray(m) ? m : {};
}

function looksGlued(text) {
  if (!text || text.length < 20) return false;
  const joins = text.match(/[a-zäöüß][A-ZÄÖÜ]/g);
  if ((joins?.length ?? 0) >= 2) return true;
  return text.split(/\s+/).some((t) => t.length >= 28 && /[a-zäöüß]{10,}/i.test(t));
}

function isPlaceholder(prompt, meta) {
  if (meta.transform_status === "placeholder") return true;
  return /OCR (in)?compl|Frage \d+ —|Situation \d+ —|Aussage \d+ —/i.test(prompt || "");
}

function classify(q, skill) {
  const meta = asMeta(q.metadata);
  const prompt = String(q.prompt || "");
  const type = String(q.type || "");
  const teil = Number(meta.audio_slot ?? meta.teil ?? meta.part);
  const teilN = Number.isFinite(teil) && teil >= 1 ? Math.floor(teil) : null;
  const reasons = [];
  const opts = q.options || [];
  const keys = q.answer_key?.correct_values || [];
  const needsKey = ["lesen", "hoeren"].includes(skill) &&
    ["single_choice", "true_false", "matching", "listening", "multiple_choice"].includes(type);

  if (isPlaceholder(prompt, meta)) reasons.push("placeholder_ocr");
  if (!prompt.trim()) reasons.push("empty_prompt");
  if (needsKey) {
    if (!opts.length) reasons.push("empty_options");
    if (!keys.length) reasons.push("missing_key");
    else if (opts.length && !keys.every((k) => opts.some((o) => o.value === k || o.label === k))) {
      reasons.push("incompatible_key");
    }
  }
  if ((skill === "hoeren" || type === "listening") && !(q.media_path && q.media_bucket)) {
    reasons.push("missing_audio");
  }

  if (reasons.some((r) =>
    ["placeholder_ocr", "empty_prompt", "empty_options", "missing_key", "incompatible_key", "missing_audio"].includes(r),
  )) {
    return { status: "blocked", reasons, teil: teilN };
  }

  if (looksGlued(prompt)) reasons.push("glued_ocr");
  if (meta.needs_review === true || meta.transcription_status === "ocr_unverified") {
    reasons.push("transcription_unverified");
  }
  if (meta.points_rubric === "provisional_needs_review") reasons.push("provisional_rubric");
  if ((skill === "hoeren" || type === "listening") && meta.audio_verification_status !== "content_verified") {
    reasons.push("audio_unverified");
  }

  if (reasons.length) return { status: "needs_review", reasons, teil: teilN };
  return { status: "ready", reasons: [], teil: teilN };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const key = loadServiceRole();
  const supabase = createClient(PROJECT_URL, key, { auth: { persistSession: false } });

  const { data: exams, error } = await supabase
    .from("exams")
    .select(
      "id, code, title, status, duration_minutes, sections:exam_sections(id, skill, title, sort_order, questions:exam_questions(id, type, prompt, points, sort_order, media_path, media_bucket, metadata, options:exam_question_options(id, label, value), answer_key:exam_answer_keys(correct_values)))",
    )
    .like("code", "B1-MT%")
    .order("code");
  if (error) throw error;

  const { data: tracks } = await supabase
    .from("exam_audio_tracks")
    .select("exam_id, part_number, media_path, verification_status");

  const tracksByExam = new Map();
  for (const t of tracks || []) {
    if (!tracksByExam.has(t.exam_id)) tracksByExam.set(t.exam_id, []);
    tracksByExam.get(t.exam_id).push(t);
  }

  const report = {
    generated_at: new Date().toISOString(),
    playback_authority: "exam_questions.media_path → ExamService.getExam signed URL",
    inventory_table: "exam_audio_tracks (admin mirror only; 0 content_verified expected until human listen)",
    exams: [],
  };

  for (const exam of exams || []) {
    const totals = { ready: 0, needs_review: 0, blocked: 0, questions: 0 };
    const bySkillTeil = {};
    const blockedItems = [];
    const audioPaths = {};

    for (const section of (exam.sections || []).slice().sort((a, b) => a.sort_order - b.sort_order)) {
      for (const q of (section.questions || []).slice().sort((a, b) => a.sort_order - b.sort_order)) {
        const c = classify(q, section.skill);
        totals.questions += 1;
        totals[c.status] += 1;
        const key = `${section.skill}:teil-${c.teil ?? "?"}`;
        bySkillTeil[key] = bySkillTeil[key] || { ready: 0, needs_review: 0, blocked: 0, questions: 0 };
        bySkillTeil[key].questions += 1;
        bySkillTeil[key][c.status] += 1;
        if (c.status === "blocked") {
          blockedItems.push({
            skill: section.skill,
            teil: c.teil,
            sort_order: q.sort_order,
            question_id: q.id,
            type: q.type,
            reasons: c.reasons,
            prompt_preview: String(q.prompt || "").slice(0, 100),
          });
        }
        if (section.skill === "hoeren" && c.teil >= 1 && c.teil <= 4) {
          audioPaths[c.teil] = q.media_path || audioPaths[c.teil] || null;
        }
      }
    }

    const inv = tracksByExam.get(exam.id) || [];
    const divergence = [];
    for (const slot of [1, 2, 3, 4]) {
      const qPath = audioPaths[slot] || null;
      const t = inv.find((r) => r.part_number === slot);
      const iPath = t?.media_path || null;
      if (qPath && iPath && qPath !== iPath) {
        divergence.push({ slot, question: qPath, inventory: iPath });
      }
    }

    report.exams.push({
      code: exam.code,
      title: exam.title,
      status: exam.status,
      duration_minutes: exam.duration_minutes,
      structure: {
        lesen: (exam.sections || []).find((s) => s.skill === "lesen")?.questions?.length ?? 0,
        hoeren: (exam.sections || []).find((s) => s.skill === "hoeren")?.questions?.length ?? 0,
        schreiben: (exam.sections || []).find((s) => s.skill === "schreiben")?.questions?.length ?? 0,
        sprechen: (exam.sections || []).find((s) => s.skill === "sprechen")?.questions?.length ?? 0,
      },
      totals,
      bySkillTeil,
      blockedItems,
      audio: {
        question_paths: [1, 2, 3, 4].map((s) => ({ slot: s, path: audioPaths[s] || null })),
        inventory_tracks: inv.map((t) => ({
          part: t.part_number,
          path: t.media_path,
          verification_status: t.verification_status,
        })),
        slots_technically_available: [1, 2, 3, 4].filter((s) => audioPaths[s]).length,
        slots_human_verified: inv.filter((t) => t.verification_status === "content_verified").length,
        inventory_divergence: divergence,
      },
    });
  }

  const path = resolve(OUT, "b1-content-status-audit.json");
  writeFileSync(path, JSON.stringify(report, null, 2));
  const sum = report.exams.reduce(
    (a, e) => {
      a.ready += e.totals.ready;
      a.needs_review += e.totals.needs_review;
      a.blocked += e.totals.blocked;
      return a;
    },
    { ready: 0, needs_review: 0, blocked: 0 },
  );
  console.log(JSON.stringify({ out: path, exams: report.exams.length, sum }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
