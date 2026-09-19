import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const bank = JSON.parse(readFileSync("data/exams/german-academy-a1-exams.json", "utf8"));
mkdirSync("tmp-seed-batches", { recursive: true });

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
  if (sectionType === "hoeren") return "listening";
  return questionType;
}

const manifest = [];

for (const exam of bank.exams) {
  const examId = stableUuid(`exam:${exam.id}`);
  const meta = [];
  meta.push("DO $$ DECLARE v_level_id uuid; BEGIN");
  meta.push("SELECT id INTO v_level_id FROM public.levels WHERE code = 'A1' LIMIT 1;");
  meta.push("IF v_level_id IS NULL THEN RAISE EXCEPTION 'Level A1 missing'; END IF;");
  meta.push(`INSERT INTO public.exams (
    id, code, title, description, instructions, level_id, duration_minutes,
    pass_percentage, status, published_at, max_attempts, is_mock
  ) VALUES (
    '${examId}'::uuid,
    '${esc(exam.id)}',
    '${esc(exam.title)}',
    '${esc(exam.subtitle)}',
    '${esc(`${exam.subtitle} · ${exam.duration_minutes} min · ${exam.total_points} points`)}',
    v_level_id,
    ${exam.duration_minutes},
    60, 'published', now(), 3, true
  ) ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    instructions = EXCLUDED.instructions,
    level_id = EXCLUDED.level_id,
    duration_minutes = EXCLUDED.duration_minutes,
    status = 'published',
    published_at = coalesce(public.exams.published_at, now()),
    is_mock = true,
    updated_at = now();`);

  let sectionOrder = 0;
  for (const section of exam.sections) {
    sectionOrder += 1;
    const sectionId = stableUuid(`section:${section.id}`);
    meta.push(`INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
      VALUES ('${sectionId}'::uuid, '${examId}'::uuid, '${section.type}', '${esc(section.title)}', ${sectionOrder}, ${section.max_points})
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;`);

    for (let i = 0; i < section.questions.length; i += 3) {
      const batch = section.questions.slice(i, i + 3);
      const lines = ["DO $$ BEGIN"];
      for (const q of batch) {
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
        };
        const prompt =
          q.prompt ||
          q.instruction ||
          (q.type === "form_fill" ? "Formular ausfüllen" : "Schreiben");
        lines.push(`INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
          VALUES ('${questionId}'::uuid, '${sectionId}'::uuid, '${dbType}', '${esc(prompt)}', ${q.points}, ${q.order}, '${esc(JSON.stringify(metadata))}'::jsonb)
          ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;`);
        if (q.choices) {
          q.choices.forEach((choice, index) => {
            const value = typeof choice === "string" ? choice : choice.id;
            const label = typeof choice === "string" ? choice : choice.text;
            const optionId = stableUuid(`option:${q.id}:${value}`);
            lines.push(`INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
              VALUES ('${optionId}'::uuid, '${questionId}'::uuid, '${esc(label)}', '${esc(value)}', ${index + 1})
              ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;`);
          });
        }
        const teacherPayload = {};
        if (q.audio_script) teacherPayload.audio_script = q.audio_script;
        if (q.sample_answer) teacherPayload.sample_answer = q.sample_answer;
        if (q.rubric) teacherPayload.rubric = q.rubric;
        if (q.source_data) teacherPayload.source_data = q.source_data;
        if (q.fields) teacherPayload.fields = q.fields;
        let correctValues = [];
        if (q.type === "true_false" || q.type === "single_choice")
          correctValues = [q.correct_answer];
        else if (q.type === "form_fill") correctValues = ["form_fill"];
        if (correctValues.length || q.explanation || Object.keys(teacherPayload).length) {
          const cv = correctValues.map((v) => `'${esc(v)}'`).join(",");
          const expl = q.explanation ? `'${esc(q.explanation)}'` : "NULL";
          lines.push(`INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
            VALUES ('${questionId}'::uuid, ARRAY[${cv}]::text[], ${expl}, '${esc(JSON.stringify(teacherPayload))}'::jsonb)
            ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;`);
        }
      }
      lines.push("END $$;");
      const file = `tmp-seed-batches/${exam.id}-${section.type}-${String(i).padStart(2, "0")}.sql`;
      writeFileSync(file, lines.join("\n"));
      manifest.push(file);
    }
  }
  meta.push("END $$;");
  const metaFile = `tmp-seed-batches/${exam.id}-meta.sql`;
  writeFileSync(metaFile, meta.join("\n"));
  manifest.unshift(metaFile);
}

writeFileSync("tmp-seed-batches/manifest.json", JSON.stringify(manifest, null, 2));
console.log(
  "batches",
  manifest.length,
  "max",
  Math.max(...manifest.map((f) => readFileSync(f).length)),
);
