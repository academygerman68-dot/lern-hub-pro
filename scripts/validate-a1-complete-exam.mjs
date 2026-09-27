import { existsSync, readFileSync, statSync } from "node:fs";

const path = "data/exams/a1-complete/a1-sim-01.json";
const bank = JSON.parse(readFileSync(path, "utf8"));
const exam = bank.exams?.[0];
const errors = [];
const expected = {
  hoeren: { count: 15, points: 15, parts: [6, 4, 5] },
  lesen: { count: 15, points: 15, parts: [5, 5, 5] },
  schreiben: { count: 2, points: 15, parts: [1, 1] },
  sprechen: { count: 3, points: 15, parts: [1, 1, 1] },
};

if (!exam) errors.push("Missing exam");
if (exam?.format_profile !== "goethe_a1_adult_v1") errors.push("Wrong format profile");
if (exam?.total_points !== 60) errors.push("Total must be 60 raw points");
if (exam?.duration_minutes !== 65) errors.push("duration_minutes must be 65 (written clock)");
if (exam?.written_duration_minutes !== 65) errors.push("Written duration must be 65 minutes");
if (exam?.speaking_duration_minutes !== 15) errors.push("Speaking duration must be 15 minutes");
if (Math.round(60 * 1.66) !== 100) errors.push("Conversion 60×1.66 must round to 100");

const ids = new Set();
for (const [skill, rules] of Object.entries(expected)) {
  const section = exam?.sections?.find((item) => item.type === skill);
  if (!section) {
    errors.push(`Missing ${skill}`);
    continue;
  }
  if (section.questions.length !== rules.count) errors.push(`${skill}: wrong question count`);
  if (section.max_points !== rules.points) errors.push(`${skill}: max must be 15`);
  const points = section.questions.reduce((sum, question) => sum + question.points, 0);
  if (points !== rules.points) errors.push(`${skill}: question points sum to ${points}`);
  rules.parts.forEach((count, index) => {
    const actual = section.questions.filter((question) => question.part === index + 1).length;
    if (actual !== count) errors.push(`${skill} Teil ${index + 1}: expected ${count}, found ${actual}`);
  });
  for (const question of section.questions) {
    if (ids.has(question.id)) errors.push(`Duplicate id ${question.id}`);
    ids.add(question.id);
    if (!question.instruction && !question.prompt) errors.push(`${question.id}: missing instruction`);
    if (["true_false", "single_choice"].includes(question.type)) {
      const values = question.choices.map((choice) => typeof choice === "string" ? choice : choice.id);
      if (!values.includes(question.correct_answer)) errors.push(`${question.id}: invalid answer key`);
    }
  }
}

const horen = exam?.sections?.find((item) => item.type === "hoeren");
for (const part of [1, 2, 3]) {
  const file = `public/exam-media/a1-sim-01/hoeren-teil-${part}.mp3`;
  if (!existsSync(file) || statSync(file).size < 100_000) errors.push(`Missing or invalid audio ${file}`);
  const questions = horen?.questions?.filter((question) => question.part === part) ?? [];
  const expectedUrl = `/exam-media/a1-sim-01/hoeren-teil-${part}.mp3`;
  if (questions.some((question) => question.audio_url !== expectedUrl)) {
    errors.push(`Hören Teil ${part}: wrong audio URL`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("A1-SIM-01 valid: 4 skills, 60 raw points, 35 questions/tasks, 3 audio tracks.");

