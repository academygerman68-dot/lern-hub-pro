/**
 * Fix matching option banks (a–j + 0) and repair known OCR-misread keys
 * (e.g. "falsch" on Lesen Teil3). Never publishes. Does not mark keys visually_confirmed.
 *
 * Usage: node scripts/repair-b1-matching-keys.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = "omxemusaqgzkogqvcdfw";
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
const PROPOSED = resolve(__dirname, "../tmp/b1-answer-keys-proposed.json");
const MISSING = resolve(__dirname, "../tmp/b1-missing-answer-keys.json");

function loadServiceRole() {
  const res = spawnSync(
    "supabase",
    ["projects", "api-keys", "--project-ref", PROJECT_REF, "-o", "json"],
    { encoding: "utf8", shell: true },
  );
  let raw = (res.stdout || "").trim();
  const start = raw.indexOf("[");
  raw = raw.slice(start, raw.lastIndexOf("]") + 1);
  const list = JSON.parse(raw);
  const service = list.find((k) => k.id === "service_role" || k.name === "service_role");
  if (!service?.api_key) throw new Error("service_role missing");
  return service.api_key;
}

function stableUuid(label) {
  const h = createHash("md5").update(`ga-b1-ocr:${label}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function asMeta(m) {
  return m && typeof m === "object" && !Array.isArray(m) ? m : {};
}

/** Parse "16i" / "18 f" / "19 0" style tokens from Lesen OCR solution line. */
function parseLesenMatchingFromOcr(ocrRaw) {
  const map = new Map();
  if (!ocrRaw) return map;
  // Prefer tokens 13–19 with letter or 0
  const re = /\b(1[3-9])\s*([a-jA-J0])\b/g;
  let m;
  while ((m = re.exec(ocrRaw)) !== null) {
    map.set(Number(m[1]), m[2].toLowerCase());
  }
  return map;
}

async function main() {
  const key = loadServiceRole();
  const supabase = createClient(PROJECT_URL, key, { auth: { persistSession: false } });
  const proposed = existsSync(PROPOSED) ? JSON.parse(readFileSync(PROPOSED, "utf8")) : null;
  const missing = existsSync(MISSING) ? JSON.parse(readFileSync(MISSING, "utf8")) : { items: [] };

  const ocrByExam = new Map();
  for (const b of proposed?.proposed_blocks || []) {
    ocrByExam.set(b.exam_id, parseLesenMatchingFromOcr(b.ocr_raw));
  }

  const targets = (missing.items || []).filter((i) => i.reason === "key_incompatible_with_options");
  const log = [];

  for (const item of targets) {
    const { data: q, error } = await supabase
      .from("exam_questions")
      .select(
        "id, type, prompt, metadata, options:exam_question_options(id, label, value, sort_order), answer_key:exam_answer_keys(question_id, correct_values, teacher_payload)",
      )
      .eq("id", item.question_id)
      .maybeSingle();
    if (error) throw error;
    if (!q) continue;

    const meta = asMeta(q.metadata);
    const existing = new Map((q.options || []).map((o) => [o.value, o]));
    const letters = [..."abcdefghij", "0"];
    const toInsert = [];
    for (let i = 0; i < letters.length; i++) {
      const v = letters[i];
      if (existing.has(v)) continue;
      toInsert.push({
        id: stableUuid(`option:${q.id}:${v}`),
        question_id: q.id,
        label: v,
        value: v,
        sort_order: 100 + i,
      });
    }
    if (toInsert.length) {
      const { error: iErr } = await supabase.from("exam_question_options").insert(toInsert);
      if (iErr) throw iErr;
    }

    let newKey = item.incompatible_key;
    const fromOcr = ocrByExam.get(item.exam_id)?.get(item.question_number);
    if (
      fromOcr &&
      (/^(richtig|falsch|ja|nein)$/i.test(String(item.incompatible_key)) ||
        !letters.includes(String(item.incompatible_key).toLowerCase()))
    ) {
      newKey = fromOcr;
    } else if (fromOcr && String(item.incompatible_key).toLowerCase() !== fromOcr) {
      // Keep stored key if it's already a letter present in OCR disagreement → prefer OCR letter only when stored is nonsense
      if (/^(richtig|falsch|ja|nein)$/i.test(String(item.incompatible_key))) newKey = fromOcr;
    }

    const teacher = asMeta(q.answer_key?.teacher_payload);
    const { error: kErr } = await supabase.from("exam_answer_keys").upsert(
      {
        question_id: q.id,
        correct_values: [newKey],
        teacher_payload: {
          ...teacher,
          answer_source: "official_pdf",
          answer_source_page: 247,
          verification_status: "ocr_parsed_needs_visual",
          ocr_original: String(item.incompatible_key),
          confirmed_value: newKey,
          repair_note:
            newKey !== item.incompatible_key
              ? `Replaced incompatible key ${item.incompatible_key} with OCR solutions token ${newKey}`
              : "Ensured matching option bank a–j+0 for key compatibility",
        },
      },
      { onConflict: "question_id" },
    );
    if (kErr) throw kErr;

    await supabase
      .from("exam_questions")
      .update({
        metadata: {
          ...meta,
          review_status: "needs_review",
          review_note:
            (meta.review_note ? meta.review_note + " · " : "") +
            "Matching options completed a–j+0; key checked against solutions OCR (visual still required)",
          matching_options_completed_at: new Date().toISOString(),
        },
      })
      .eq("id", q.id);

    log.push({
      exam_id: item.exam_id,
      question_number: item.question_number,
      old_key: item.incompatible_key,
      new_key: newKey,
      options_added: toInsert.map((o) => o.value),
      from_ocr: fromOcr || null,
    });
  }

  mkdirSync(resolve(__dirname, "../tmp"), { recursive: true });
  writeFileSync(
    resolve(__dirname, "../tmp/b1-matching-key-repair.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), fixed: log.length, items: log }, null, 2),
  );
  console.log(`Matching key repair: fixed=${log.length}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : JSON.stringify(e));
  process.exit(1);
});
