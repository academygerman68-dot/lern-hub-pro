import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { shellNavPageIds } from "@/components/academy/shell";
import { isPageForRole } from "./academy-logic";
import {
  EXAM_BLANCS_PAGES_BY_ROLE,
  resolvePublishedExamCatalog,
} from "./exam-catalog-visibility";

const __dirname = dirname(fileURLToPath(import.meta.url));
const securityMigration = resolve(
  __dirname,
  "../../supabase/migrations/20260927180000_exam_engine_security_goethe_a1.sql",
);
const additiveMigration = resolve(
  __dirname,
  "../../supabase/migrations/20260927120000_a1_complete_exam_additive.sql",
);
const rollbackScript = resolve(
  __dirname,
  "../../scripts/rollback-exam-engine-security-goethe-a1.sql",
);

describe("exam role non-regression (student / teacher / admin)", () => {
  const securitySql = readFileSync(securityMigration, "utf8");
  const additiveSql = readFileSync(additiveMigration, "utf8");
  const rollbackSql = readFileSync(rollbackScript, "utf8");

  it("keeps A1 seed migration free of global RPC/RLS replacements", () => {
    expect(additiveSql).toMatch(/ADD COLUMN IF NOT EXISTS format_profile/);
    expect(additiveSql).toContain("A1-SIM-01");
    expect(additiveSql).toContain("goethe_a1_adult_v1");
    expect(additiveSql).toMatch(/written_duration_minutes/);
    expect(additiveSql).toMatch(/'draft'/);
    expect(additiveSql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.start_exam_attempt/);
    expect(additiveSql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.submit_exam_attempt/);
    expect(additiveSql).not.toMatch(/DROP POLICY IF EXISTS exam_attempts_select/);
  });

  it("documents and scopes global security changes in the companion migration", () => {
    expect(securitySql).toMatch(/RPC BEHAVIOR DIFF/);
    expect(securitySql).toMatch(/CREATE OR REPLACE FUNCTION public\.exam_score_percentage/);
    expect(securitySql).toMatch(/CREATE OR REPLACE FUNCTION public\.teacher_can_manage_exam/);
    expect(securitySql).toMatch(/exam_answer_keys_staff/);
    expect(securitySql).not.toMatch(/WHERE code = 'A1-SIM-01'/);
    expect(securitySql).toContain("RETURN round(coalesce(p_raw_score, 0) * 1.66);");
    expect(securitySql).not.toContain("round(coalesce(p_raw_score, 0) * 1.66, 2)");
  });

  it("tightens teacher attempt/answer SELECT to own-class students", () => {
    expect(securitySql).toMatch(/teacher_has_student\(/);
    expect(securitySql).toMatch(/teacher_can_manage_exam\(e\.class_id, e\.level_id\)/);
    const attemptsPolicy = securitySql.slice(
      securitySql.indexOf("CREATE POLICY exam_attempts_select"),
      securitySql.indexOf("CREATE POLICY exam_answers_select"),
    );
    expect(attemptsPolicy).toMatch(/teacher_has_student\(exam_attempts\.student_id\)/);
    expect(attemptsPolicy).not.toMatch(/OR public\.is_teacher\(\)\s*\n\s*OR \(/);
  });

  it("provides a self-contained rollback restoring prior functions and broader teacher RLS", () => {
    expect(rollbackSql).toMatch(/DROP FUNCTION IF EXISTS public\.exam_score_percentage/);
    expect(rollbackSql).toMatch(/CREATE OR REPLACE FUNCTION public\.submit_exam_attempt/);
    expect(rollbackSql).toMatch(/CREATE OR REPLACE FUNCTION public\.exam_completeness_report/);
    expect(rollbackSql).toMatch(/CREATE POLICY exam_attempts_select/);
    expect(rollbackSql).toMatch(/OR public\.is_teacher\(\)/);
    expect(rollbackSql).toMatch(/NOT A SECURITY HARDENING STEP/);
  });

  it("student/teacher/admin keep Examens blancs navigation", () => {
    for (const page of EXAM_BLANCS_PAGES_BY_ROLE.student) {
      expect(isPageForRole("student", page)).toBe(true);
    }
    for (const page of EXAM_BLANCS_PAGES_BY_ROLE.teacher) {
      expect(isPageForRole("teacher", page)).toBe(true);
    }
    for (const page of EXAM_BLANCS_PAGES_BY_ROLE.director) {
      expect(isPageForRole("director", page)).toBe(true);
    }
    expect(shellNavPageIds("student")).toContain("exams");
    expect(shellNavPageIds("teacher")).toContain("exams");
    expect(shellNavPageIds("director")).toContain("exams");
  });

  it("published catalog fail-open still lists A1-SIM and other mocks for staff lists", () => {
    const exams = [
      { id: "a1-sim", code: "A1-SIM-01" },
      { id: "a1-01", code: "A1-01" },
      { id: "b1", code: "B1-MT01" },
    ];
    const probes = [
      { complete: true, errored: false },
      { complete: false, errored: true },
      { complete: true, errored: false },
    ];
    expect(resolvePublishedExamCatalog(exams, probes).map((e) => e.code)).toEqual([
      "A1-SIM-01",
      "A1-01",
      "B1-MT01",
    ]);
  });

  it("non-Goethe scoring path remains classic percentage in SQL helper", () => {
    expect(securitySql).toMatch(
      /RETURN round\(\(coalesce\(p_raw_score, 0\) \/ p_raw_max\) \* 100, 2\);/,
    );
  });
});
