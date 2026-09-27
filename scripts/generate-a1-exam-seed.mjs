import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const bankPath = process.argv[2] || "data/exams/german-academy-a1-exams.json";
const outputPath = process.argv[3] || "supabase/migrations/20260919021000_seed_a1_exam_bank.sql";
const bank = JSON.parse(readFileSync(bankPath, "utf8"));

function stableUuid(label) {
  const h = createHash("md5").update(`ga-exam:${label}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function mapType(sectionType, questionType) {
  if (questionType === "form_fill") return "form_fill";
  if (questionType === "writing") return "writing";
  if (questionType === "speaking") return "speaking";
  if (sectionType === "hoeren") return "listening";
  return questionType;
}

const hasProfileColumns = bank.exams.some(
  (e) => e.format_profile || e.written_duration_minutes != null || e.speaking_duration_minutes != null,
);

const lines = [];
if (hasProfileColumns) {
  lines.push(`-- A1 additive seed only (no global RPC / RLS changes).`);
  lines.push(`-- Generated from ${bankPath}`);
  lines.push(`-- Requires companion migration for Goethe scoring + teacher-scope RLS.`);
  lines.push(``);
  lines.push(`ALTER TABLE public.exams`);
  lines.push(`  ADD COLUMN IF NOT EXISTS format_profile text,`);
  lines.push(`  ADD COLUMN IF NOT EXISTS written_duration_minutes integer,`);
  lines.push(`  ADD COLUMN IF NOT EXISTS speaking_duration_minutes integer;`);
  lines.push(``);
  lines.push(`COMMENT ON COLUMN public.exams.format_profile IS`);
  lines.push(`  'Scoring/UX profile, e.g. goethe_a1_adult_v1 for A1-SIM complete exams.';`);
  lines.push(`COMMENT ON COLUMN public.exams.written_duration_minutes IS`);
  lines.push(`  'Written clock (Hören+Lesen+Schreiben). Oral is separate/async.';`);
  lines.push(`COMMENT ON COLUMN public.exams.speaking_duration_minutes IS`);
  lines.push(`  'Indicative oral duration for solo recorded Sprechen.';`);
  lines.push(``);
} else {
  lines.push(`-- Idempotent seed generated from ${bankPath}`);
}

lines.push(`DO $$`);
lines.push(`DECLARE`);
lines.push(`  v_level_id uuid;`);
lines.push(`BEGIN`);
lines.push(`  SELECT id INTO v_level_id FROM public.levels WHERE code = 'A1' LIMIT 1;`);
lines.push(`  IF v_level_id IS NULL THEN`);
lines.push(`    RAISE EXCEPTION 'Level A1 missing';`);
lines.push(`  END IF;`);

for (const exam of bank.exams) {
  const examId = stableUuid(`exam:${exam.id}`);
  const writtenMins = exam.written_duration_minutes ?? exam.duration_minutes;
  const speakingMins = exam.speaking_duration_minutes ?? null;
  const formatProfile = exam.format_profile ?? null;
  const instructions =
    formatProfile === "goethe_a1_adult_v1"
      ? `${exam.subtitle} · Écrit ${writtenMins} min · Oral enregistré ${speakingMins ?? 15} min · ${exam.total_points} points bruts (/100 via ×1,66)`
      : `${exam.subtitle} · ${exam.duration_minutes} min · ${exam.total_points} points`;

  const extraCols = [];
  const extraVals = [];
  const extraUpdates = [];
  if (formatProfile) {
    extraCols.push("format_profile");
    extraVals.push(`'${esc(formatProfile)}'`);
    extraUpdates.push("format_profile = EXCLUDED.format_profile");
  }
  if (exam.written_duration_minutes != null) {
    extraCols.push("written_duration_minutes");
    extraVals.push(String(exam.written_duration_minutes));
    extraUpdates.push("written_duration_minutes = EXCLUDED.written_duration_minutes");
  }
  if (speakingMins != null) {
    extraCols.push("speaking_duration_minutes");
    extraVals.push(String(speakingMins));
    extraUpdates.push("speaking_duration_minutes = EXCLUDED.speaking_duration_minutes");
  }

  const colList = [
    "id",
    "code",
    "title",
    "description",
    "instructions",
    "level_id",
    "duration_minutes",
    "pass_percentage",
    "status",
    "published_at",
    "max_attempts",
    "is_mock",
    ...extraCols,
  ];

  lines.push(`  -- ${exam.id}`);
  lines.push(`  INSERT INTO public.exams (`);
  lines.push(`    ${colList.join(", ")}`);
  lines.push(`  ) VALUES (`);
  lines.push(`    '${examId}'::uuid,`);
  lines.push(`    '${esc(exam.id)}',`);
  lines.push(`    '${esc(exam.title)}',`);
  lines.push(`    '${esc(exam.subtitle)}',`);
  lines.push(`    '${esc(instructions)}',`);
  lines.push(`    v_level_id,`);
  lines.push(`    ${writtenMins},`);
  lines.push(`    ${exam.pass_score_100 ?? 60},`);
  lines.push(`    'published',`);
  lines.push(`    now(),`);
  lines.push(`    3,`);
  lines.push(`    true${extraVals.length ? "," : ""}`);
  for (let i = 0; i < extraVals.length; i++) {
    lines.push(`    ${extraVals[i]}${i < extraVals.length - 1 ? "," : ""}`);
  }
  lines.push(`  )`);
  lines.push(`  ON CONFLICT (id) DO UPDATE SET`);
  lines.push(`    code = EXCLUDED.code,`);
  lines.push(`    title = EXCLUDED.title,`);
  lines.push(`    description = EXCLUDED.description,`);
  lines.push(`    instructions = EXCLUDED.instructions,`);
  lines.push(`    level_id = EXCLUDED.level_id,`);
  lines.push(`    duration_minutes = EXCLUDED.duration_minutes,`);
  if (extraUpdates.length) {
    for (const u of extraUpdates) lines.push(`    ${u},`);
  }
  lines.push(`    status = 'published',`);
  lines.push(`    published_at = coalesce(public.exams.published_at, now()),`);
  lines.push(`    is_mock = true,`);
  lines.push(`    updated_at = now();`);

  let sectionOrder = 0;
  for (const section of exam.sections) {
    sectionOrder += 1;
    const sectionId = stableUuid(`section:${section.id}`);
    lines.push(
      `  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)`,
    );
    lines.push(
      `  VALUES ('${sectionId}'::uuid, '${examId}'::uuid, '${section.type}', '${esc(section.title)}', ${sectionOrder}, ${section.max_points})`,
    );
    lines.push(
      `  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;`,
    );

    for (const q of section.questions) {
      const questionId = stableUuid(`question:${q.id}`);
      const dbType = mapType(section.type, q.type);
      const metadata = {
        bank_question_id: q.id,
        part: q.part,
        instruction: q.instruction ?? null,
        passage: q.passage ?? null,
        audio_url: q.audio_url ?? null,
        recommended_words: q.recommended_words ?? null,
        requirements: q.requirements ?? null,
        fields:
          q.type === "form_fill" ? q.fields.map((f) => ({ key: f.key, points: f.points })) : null,
        rubric: q.rubric ?? null,
        allowed_scores: q.allowed_scores ?? null,
        playback_count: q.playback_count ?? null,
      };
      const prompt =
        q.prompt || q.instruction || (q.type === "form_fill" ? "Formular ausfüllen" : "Schreiben");
      const metaSql = esc(JSON.stringify(metadata));
      lines.push(
        `  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)`,
      );
      lines.push(
        `  VALUES ('${questionId}'::uuid, '${sectionId}'::uuid, '${dbType}', '${esc(prompt)}', ${q.points}, ${q.order}, '${metaSql}'::jsonb)`,
      );
      lines.push(
        `  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;`,
      );

      if (q.choices) {
        q.choices.forEach((choice, index) => {
          const value = typeof choice === "string" ? choice : choice.id;
          const label = typeof choice === "string" ? choice : choice.text;
          const optionId = stableUuid(`option:${q.id}:${value}`);
          lines.push(
            `  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)`,
          );
          lines.push(
            `  VALUES ('${optionId}'::uuid, '${questionId}'::uuid, '${esc(label)}', '${esc(value)}', ${index + 1})`,
          );
          lines.push(
            `  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;`,
          );
        });
      }

      const teacherPayload = {};
      if (q.audio_script) teacherPayload.audio_script = q.audio_script;
      if (q.sample_answer) teacherPayload.sample_answer = q.sample_answer;
      if (q.rubric) teacherPayload.rubric = q.rubric;
      if (q.allowed_scores) teacherPayload.allowed_scores = q.allowed_scores;
      if (q.source_data) teacherPayload.source_data = q.source_data;
      if (q.fields) teacherPayload.fields = q.fields;

      let correctValues = [];
      if (q.type === "true_false" || q.type === "single_choice") {
        correctValues = [q.correct_answer];
      } else if (q.type === "form_fill") {
        correctValues = ["form_fill"];
      }

      if (correctValues.length || q.explanation || Object.keys(teacherPayload).length) {
        const cv = correctValues.map((v) => `'${esc(v)}'`).join(",");
        const expl = q.explanation ? `'${esc(q.explanation)}'` : "NULL";
        lines.push(
          `  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)`,
        );
        lines.push(
          `  VALUES ('${questionId}'::uuid, ARRAY[${cv}]::text[], ${expl}, '${esc(JSON.stringify(teacherPayload))}'::jsonb)`,
        );
        lines.push(
          `  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;`,
        );
      }
    }
  }
}

lines.push(`END $$;`);
writeFileSync(outputPath, lines.join("\n") + "\n");
console.log(
  `Wrote ${outputPath}`,
  lines.length,
  "lines",
  (lines.join("\n").length / 1024).toFixed(1),
  "KB",
);
