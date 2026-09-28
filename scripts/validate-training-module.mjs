import fs from "fs";
import path from "path";

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
for (const banned of [
  "correct_answer",
  "correct_form",
  "audio_script_staff_only",
  "sample_answer_staff_only",
  "a1-b1-series/source",
]) {
  if (studentJson.includes(banned)) {
    console.error("Student payload leaked field:", banned);
    process.exit(1);
  }
}

const tracks = result.module.media?.audio_tracks ?? [];
if (!tracks.length) {
  console.error("Missing media.audio_tracks");
  process.exit(1);
}

for (const track of tracks) {
  if (!track.url.startsWith("/exam-media/")) {
    console.error("Unexpected audio url:", track.url);
    process.exit(1);
  }
  const audioPath = path.resolve(`public${track.url}`);
  if (!fs.existsSync(audioPath)) {
    console.error("Missing original audio file:", audioPath);
    process.exit(1);
  }
}

console.log(
  "OK",
  result.module.module_id,
  "activities=",
  result.module.activities.length,
  "audio=",
  tracks.map((t) => t.url).join(","),
  "status=",
  result.module.publication_status,
);
