import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  toStudentTrainingPayload,
  validateTrainingModule,
} from "@/lib/training-module-schema";
import { isExamSimulationCode, isTrainingModuleProfile } from "@/lib/training-module";

const ROOT = process.cwd();
const M01 = join(ROOT, "data/exams/a1-b1-series/modules/GA-A1-M01.json");
const RUNNER_SQL = join(ROOT, "supabase/migrations/20260928170000_training_module_runner.sql");
const AUDIO = join(ROOT, "public/exam-media/ga-a1-m01/hoeren-vorstellen.mp3");

describe("GA-A1-M01 runner integration guards", () => {
  it("keeps module draft and training profile", () => {
    const result = validateTrainingModule(JSON.parse(readFileSync(M01, "utf8")));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.module.publication_status).toBe("draft");
    expect(isTrainingModuleProfile(result.module)).toBe(true);
    expect(isExamSimulationCode(result.module.module_id)).toBe(false);
    expect(result.module.correction.goethe_scoring).toBe(false);
    expect(result.module.correction.pass_fail_certificate).toBe(false);
    expect(result.module.correction.timed_exam).toBe(false);
  });

  it("strips keys and staff scripts from student payload", () => {
    const result = validateTrainingModule(JSON.parse(readFileSync(M01, "utf8")));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const student = toStudentTrainingPayload(result.module);
    const blob = JSON.stringify(student);
    expect(blob).not.toMatch(/correct_answer/);
    expect(blob).not.toMatch(/sample_answer_staff_only/);
    expect(blob).not.toMatch(/script_staff_only/);
    expect(blob).not.toMatch(/audio_script_staff_only/);
    expect(student.activities).toHaveLength(13);
  });

  it("passes module validator", () => {
    const result = validateTrainingModule(JSON.parse(readFileSync(M01, "utf8")));
    expect(result.ok).toBe(true);
  });

  it("ships runner migration with RLS + preview + oral bucket", () => {
    const sql = readFileSync(RUNNER_SQL, "utf8");
    expect(sql).toMatch(/training_modules/);
    expect(sql).toMatch(/training_module_attempts/);
    expect(sql).toMatch(/training_module_answers/);
    expect(sql).toMatch(/training-oral/);
    expect(sql).toMatch(/get_training_module_for_learner/);
    expect(sql).toMatch(/start_or_resume_training_attempt/);
    expect(sql).toMatch(/validate_training_objective_answer/);
    expect(sql).toMatch(/kind = 'preview'/);
    expect(sql).toMatch(/status = 'published'/);
  });

  it("encodes RLS: student own rows, teacher_has_student, draft gated, admin", () => {
    const sql = readFileSync(RUNNER_SQL, "utf8");
    expect(sql).toMatch(/teacher_has_student/);
    expect(sql).toMatch(/profile_id = auth\.uid\(\)/);
    expect(sql).toMatch(/is_admin\(\)/);
    expect(sql).toMatch(/status = 'published'/);
    expect(sql).toMatch(/training_modules_select/);
    expect(sql).toMatch(/training_attempts_select/);
    expect(sql).toMatch(/training_answers_select/);
  });

  it("isolates preview attempts from live student progression", () => {
    const sql = readFileSync(RUNNER_SQL, "utf8");
    expect(sql).toMatch(/training_attempt_kind/);
    expect(sql).toMatch(/'preview'/);
    expect(sql).toMatch(/training_attempts_one_active_preview/);
    expect(sql).toMatch(/training_attempts_one_active_live/);
  });

  it("manual writing/speaking go pending_review without auto score certainty", () => {
    const sql = readFileSync(RUNNER_SQL, "utf8");
    expect(sql).toMatch(/submit_training_manual_answer/);
    expect(sql).toMatch(/grade_training_manual_answer/);
    expect(sql).toMatch(/pending_review/);
    const mod = validateTrainingModule(JSON.parse(readFileSync(M01, "utf8")));
    expect(mod.ok).toBe(true);
    if (!mod.ok) return;
    const writing = mod.module.activities.find((a) => a.activity_type === "writing");
    const speaking = mod.module.activities.find((a) => a.activity_type === "speaking");
    expect(writing?.auto_grade_as_certain).toBe(false);
    expect(speaking?.auto_grade_as_certain).toBe(false);
  });

  it("keeps hören audio asset", () => {
    expect(existsSync(AUDIO)).toBe(true);
    const buf = readFileSync(AUDIO);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("allows M02/M03 content files as drafts after runner validation", () => {
    expect(existsSync(join(ROOT, "data/exams/a1-b1-series/modules/GA-A1-M02.json"))).toBe(true);
    expect(existsSync(join(ROOT, "data/exams/a1-b1-series/modules/GA-A1-M03.json"))).toBe(true);
  });
});
