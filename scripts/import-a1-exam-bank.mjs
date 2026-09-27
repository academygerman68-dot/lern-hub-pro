/**
 * Idempotent importer for German Academy A1 mock exams.
 * Usage: node scripts/import-a1-exam-bank.mjs
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_URL + service role).
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const requestedBankPath = process.argv[2] || process.env.A1_EXAM_BANK_PATH;
const bankPath = requestedBankPath
  ? resolve(process.cwd(), requestedBankPath)
  : resolve(__dirname, "../data/exams/german-academy-a1-exams.json");

function stableUuid(label) {
  const h = createHash("md5").update(`ga-exam:${label}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function choiceOptions(choices) {
  return choices.map((choice, index) => {
    if (typeof choice === "string") {
      return { value: choice, label: choice, sort_order: index + 1 };
    }
    return { value: choice.id, label: choice.text, sort_order: index + 1 };
  });
}

function mapDbQuestionType(sectionType, questionType) {
  if (questionType === "form_fill") return "form_fill";
  if (questionType === "writing") return "writing";
  if (questionType === "speaking") return "speaking";
  if (sectionType === "hoeren") return "listening";
  return questionType;
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const bank = JSON.parse(readFileSync(bankPath, "utf8"));
  // Lightweight validation without bundling zod in the script
  if (!Array.isArray(bank.exams) || bank.exams.length < 1) {
    throw new Error("Bank must contain at least one exam");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: level, error: levelError } = await supabase
    .from("levels")
    .select("id, code")
    .eq("code", "A1")
    .maybeSingle();
  if (levelError) throw levelError;
  if (!level) throw new Error("Level A1 not found");

  for (const exam of bank.exams) {
    const examId = stableUuid(`exam:${exam.id}`);
    const writtenMins = exam.written_duration_minutes ?? exam.duration_minutes;
    const speakingMins = exam.speaking_duration_minutes ?? null;
    const formatProfile = exam.format_profile ?? null;
    const instructions =
      formatProfile === "goethe_a1_adult_v1"
        ? `${exam.subtitle} · Écrit ${writtenMins} min · Oral enregistré ${speakingMins ?? 15} min · ${exam.total_points} points bruts (/100 via ×1,66)`
        : `${exam.subtitle} · ${exam.duration_minutes} min · ${exam.total_points} points`;

    const examRow = {
      id: examId,
      code: exam.id,
      title: exam.title,
      description: exam.subtitle,
      instructions,
      level_id: level.id,
      class_id: null,
      duration_minutes: writtenMins,
      pass_percentage: exam.pass_score_100 ?? 60,
      status: formatProfile === "goethe_a1_adult_v1" ? "draft" : "published",
      published_at: formatProfile === "goethe_a1_adult_v1" ? null : new Date().toISOString(),
      max_attempts: 3,
      is_mock: true,
    };
    if (formatProfile) examRow.format_profile = formatProfile;
    if (exam.written_duration_minutes != null) {
      examRow.written_duration_minutes = exam.written_duration_minutes;
    }
    if (speakingMins != null) examRow.speaking_duration_minutes = speakingMins;

    const { error: examUpsertError } = await supabase
      .from("exams")
      .upsert(examRow, { onConflict: "id" });
    if (examUpsertError) throw examUpsertError;

    // Remove previous structure for this exam (idempotent rebuild)
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
        max_score: section.max_points,
      });
      if (sectionError) throw sectionError;

      for (const question of section.questions) {
        const questionId = stableUuid(`question:${question.id}`);
        const dbType = mapDbQuestionType(section.type, question.type);
        const metadata = {
          bank_question_id: question.id,
          part: question.part,
          instruction: question.instruction ?? null,
          passage: question.passage ?? null,
          audio_url: question.audio_url ?? null,
          recommended_words: question.recommended_words ?? null,
          requirements: question.requirements ?? null,
          fields:
            question.type === "form_fill"
              ? question.fields.map((f) => ({ key: f.key, points: f.points }))
              : null,
          rubric: question.rubric ?? null,
          allowed_scores: question.allowed_scores ?? null,
          playback_count: question.playback_count ?? null,
        };
        const prompt =
          question.prompt ||
          question.instruction ||
          (question.type === "form_fill" ? "Formular ausfüllen" : "Schreiben");

        const { error: questionError } = await supabase.from("exam_questions").insert({
          id: questionId,
          section_id: sectionId,
          type: dbType,
          prompt,
          points: question.points,
          sort_order: question.order,
          metadata,
          media_path: null,
        });
        if (questionError) throw questionError;

        if (question.choices) {
          const options = choiceOptions(question.choices).map((opt) => ({
            id: stableUuid(`option:${question.id}:${opt.value}`),
            question_id: questionId,
            label: opt.label,
            value: opt.value,
            sort_order: opt.sort_order,
          }));
          const { error: optionsError } = await supabase
            .from("exam_question_options")
            .insert(options);
          if (optionsError) throw optionsError;
        }

        const teacherPayload = {};
        if (question.audio_script) teacherPayload.audio_script = question.audio_script;
        if (question.sample_answer) teacherPayload.sample_answer = question.sample_answer;
        if (question.rubric) teacherPayload.rubric = question.rubric;
        if (question.allowed_scores) teacherPayload.allowed_scores = question.allowed_scores;
        if (question.source_data) teacherPayload.source_data = question.source_data;
        if (question.fields) teacherPayload.fields = question.fields;

        let correctValues = null;
        if (question.type === "true_false" || question.type === "single_choice") {
          correctValues = [question.correct_answer];
        } else if (question.type === "form_fill") {
          correctValues = ["form_fill"];
        }

        if (correctValues || question.explanation || Object.keys(teacherPayload).length) {
          const { error: keyError } = await supabase.from("exam_answer_keys").upsert({
            question_id: questionId,
            correct_values: correctValues ?? [],
            explanation: question.explanation ?? null,
            teacher_payload: teacherPayload,
          });
          if (keyError) throw keyError;
        }
      }
    }

    console.log(`Imported ${exam.id} (${exam.title})`);
  }

  console.log(`Done: ${bank.exams.length} A1 exam(s) imported idempotently.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
