/**
 * Audit live B1 exams in Supabase and write the four required JSON reports.
 * Uses CLI service_role (never logged). Never publishes.
 *
 * Usage: node scripts/audit-b1-imported.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function sourcePage(meta) {
  const src = asMeta(meta.source);
  if (typeof src.source_pdf_page === "number") return src.source_pdf_page;
  const pages = src.pages;
  if (Array.isArray(pages) && pages[0] && typeof pages[0].source_pdf_page === "number") {
    return pages[0].source_pdf_page;
  }
  if (Array.isArray(meta.parent_page_ids) && meta.parent_page_ids[0]) {
    // bank ids embed page; leave null if unknown
  }
  return typeof meta.expected_number === "number" ? null : null;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const key = loadServiceRole();
  const supabase = createClient(PROJECT_URL, key, { auth: { persistSession: false } });

  const { data: exams, error: eErr } = await supabase
    .from("exams")
    .select(
      "id, code, title, status, published_at, duration_minutes, sections:exam_sections(id, skill, title, sort_order, questions:exam_questions(id, type, prompt, points, sort_order, media_path, media_bucket, metadata, options:exam_question_options(id, label, value, sort_order), answer_key:exam_answer_keys(question_id, correct_values, teacher_payload)))",
    )
    .like("code", "B1-MT%")
    .order("code");
  if (eErr) throw eErr;

  const { data: a1 } = await supabase
    .from("exams")
    .select("code, status, published_at")
    .like("code", "A1-%")
    .order("code");

  const placeholders = [];
  const missingKeys = [];
  const audioAudit = [];
  const scoringAudit = [];
  const summaryRows = [];

  for (const exam of exams || []) {
    const sections = (exam.sections || []).slice().sort((a, b) => a.sort_order - b.sort_order);
    const bySkill = Object.fromEntries(sections.map((s) => [s.skill, s]));
    const lesen = bySkill.lesen?.questions || [];
    const hoeren = bySkill.hoeren?.questions || [];
    const schreiben = bySkill.schreiben?.questions || [];
    const sprechen = bySkill.sprechen?.questions || [];

    const allQs = [...lesen, ...hoeren, ...schreiben, ...sprechen];
    const ids = allQs.map((q) => q.id);
    const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);

    for (const skill of ["lesen", "hoeren", "schreiben", "sprechen"]) {
      const qs = (bySkill[skill]?.questions || []).slice().sort((a, b) => a.sort_order - b.sort_order);
      const orders = qs.map((q) => q.sort_order);
      const dupOrders = orders.filter((o, i) => orders.indexOf(o) !== i);
      for (const q of qs) {
        const meta = asMeta(q.metadata);
        const isPlaceholder =
          meta.transform_status === "placeholder" ||
          /OCR (in)?compl[eè]te|placeholder|Frage \d+ —/i.test(q.prompt || "");
        const opts = q.options || [];
        const needsOpts = ["true_false", "single_choice", "matching", "listening"].includes(q.type);
        const emptyOpts = needsOpts && opts.length === 0;
        const key = q.answer_key;
        const hasKey = Boolean(key?.correct_values?.length);

        if (isPlaceholder || emptyOpts) {
          placeholders.push({
            exam_id: exam.code,
            skill,
            part: meta.teil ?? meta.audio_slot ?? null,
            question_number: q.sort_order,
            question_id: q.id,
            type: q.type,
            source_pdf_page: sourcePage(meta),
            ocr_original: typeof meta.ocr_raw_prompt === "string" ? meta.ocr_raw_prompt : q.prompt,
            transform_status: meta.transform_status ?? null,
            review_status: meta.review_status ?? "needs_review",
            empty_options: emptyOpts,
            option_count: opts.length,
            prompt_preview: String(q.prompt || "").slice(0, 160),
            reason: isPlaceholder ? "placeholder" : "empty_options",
          });
        }

        if ((skill === "lesen" || skill === "hoeren") && !hasKey) {
          missingKeys.push({
            exam_id: exam.code,
            skill,
            question_number: q.sort_order,
            question_id: q.id,
            type: q.type,
            option_values: opts.map((o) => o.value),
            option_labels: opts.map((o) => o.label),
            source_pdf_page: sourcePage(meta),
            prompt_preview: String(q.prompt || "").slice(0, 120),
          });
        } else if ((skill === "lesen" || skill === "hoeren") && hasKey) {
          const cv = key.correct_values[0];
          const ok = opts.some((o) => o.value === cv || o.label === cv);
          if (!ok && opts.length > 0) {
            missingKeys.push({
              exam_id: exam.code,
              skill,
              question_number: q.sort_order,
              question_id: q.id,
              type: q.type,
              incompatible_key: cv,
              option_values: opts.map((o) => o.value),
              reason: "key_incompatible_with_options",
              source_pdf_page: sourcePage(meta),
            });
          }
        }
      }
      if (dupOrders.length) {
        placeholders.push({
          exam_id: exam.code,
          skill,
          reason: "duplicate_sort_order",
          duplicate_orders: [...new Set(dupOrders)],
        });
      }
    }

    // Audio per teil
    const audioBySlot = new Map();
    for (const q of hoeren) {
      const meta = asMeta(q.metadata);
      const slot = Number(meta.audio_slot ?? meta.teil);
      if (!Number.isFinite(slot)) continue;
      const path = q.media_path;
      if (!audioBySlot.has(slot)) audioBySlot.set(slot, new Set());
      if (path) audioBySlot.get(slot).add(path);
      audioAudit.push({
        exam_id: exam.code,
        question_id: q.id,
        sort_order: q.sort_order,
        audio_slot: slot,
        media_path: path,
        media_bucket: q.media_bucket,
        verification_status: meta.audio_verification_status || "unverified",
        original_filename: meta.original_filename || null,
        duration_seconds: meta.duration_seconds ?? null,
        sha256: meta.sha256 || null,
      });
    }

    const distinctPaths = new Set(
      [...audioBySlot.values()].flatMap((s) => [...s]),
    );
    let audioCross = false;
    const pathToSlots = new Map();
    for (const [slot, paths] of audioBySlot) {
      for (const p of paths) {
        if (!pathToSlots.has(p)) pathToSlots.set(p, new Set());
        pathToSlots.get(p).add(slot);
      }
    }
    for (const [p, slots] of pathToSlots) {
      if (slots.size > 1) audioCross = true;
    }

    const phCount = placeholders.filter((p) => p.exam_id === exam.code && p.question_id).length;
    const mkCount = missingKeys.filter(
      (p) => p.exam_id === exam.code && (p.reason !== "key_incompatible_with_options" || true),
    ).length;
    const missingObjective = missingKeys.filter(
      (p) => p.exam_id === exam.code && !p.reason,
    ).length;
    const incompatible = missingKeys.filter(
      (p) => p.exam_id === exam.code && p.reason === "key_incompatible_with_options",
    ).length;

    const verifiedSlots = [1, 2, 3, 4].filter((slot) => {
      const qs = hoeren.filter((q) => Number(asMeta(q.metadata).audio_slot) === slot);
      return qs.some((q) => asMeta(q.metadata).audio_verification_status === "content_verified");
    }).length;

    const rubric = allQs.every((q) => asMeta(q.metadata).points_rubric === "provisional_needs_review")
      ? "provisional_needs_review"
      : allQs.some((q) => asMeta(q.metadata).points_basis === "official_pdf")
        ? "official_claimed"
        : "mixed_or_unknown";

    const lesenPts = lesen.reduce((s, q) => s + Number(q.points || 0), 0);
    const hoerenPts = hoeren.reduce((s, q) => s + Number(q.points || 0), 0);
    const schreibenPts = schreiben.reduce((s, q) => s + Number(q.points || 0), 0);
    const sprechenPts = sprechen.reduce((s, q) => s + Number(q.points || 0), 0);

    scoringAudit.push({
      exam_id: exam.code,
      rubric,
      lesen_points: lesenPts,
      hoeren_points: hoerenPts,
      schreiben_points: schreibenPts,
      sprechen_points: sprechenPts,
      total_points: lesenPts + hoerenPts + schreibenPts + sprechenPts,
      official: false,
      label: "Barème pédagogique interne, à confirmer",
      source: "provisional_import",
    });

    const publishBlockers = [];
    if (exam.status !== "draft" || exam.published_at) publishBlockers.push("not_draft");
    if (lesen.length !== 30) publishBlockers.push(`lesen=${lesen.length}`);
    if (hoeren.length !== 30) publishBlockers.push(`hoeren=${hoeren.length}`);
    if (schreiben.length !== 3) publishBlockers.push(`schreiben=${schreiben.length}`);
    if (sprechen.length !== 4) publishBlockers.push(`sprechen=${sprechen.length}`);
    if (phCount > 0) publishBlockers.push(`placeholders=${phCount}`);
    if (missingObjective + incompatible > 0)
      publishBlockers.push(`missing_or_bad_keys=${missingObjective + incompatible}`);
    if (distinctPaths.size !== 4) publishBlockers.push(`audios=${distinctPaths.size}/4`);
    if (verifiedSlots !== 4) publishBlockers.push(`audio_content_verified=${verifiedSlots}/4`);
    if (rubric === "provisional_needs_review") publishBlockers.push("provisional_scoring");
    if (dupIds.length) publishBlockers.push("duplicate_question_ids");
    if (audioCross) publishBlockers.push("audio_path_shared_across_teils");

    summaryRows.push({
      exam: exam.code,
      status: exam.status,
      lesen: lesen.length,
      hoeren: hoeren.length,
      schreiben: schreiben.length,
      sprechen: sprechen.length,
      placeholders: phCount,
      missing_keys: missingObjective,
      incompatible_keys: incompatible,
      distinct_audios: distinctPaths.size,
      audios_content_verified: verifiedSlots,
      scoring: rubric,
      publication: publishBlockers.length ? `bloqué: ${publishBlockers.join("; ")}` : "prêt (théorique)",
      publish_blockers: publishBlockers,
      duplicate_ids: [...new Set(dupIds)],
    });
  }

  const generated_at = new Date().toISOString();
  writeFileSync(
    resolve(OUT, "b1-placeholders-audit.json"),
    JSON.stringify({ generated_at, count: placeholders.length, items: placeholders }, null, 2),
  );
  writeFileSync(
    resolve(OUT, "b1-missing-answer-keys.json"),
    JSON.stringify(
      {
        generated_at,
        expected_total: 900,
        missing_count: missingKeys.filter((x) => !x.reason).length,
        incompatible_count: missingKeys.filter((x) => x.reason === "key_incompatible_with_options")
          .length,
        items: missingKeys,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(OUT, "b1-audio-verification-audit.json"),
    JSON.stringify(
      {
        generated_at,
        note: "Statuses from DB only; content_verified requires listening pass",
        items: audioAudit,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(OUT, "b1-scoring-audit.json"),
    JSON.stringify({ generated_at, exams: scoringAudit }, null, 2),
  );
  writeFileSync(
    resolve(OUT, "b1-live-summary.json"),
    JSON.stringify(
      {
        generated_at,
        a1: a1 || [],
        summary: summaryRows,
        totals: {
          exams: summaryRows.length,
          placeholders: placeholders.filter((p) => p.question_id).length,
          missing_keys: missingKeys.filter((x) => !x.reason).length,
          incompatible_keys: missingKeys.filter((x) => x.reason === "key_incompatible_with_options")
            .length,
          published: summaryRows.filter((r) => r.status === "published").length,
        },
      },
      null,
      2,
    ),
  );

  console.log("# B1 live audit\n");
  console.log(
    "| Examen | Lesen | Hören | Schreiben | Sprechen | Placeholders | Clés manquantes | Audios vérifiés | Barème | Publication |",
  );
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|---|---|");
  for (const r of summaryRows) {
    console.log(
      `| ${r.exam} | ${r.lesen} | ${r.hoeren} | ${r.schreiben} | ${r.sprechen} | ${r.placeholders} | ${r.missing_keys + r.incompatible_keys} | ${r.audios_content_verified}/4 | ${r.scoring} | ${r.publication} |`,
    );
  }
  console.log("\nWrote tmp/b1-*-audit.json + b1-live-summary.json");
  console.log(
    `A1 intact: ${(a1 || []).map((x) => `${x.code}:${x.status}`).join(", ") || "none"}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
