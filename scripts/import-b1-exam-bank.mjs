/**
 * Idempotent B1 OCR draft importer (never invents or inserts answer keys).
 *
 * Usage:
 *   node scripts/import-b1-exam-bank.mjs --dry-run
 *   node scripts/import-b1-exam-bank.mjs [--json path]
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for real import.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
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
const DEFAULT_JSON = resolve(__dirname, "../data/exams/b1-exam-bank/b1-exam-bank.complete.json");
const DRY_RUN_OUT = resolve(__dirname, "../tmp/b1-import-dry-run.json");

function stableUuid(label) {
  const h = createHash("md5").update(`ga-b1-ocr:${label}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function parseArgs(argv) {
  const args = { dryRun: false, json: DEFAULT_JSON };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--json") args.json = resolve(argv[++i] ?? DEFAULT_JSON);
  }
  return args;
}

function mapDbQuestionType(sectionType, questionType, importMode) {
  if (importMode === "schreiben_split" || questionType === "writing") return "writing";
  if (sectionType === "hoeren") return "listening";
  if (sectionType === "sprechen") return "speaking";
  return "text";
}

async function rebuildExam(supabase, levelId, exam) {
  const examId = stableUuid(`exam:${exam.id}`);
  const report = {
    exam_id: exam.id,
    db_id: examId,
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
      duration_minutes: exam.duration_minutes ?? null,
      pass_percentage: 60,
      status: "draft",
      published_at: null,
      max_attempts: 3,
      is_mock: true,
    },
    { onConflict: "id" },
  );
  if (examUpsertError) throw examUpsertError;

  // Idempotent rebuild: remove previous structure (and any leftover keys)
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

  // NEVER insert exam_answer_keys
  return report;
}

async function runDryRun(bankPath) {
  const bank = loadB1ExamBank(bankPath);
  const validation = validateB1ExamBank(bank);
  const report = buildB1DryRunReport(bank);

  mkdirSync(dirname(DRY_RUN_OUT), { recursive: true });
  writeFileSync(DRY_RUN_OUT, JSON.stringify(report, null, 2), "utf8");

  console.log(formatB1DryRunMarkdown(report));
  console.log(`\nWrote ${DRY_RUN_OUT}`);

  if (!validation.ok) {
    console.error("\nDry-run failed: blocking structural issues present.");
    process.exit(1);
  }

  console.log("\nDry-run OK — drafts only, no answer keys, not published.");
}

async function runImport(bankPath) {
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
  const validation = validateB1ExamBank(bank);
  if (!validation.ok) {
    console.error("Bank validation failed — refusing import.");
    for (const issue of validation.issues.slice(0, 20)) {
      console.error(`- [${issue.severity ?? "error"}] ${issue.path}: ${issue.message}`);
    }
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: level, error: levelError } = await supabase
    .from("levels")
    .select("id, code")
    .eq("code", "B1")
    .maybeSingle();
  if (levelError) throw levelError;
  if (!level) throw new Error("Level B1 not found");

  const perExam = [];
  for (const exam of bank.exams) {
    const r = await rebuildExam(supabase, level.id, exam);
    perExam.push(r);
    console.log(
      `Imported draft ${r.exam_id}: sections=${r.sections} questions=${r.questions} schreiben_split=${r.schreiben_split} answer_keys=${r.answer_keys_inserted}`,
    );
  }

  console.log(
    `\nDone: ${perExam.length} B1 exams upserted as draft (published_at=null, no answer keys).`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.dryRun) {
    await runDryRun(args.json);
    return;
  }
  await runImport(args.json);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
