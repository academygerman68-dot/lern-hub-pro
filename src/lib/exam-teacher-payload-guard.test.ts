import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examServicePath = resolve(__dirname, "../services/supabase/exam-service.ts");
const studentRunnerPath = resolve(__dirname, "../components/academy/student-exam-runner.tsx");
const securityMigration = resolve(
  __dirname,
  "../../supabase/migrations/20260927180000_exam_engine_security_goethe_a1.sql",
);

describe("teacher_payload must not reach student clients", () => {
  const examService = readFileSync(examServicePath, "utf8");
  const runner = readFileSync(studentRunnerPath, "utf8");
  const securitySql = readFileSync(securityMigration, "utf8");

  it("keeps exam_answer_keys RLS staff-only in security migration", () => {
    expect(securitySql).toMatch(/CREATE POLICY exam_answer_keys_staff/);
    expect(securitySql).toMatch(/USING \(public\.is_admin\(\) OR public\.is_teacher\(\)\)/);
  });

  it("only authoring listExamStructure selects teacher_payload", () => {
    expect(examService).toMatch(/teacher_payload/);
    const idx = examService.indexOf("teacher_payload");
    expect(idx).toBeGreaterThan(0);
    // Must appear inside listExamStructure authoring embed, not student attempt helpers.
    const authoringWindow = examService.slice(
      examService.indexOf("async listExamStructure"),
      examService.indexOf("async createSection"),
    );
    expect(authoringWindow).toMatch(/answer_key:exam_answer_keys/);
    expect(authoringWindow).toMatch(/teacher_payload/);

    const studentWindow = examService.slice(
      examService.indexOf("async startAttempt"),
      examService.indexOf("async submitAttempt") + 200,
    );
    expect(studentWindow).not.toMatch(/teacher_payload/);
    expect(studentWindow).not.toMatch(/exam_answer_keys/);
  });

  it("student runner source does not reference teacher_payload or correct_values", () => {
    expect(runner).not.toMatch(/teacher_payload/);
    expect(runner).not.toMatch(/correct_values/);
    expect(runner).not.toMatch(/audio_script/);
    expect(runner).not.toMatch(/sample_answer/);
  });

  it("student getExam sanitizes metadata and does not select answer keys", () => {
    const getExam = examService.slice(
      examService.indexOf("async getExam"),
      examService.indexOf("async createExam"),
    );
    expect(getExam).toMatch(/sanitizeQuestionMetadataForStudent/);
    expect(getExam).not.toMatch(/exam_answer_keys/);
    expect(getExam).not.toMatch(/teacher_payload/);
    expect(getExam).not.toMatch(/correct_values/);
  });

  it("does not import public exam JSON into the browser app", () => {
    const roots = ["components", "hooks", "services"].map((dir) => resolve(__dirname, "..", dir));
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) files.push(full);
      }
    };
    for (const root of roots) walk(root);
    const leaking = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return text.includes("data/exams") || text.includes("b1-exam-bank.complete");
    });
    expect(leaking).toEqual([]);
  });

  it("student attempt load paths do not embed exam_answer_keys", () => {
    // Heuristic: functions used while taking an exam should not join answer keys.
    const startIdx = examService.indexOf("async startAttempt");
    const saveIdx = examService.indexOf("async saveAnswer");
    const slice = examService.slice(
      startIdx > 0 ? startIdx : 0,
      saveIdx > 0 ? saveIdx + 400 : Math.min(examService.length, 8000),
    );
    expect(slice).not.toMatch(/exam_answer_keys/);
    expect(slice).not.toMatch(/teacher_payload/);
  });
});
