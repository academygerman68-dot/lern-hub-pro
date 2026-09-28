import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Resolve TS via vite-node/tsx if available; fallback: dynamic import of compiled path.
async function loadValidator() {
  const { validateTrainingModule, toStudentTrainingPayload } = await import(
    "../src/lib/training-module-schema.ts"
  );
  return { validateTrainingModule, toStudentTrainingPayload };
}

const file = process.argv[2] || "data/exams/a1-b1-series/modules/GA-A1-M01.json";
const raw = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));

const { validateTrainingModule, toStudentTrainingPayload } = await loadValidator();
const result = validateTrainingModule(raw);
if (!result.ok) {
  console.error("INVALID", file);
  for (const err of result.errors) console.error("-", err);
  process.exit(1);
}

const student = toStudentTrainingPayload(result.module);
const studentJson = JSON.stringify(student);
for (const banned of ["correct_answer", "correct_form", "audio_script_staff_only", "sample_answer_staff_only", "a1-b1-series/source"]) {
  if (studentJson.includes(banned)) {
    console.error("Student payload leaked field:", banned);
    process.exit(1);
  }
}

const audioUrl = "/exam-media/ga-a1-m01/hoeren-vorstellen.mp3";
const audioPath = path.resolve("public/exam-media/ga-a1-m01/hoeren-vorstellen.mp3");
if (!fs.existsSync(audioPath)) {
  console.error("Missing original audio file:", audioPath);
  process.exit(1);
}

console.log("OK", result.module.module_id, "activities=", result.module.activities.length, "audio=", audioUrl);
