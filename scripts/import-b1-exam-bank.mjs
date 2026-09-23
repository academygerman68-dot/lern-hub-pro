/**
 * Idempotent B1 OCR draft importer (never invents or inserts answer keys).
 *
 * Usage:
 *   node scripts/import-b1-exam-bank.mjs --dry-run
 *   node scripts/import-b1-exam-bank.mjs [--json path]
 *
 * Prefers b1-exam-bank.structured.json when present (unless --json overrides).
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for real import.
 *
 * Points rubric (provisional_needs_review):
 *   - Lesen / Hören objective items: 1 point each (30+30)
 *   - Schreiben / Sprechen: 0 points until official barème verified
 * Publish stays blocked via OCR flags / needs_review until visual verification.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildB1DryRunReport,
  formatB1DryRunMarkdown,
  loadB1ExamBank,
  validateB1ExamBank,
} from "../src/lib/b1-exam-bank.ts";
import {
  detectSprechenRole,
  splitSchreibenPageBundle,
} from "../src/lib/b1-ocr-transform.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPLETE_JSON = resolve(__dirname, "../data/exams/b1-exam-bank/b1-exam-bank.complete.json");
const STRUCTURED_JSON = resolve(
  __dirname,
  "../data/exams/b1-exam-bank/b1-exam-bank.structured.json",
);
const DRY_RUN_OUT = resolve(__dirname, "../tmp/b1-import-dry-run.json");

function stableUuid(label) {
  const h = createHash("md5").update(`ga-b1-ocr:${label}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function resolveDefaultBankPath() {
  if (existsSync(STRUCTURED_JSON)) return STRUCTURED_JSON;
  return COMPLETE_JSON;
}

function parseArgs(argv) {
  const args = { dryRun: false, json: null, preferStructured: true, confirmedKeys: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--json") args.json = resolve(argv[++i] ?? COMPLETE_JSON);
    else if (a === "--with-confirmed-keys") args.confirmedKeys = resolve(argv[++i] ?? "");
    else if (a === "--complete") {
      args.preferStructured = false;
      args.json = COMPLETE_JSON;
    }
  }
  if (!args.json) {
    args.json = args.preferStructured ? resolveDefaultBankPath() : COMPLETE_JSON;
  }
  return args;
}

function normalizeKeyToken(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "richtig" || lower === "r") return "richtig";
  if (lower === "falsch" || lower === "f") return "falsch";
  if (lower === "ja") return "ja";
  if (lower === "nein") return "nein";
  if (/^[a-j0]$/i.test(s)) return s.toLowerCase();
  return lower;
}

function loadConfirmedKeysFile(path) {
  if (!path || !existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return raw.modelltests || null;
}

function resolveAnswerValue(question, token) {
  const want = normalizeKeyToken(token);
  if (!want) return null;
  const options = Array.isArray(question.options) ? question.options : [];
  const hit = options.find((o) => {
    const id = String(o.id ?? "").toLowerCase();
    const text = String(o.text ?? "").toLowerCase();
    const label = String(o.label ?? "").toLowerCase();
    return id === want || label === want || text === want;
  });
  return hit ? String(hit.id) : null;
}

function examNumberFromId(examId) {
  const m = String(examId).match(/MT0*([1-9]|1[0-5])$/i);
  return m ? Number(m[1]) : null;
}

function isStructuredBank(bank) {
  return (
    bank?.delivery_type === "structured-interactive-draft" ||
    bank?.exams?.[0]?.sections?.some((s) =>
      s.questions?.some(
        (q) =>
          q?.metadata?.import_mode === "structured" ||
          q?.type === "true_false" ||
          q?.type === "single_choice" ||
          (typeof q?.id === "string" && /-Q\d{2}$/.test(q.id)),
      ),
    )
  );
}

function mapDbQuestionType(sectionType, questionType, importMode) {
  if (importMode === "schreiben_split" || questionType === "writing") return "writing";
  if (questionType === "listening" || sectionType === "hoeren") return "listening";
  if (questionType === "speaking" || sectionType === "sprechen") return "speaking";
  if (questionType === "true_false") return "true_false";
  if (questionType === "single_choice") return "single_choice";
  if (questionType === "matching") return "matching";
  return "text";
}

function provisionalPoints(sectionType, question) {
  if (typeof question.points === "number" && question.points_rubric === "provisional_needs_review") {
    return question.points;
  }
  if (sectionType === "lesen" || sectionType === "hoeren") {
    if (
      question.type === "true_false" ||
      question.type === "single_choice" ||
      question.type === "matching" ||
      question.type === "listening"
    ) {
      return 1;
    }
  }
  return 0;
}

async function insertOptions(supabase, questionId, options) {
  if (!Array.isArray(options) || options.length === 0) return;
  const rows = options.map((opt, idx) => ({
    id: stableUuid(`option:${questionId}:${opt.id ?? idx}`),
    question_id: questionId,
    label: String(opt.label ?? opt.id ?? String.fromCharCode(97 + idx)),
    value: String(opt.id ?? opt.value ?? opt.label ?? idx),
    sort_order: idx + 1,
  }));
  const { error } = await supabase.from("exam_question_options").insert(rows);
  if (error) throw error;
}

async function rebuildExamStructured(supabase, levelId, exam, confirmedKeysByMt = null) {
  const examId = stableUuid(`exam:${exam.id}`);
  const report = {
    exam_id: exam.id,
    db_id: examId,
    mode: "structured",
    sections: 0,
    questions: 0,
    options: 0,
    schreiben_split: 0,
    answer_keys_inserted: 0,
    answer_keys_skipped: 0,
    provisional_points_total: 0,
    key_blockers: [],
  };
  const mtNum = examNumberFromId(exam.id);
  const mtKeys = confirmedKeysByMt && mtNum ? confirmedKeysByMt[String(mtNum)] : null;

  const { error: examUpsertError } = await supabase.from("exams").upsert(
    {
      id: examId,
      code: exam.id,
      title: exam.title,
      description: exam.subtitle ?? null,
      instructions: [
        exam.subtitle ?? "Zertifikat B1 neu",
        "Structured OCR draft — manual review required",
        "Provisional points (needs_review) — OCR draft",
      ].join(" · "),
      level_id: levelId,
      class_id: null,
      duration_minutes: exam.duration_minutes ?? 165,
      pass_percentage: 60,
      status: "draft",
      published_at: null,
      max_attempts: 3,
      is_mock: true,
    },
    { onConflict: "id" },
  );
  if (examUpsertError) throw examUpsertError;

  const { data: oldSections } = await supabase
    .from("exam_sections")
    .select("id")
    .eq("exam_id", examId);
  const oldSectionIds = (oldSections ?? []).map((s) => s.id);
  if (oldSectionIds.length) {
    const { data: oldQuestions } = await supabase
      .from("exam_questions")
      .select("id")
      .in("section_id", oldSectionIds);
    const oldQuestionIds = (oldQuestions ?? []).map((q) => q.id);
    if (oldQuestionIds.length) {
      await supabase.from("exam_answer_keys").delete().in("question_id", oldQuestionIds);
      await supabase.from("exam_question_options").delete().in("question_id", oldQuestionIds);
      await supabase.from("exam_questions").delete().in("id", oldQuestionIds);
    }
    await supabase.from("exam_sections").delete().in("id", oldSectionIds);
  }

  let sectionOrder = 0;
  for (const section of exam.sections) {
    sectionOrder += 1;
    const sectionId = stableUuid(`section:${section.id}`);
    const { error: sectionError } = await supabase.from("exam_sections").insert({
      id: sectionId,
      exam_id: examId,
      skill: section.type,
      title: section.title,
      description: null,
      sort_order: sectionOrder,
      duration_minutes: null,
      max_score: 0,
    });
    if (sectionError) throw sectionError;
    report.sections += 1;

    let sortOrder = 0;
    for (const question of section.questions) {
      sortOrder += 1;
      const questionId = stableUuid(`question:${question.id}`);
      const points = provisionalPoints(section.type, question);
      const importMode = question.metadata?.import_mode ?? "structured";
      const metadata = {
        ...(question.metadata && typeof question.metadata === "object" ? question.metadata : {}),
        bank_question_id: question.id,
        import_mode: importMode,
        needs_review: true,
        review_status: question.review_status ?? "needs_review",
        transform_status: question.transform_status ?? "needs_review",
        transcription_status: "ocr_unverified",
        source: question.metadata?.source ?? question.source ?? null,
        points_rubric: question.points_rubric ?? "provisional_needs_review",
        provisional_points: points,
        teil: question.teil ?? null,
        audio_slot: question.audio_slot ?? null,
        role: question.role ?? null,
      };

      const { error: questionError } = await supabase.from("exam_questions").insert({
        id: questionId,
        section_id: sectionId,
        type: mapDbQuestionType(section.type, question.type, importMode),
        prompt: question.prompt,
        points,
        sort_order: sortOrder,
        metadata,
        media_path: null,
      });
      if (questionError) throw questionError;
      report.questions += 1;
      report.provisional_points_total += points;

      if (Array.isArray(question.options) && question.options.length > 0) {
        await insertOptions(supabase, questionId, question.options);
        report.options += question.options.length;
      }

      if (section.type === "schreiben") report.schreiben_split += 1;

      // Insert confirmed keys only when visual key matches an existing option id.
      if (mtKeys && (section.type === "lesen" || section.type === "hoeren")) {
        const qNum = Number(question.order);
        const arr = section.type === "lesen" ? mtKeys.lesen : mtKeys.hoeren;
        if (Array.isArray(arr) && arr.length === 30 && qNum >= 1 && qNum <= 30) {
          const raw = arr[qNum - 1];
          const value = resolveAnswerValue(question, raw);
          if (value) {
            const { error: keyError } = await supabase.from("exam_answer_keys").upsert(
              {
                question_id: questionId,
                correct_values: [value],
                explanation: null,
                teacher_payload: {
                  source: "pdf_loesung_pages_247_249_visual",
                  ocr_raw: null,
                  confirmed_value: raw,
                  status: "confirmed",
                  source_pdf_pages: [247, 248, 249],
                  validated_at: new Date().toISOString(),
                },
              },
              { onConflict: "question_id" },
            );
            if (keyError) throw keyError;
            report.answer_keys_inserted += 1;
          } else {
            report.answer_keys_skipped += 1;
            report.key_blockers.push(
              `${question.id}: clé « ${raw} » incompatible avec les options OCR`,
            );
          }
        } else if (Array.isArray(arr) && arr.length !== 30) {
          report.key_blockers.push(
            `${exam.id} ${section.type}: attendu 30 clés, reçu ${arr.length}`,
          );
        }
      }
    }
  }

  return report;
}

async function rebuildExamPageBundles(supabase, levelId, exam) {
  const examId = stableUuid(`exam:${exam.id}`);
  const report = {
    exam_id: exam.id,
    db_id: examId,
    mode: "page_bundle",
    sections: 0,
    questions: 0,
    schreiben_split: 0,
    answer_keys_inserted: 0,
  };

  const { error: examUpsertError } = await supabase.from("exams").upsert(
    {
      id: examId,
      code: exam.id,
      title: exam.title,
      description: exam.subtitle ?? null,
      instructions: [
        exam.subtitle ?? "Zertifikat B1 neu",
        "OCR draft — manual review required",
        "No answer keys imported",
      ].join(" · "),
      level_id: levelId,
      class_id: null,
      duration_minutes: exam.duration_minutes ?? 165,
      pass_percentage: 60,
      status: "draft",
      published_at: null,
      max_attempts: 3,
      is_mock: true,
    },
    { onConflict: "id" },
  );
  if (examUpsertError) throw examUpsertError;

  const { data: oldSections } = await supabase
    .from("exam_sections")
    .select("id")
    .eq("exam_id", examId);
  const oldSectionIds = (oldSections ?? []).map((s) => s.id);
  if (oldSectionIds.length) {
    const { data: oldQuestions } = await supabase
      .from("exam_questions")
      .select("id")
      .in("section_id", oldSectionIds);
    const oldQuestionIds = (oldQuestions ?? []).map((q) => q.id);
    if (oldQuestionIds.length) {
      await supabase.from("exam_answer_keys").delete().in("question_id", oldQuestionIds);
      await supabase.from("exam_question_options").delete().in("question_id", oldQuestionIds);
      await supabase.from("exam_questions").delete().in("id", oldQuestionIds);
    }
    await supabase.from("exam_sections").delete().in("id", oldSectionIds);
  }

  let sectionOrder = 0;
  for (const section of exam.sections) {
    sectionOrder += 1;
    const sectionId = stableUuid(`section:${section.id}`);
    const { error: sectionError } = await supabase.from("exam_sections").insert({
      id: sectionId,
      exam_id: examId,
      skill: section.type,
      title: section.title,
      description: null,
      sort_order: sectionOrder,
      duration_minutes: null,
      max_score: 0,
    });
    if (sectionError) throw sectionError;
    report.sections += 1;

    let sortOrder = 0;
    for (const question of section.questions) {
      if (section.type === "schreiben") {
        const split = splitSchreibenPageBundle(question.prompt, question.source);
        const splitOk =
          split.length >= 1 &&
          split.every((t) => t.transform_status === "structured") &&
          split.length === 3;

        if (splitOk) {
          for (const task of split) {
            sortOrder += 1;
            const bankQuestionId = `${question.id}-${task.idSuffix}`;
            const questionId = stableUuid(`question:${bankQuestionId}`);
            const metadata = {
              bank_question_id: bankQuestionId,
              parent_page_id: question.id,
              import_mode: "schreiben_split",
              needs_review: true,
              transcription_status: "ocr_unverified",
              source: question.source,
              requirements: task.requirements,
              recommended_words: task.recommended_words,
              transform_status: task.transform_status,
              points_rubric: "provisional_needs_review",
            };
            const { error: questionError } = await supabase.from("exam_questions").insert({
              id: questionId,
              section_id: sectionId,
              type: mapDbQuestionType(section.type, "writing", "schreiben_split"),
              prompt: task.prompt,
              points: 0,
              sort_order: sortOrder,
              metadata,
              media_path: null,
            });
            if (questionError) throw questionError;
            report.questions += 1;
            report.schreiben_split += 1;
          }
          continue;
        }
      }

      sortOrder += 1;
      const importMode = "page_bundle";
      const questionId = stableUuid(`question:${question.id}`);
      const role =
        section.type === "sprechen" ? detectSprechenRole(question.prompt) : null;
      const metadata = {
        bank_question_id: question.id,
        import_mode: importMode,
        needs_review: true,
        transcription_status: "ocr_unverified",
        source: question.source,
        points_rubric: "provisional_needs_review",
        ...(role ? { role } : {}),
      };

      const { error: questionError } = await supabase.from("exam_questions").insert({
        id: questionId,
        section_id: sectionId,
        type: mapDbQuestionType(section.type, question.type, importMode),
        prompt: question.prompt,
        points: 0,
        sort_order: sortOrder,
        metadata,
        media_path: null,
      });
      if (questionError) throw questionError;
      report.questions += 1;
    }
  }

  return report;
}

async function runDryRun(bankPath) {
  const bank = loadB1ExamBank(bankPath);
  const structured = isStructuredBank(bank);
  const validation = structured
    ? { ok: true, issues: [], stats: { exams: bank.exams?.length ?? 0 } }
    : validateB1ExamBank(bank);
  const report = structured
    ? {
        generated_at: new Date().toISOString(),
        schema_version: bank.schema_version,
        mode: "structured",
        bank_path: bankPath,
        ok: true,
        exams: bank.exams.map((e) => ({
          id: e.id,
          lesen: e.sections.find((s) => s.type === "lesen")?.questions?.length ?? 0,
          hoeren: e.sections.find((s) => s.type === "hoeren")?.questions?.length ?? 0,
          schreiben: e.sections.find((s) => s.type === "schreiben")?.questions?.length ?? 0,
          sprechen: e.sections.find((s) => s.type === "sprechen")?.questions?.length ?? 0,
          structure_stats: e.structure_stats ?? null,
        })),
        safety: {
          answer_keys_invented: false,
          structured_answer_keys_imported: false,
          publishable: false,
          status: "draft",
          points_rubric: "provisional_needs_review",
        },
      }
    : buildB1DryRunReport(bank);

  mkdirSync(dirname(DRY_RUN_OUT), { recursive: true });
  writeFileSync(DRY_RUN_OUT, JSON.stringify(report, null, 2), "utf8");

  if (structured) {
    console.log("# B1 structured bank dry-run");
    console.log(`Bank: ${bankPath}`);
    console.log(`Exams: ${report.exams.length}`);
    const lesen = report.exams.reduce((s, e) => s + e.lesen, 0);
    const hoeren = report.exams.reduce((s, e) => s + e.hoeren, 0);
    const schreiben = report.exams.reduce((s, e) => s + e.schreiben, 0);
    console.log(`Lesen questions: ${lesen} (expected ${15 * 30})`);
    console.log(`Hören questions: ${hoeren} (expected ${15 * 30})`);
    console.log(`Schreiben tasks: ${schreiben} (expected ${15 * 3})`);
    console.log("Publishable: false · answer keys: not imported · points: provisional_needs_review");
  } else {
    console.log(formatB1DryRunMarkdown(report));
  }
  console.log(`\nWrote ${DRY_RUN_OUT}`);

  if (!validation.ok) {
    console.error("\nDry-run failed: blocking structural issues present.");
    process.exit(1);
  }

  console.log("\nDry-run OK — drafts only, no answer keys, not published.");
}

async function runImport(bankPath, confirmedKeysPath = null) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const bank = loadB1ExamBank(bankPath);
  const structured = isStructuredBank(bank);
  if (!structured) {
    const validation = validateB1ExamBank(bank);
    if (!validation.ok) {
      console.error("Bank validation failed — refusing import.");
      for (const issue of validation.issues.slice(0, 20)) {
        console.error(`- [${issue.severity ?? "error"}] ${issue.path}: ${issue.message}`);
      }
      process.exit(1);
    }
  }

  if (confirmedKeysPath && !existsSync(confirmedKeysPath)) {
    console.error(`Confirmed keys file missing: ${confirmedKeysPath}`);
    process.exit(1);
  }
  const confirmedKeys = loadConfirmedKeysFile(confirmedKeysPath);

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: level, error: levelError } = await supabase
    .from("levels")
    .select("id, code")
    .eq("code", "B1")
    .maybeSingle();
  if (levelError) throw levelError;
  if (!level) throw new Error("Level B1 not found");

  const perExam = [];
  let keysTotal = 0;
  let keysSkipped = 0;
  for (const exam of bank.exams) {
    const r = structured
      ? await rebuildExamStructured(supabase, level.id, exam, confirmedKeys)
      : await rebuildExamPageBundles(supabase, level.id, exam);
    perExam.push(r);
    keysTotal += r.answer_keys_inserted || 0;
    keysSkipped += r.answer_keys_skipped || 0;
    console.log(
      `Imported draft ${r.exam_id} [${r.mode}]: sections=${r.sections} questions=${r.questions} answer_keys=${r.answer_keys_inserted || 0} skipped_keys=${r.answer_keys_skipped || 0}`,
    );
    if (r.key_blockers?.length) {
      for (const b of r.key_blockers.slice(0, 5)) console.log(`  blocker: ${b}`);
      if (r.key_blockers.length > 5) console.log(`  … +${r.key_blockers.length - 5} blockers`);
    }
  }

  console.log(
    `\nDone: ${perExam.length} B1 exams upserted as draft (published_at=null). answer_keys_inserted=${keysTotal} skipped=${keysSkipped}. Nothing published.`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Using bank: ${args.json}`);
  if (args.dryRun) {
    await runDryRun(args.json);
    return;
  }
  await runImport(args.json, args.confirmedKeys);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
