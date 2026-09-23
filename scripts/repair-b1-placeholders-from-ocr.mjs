/**
 * Repair B1 placeholders by re-parsing stored OCR with improved extractors.
 * Never invents prose; never publishes. Visual confirmation still required.
 *
 * Usage: node scripts/repair-b1-placeholders-from-ocr.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractMatchingItems,
  extractSingleChoiceItems,
} from "./lib/b1-extractors.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = "omxemusaqgzkogqvcdfw";
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;

const SCORING_META = {
  points_rubric: "provisional_needs_review",
  scoring_label: "Barème pédagogique interne, à confirmer",
  scoring_source: "not_found_in_pdf_intro_scan",
  scoring_note:
    "PDF intro pages are scan-only; no explicit official Goethe points table transcribed. Internal 1pt Lesen/Hören objective items; Schreiben/Sprechen manual grids. Manual validation required before publish.",
  scoring_official: false,
};

function loadServiceRole() {
  const res = spawnSync(
    "supabase",
    ["projects", "api-keys", "--project-ref", PROJECT_REF, "-o", "json"],
    { encoding: "utf8", shell: true },
  );
  let raw = (res.stdout || "").trim();
  const iArr = raw.indexOf("[");
  const start = iArr >= 0 ? iArr : raw.indexOf("{");
  raw = raw.slice(start);
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  raw = raw.slice(0, end + 1);
  const list = JSON.parse(raw);
  const service = (Array.isArray(list) ? list : []).find(
    (k) => k.id === "service_role" || k.name === "service_role",
  );
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

function isPlaceholder(q, meta) {
  return (
    meta.transform_status === "placeholder" ||
    /OCR (in)?compl|Frage \d+ —|Situation \d+ —/i.test(q.prompt || "")
  );
}

async function main() {
  const key = loadServiceRole();
  const supabase = createClient(PROJECT_URL, key, { auth: { persistSession: false } });

  const { data: exams, error } = await supabase
    .from("exams")
    .select(
      "id, code, sections:exam_sections(id, skill, questions:exam_questions(id, type, prompt, points, sort_order, metadata, options:exam_question_options(id, value, label, sort_order)))",
    )
    .like("code", "B1-MT%")
    .order("code");
  if (error) throw error;

  const log = [];
  let repaired = 0;
  let stillNeedsReview = 0;
  let scoringStamped = 0;

  for (const exam of exams || []) {
    for (const section of exam.sections || []) {
      for (const q of section.questions || []) {
        const meta = asMeta(q.metadata);
        const nextMeta = { ...meta, ...SCORING_META };

        const ocr =
          typeof meta.ocr_raw_prompt === "string"
            ? meta.ocr_raw_prompt
            : typeof meta.source?.ocr_text === "string"
              ? meta.source.ocr_text
              : "";

        if (!isPlaceholder(q, meta)) {
          const { error: u1 } = await supabase
            .from("exam_questions")
            .update({
              metadata: nextMeta,
              points:
                section.skill === "lesen" || section.skill === "hoeren"
                  ? Math.max(1, Number(q.points) || 1)
                  : Number(q.points) || 0,
            })
            .eq("id", q.id);
          if (u1) throw u1;
          scoringStamped += 1;
          continue;
        }

        let fixed = null;
        const part = Number(meta.teil ?? meta.part ?? 0);
        const n = Number(q.sort_order);

        if (section.skill === "lesen" && q.type === "single_choice") {
          const from = n <= 12 ? 7 : 27;
          const to = n <= 12 ? 12 : 30;
          const block = extractSingleChoiceItems(ocr, from, to);
          const hit = block.get(n);
          if (hit && hit.prompt.length > 8 && hit.options.length === 3) {
            fixed = {
              prompt: hit.prompt,
              options: hit.options,
              transform_status: "structured",
              review_status: "needs_review",
              review_note:
                "Reparsed from stored OCR (unnumbered stems); visual PDF confirmation still required",
            };
          }
        }

        if (section.skill === "lesen" && q.type === "matching") {
          const situ = extractMatchingItems(ocr, 13, 19);
          const hit = situ.get(n);
          if (hit && hit.prompt.length > 8) {
            const opts =
              hit.options.length >= 3
                ? hit.options
                : (q.options || []).map((o) => ({
                    id: o.value,
                    label: o.label || o.value,
                    text: o.label || o.value,
                  }));
            fixed = {
              prompt: hit.prompt,
              options: opts.length >= 3 ? opts : null,
              transform_status: opts.length >= 3 ? "structured" : "needs_review",
              review_status: "needs_review",
              review_note:
                "Situation recovered from OCR (incl. dropped tens digit / unnumbered line); visual check required",
            };
          }
        }

        // true_false / listening: keep placeholder if OCR cannot yield a clear stem
        if (
          !fixed &&
          (q.type === "true_false" || q.type === "listening") &&
          ocr.length > 40
        ) {
          // Do not invent — only clear numbered line for this question
          const re = new RegExp(
            `(?:^|\\n)\\s*${n}\\s*([A-Za-zÄÖÜäöüß][^\\n]{12,200})`,
            "m",
          );
          const m = ocr.match(re);
          if (m?.[1] && !/OCR|unvollst/i.test(m[1])) {
            fixed = {
              prompt: m[1].trim(),
              options: null,
              transform_status: "structured",
              review_status: "needs_review",
              review_note: "Stem line recovered from OCR number marker; visual check required",
            };
          }
        }

        if (fixed) {
          if (fixed.options && fixed.options.length >= 3) {
            await supabase.from("exam_question_options").delete().eq("question_id", q.id);
            const rows = fixed.options.map((opt, idx) => ({
              id: stableUuid(`option:${q.id}:${opt.id}`),
              question_id: q.id,
              label: opt.label || opt.id,
              value: opt.id,
              sort_order: idx + 1,
            }));
            const { error: oErr } = await supabase.from("exam_question_options").insert(rows);
            if (oErr) throw oErr;
          }
          const { error: uErr } = await supabase
            .from("exam_questions")
            .update({
              prompt: fixed.prompt,
              points: section.skill === "lesen" || section.skill === "hoeren" ? 1 : q.points,
              metadata: {
                ...nextMeta,
                transform_status: fixed.transform_status,
                review_status: fixed.review_status,
                review_note: fixed.review_note,
                ocr_raw_prompt: ocr || meta.ocr_raw_prompt || q.prompt,
                ocr_original_prompt: meta.ocr_original_prompt || q.prompt,
                placeholder_repaired_at: new Date().toISOString(),
                teil: part || meta.teil,
              },
            })
            .eq("id", q.id);
          if (uErr) throw uErr;
          repaired += 1;
          log.push({
            exam_id: exam.code,
            skill: section.skill,
            part: part || null,
            question_number: n,
            source_pdf_page: meta.source?.source_pdf_page ?? null,
            ocr_original: (ocr || q.prompt || "").slice(0, 300),
            corrected_value: fixed.prompt.slice(0, 300),
            review_status: fixed.review_status,
            review_note: fixed.review_note,
          });
        } else {
          stillNeedsReview += 1;
          await supabase
            .from("exam_questions")
            .update({
              metadata: {
                ...nextMeta,
                transform_status: "placeholder",
                review_status: "needs_review",
                review_note:
                  "Placeholder retained — OCR incomplete or ambiguous; visual PDF page required",
              },
            })
            .eq("id", q.id);
          log.push({
            exam_id: exam.code,
            skill: section.skill,
            part: part || null,
            question_number: n,
            source_pdf_page: meta.source?.source_pdf_page ?? null,
            ocr_original: (q.prompt || "").slice(0, 300),
            corrected_value: "",
            review_status: "needs_review",
            review_note: "Unrecoverable from stored OCR alone",
          });
        }
      }
    }
  }

  mkdirSync(resolve(__dirname, "../tmp"), { recursive: true });
  writeFileSync(
    resolve(__dirname, "../tmp/b1-placeholder-repair-log.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        repaired,
        still_needs_review: stillNeedsReview,
        scoring_stamped: scoringStamped,
        items: log,
      },
      null,
      2,
    ),
  );
  console.log(
    `Placeholder repair: repaired=${repaired} still_needs_review=${stillNeedsReview} scoring_stamped=${scoringStamped}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : JSON.stringify(e, null, 2));
  process.exit(1);
});
