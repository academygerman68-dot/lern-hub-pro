import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  resolve(root, "../../supabase/migrations/20261016140000_exam_attempt_expiry_finalization.sql"),
  "utf8",
);
const scoringSql = readFileSync(
  resolve(root, "../../supabase/migrations/20260927180000_exam_engine_security_goethe_a1.sql"),
  "utf8",
);

describe("exam attempt expiry finalization", () => {
  it("grades an overdue in-progress attempt instead of leaving it expired", () => {
    const startFn = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION public.start_exam_attempt"),
      sql.indexOf("CREATE OR REPLACE FUNCTION public.get_exam_attempt_review"),
    );
    expect(startFn).toMatch(/PERFORM public\.submit_exam_attempt\(existing\.id\)/);
    expect(startFn).toMatch(/FOR UPDATE/);
    expect(startFn).not.toMatch(/SET status = 'expired'/);
  });

  it("counts leftover expired attempts toward the maximum", () => {
    expect(sql).toMatch(/status IN \('submitted', 'graded', 'expired'\)/);
  });

  it("hides answer keys until the attempt is submitted or graded", () => {
    expect(sql).toMatch(/IF attempt_row\.status NOT IN \('submitted', 'graded'\) THEN/);
    expect(sql).toMatch(/RAISE EXCEPTION 'ATTEMPT_NOT_SUBMITTED'/);
  });

  it("lets only the owner, an admin, or that student's teacher read the review", () => {
    expect(sql).toMatch(/attempt_row\.student_id = public\.current_student_id\(\)/);
    expect(sql).toMatch(/public\.teacher_has_student\(attempt_row\.student_id\)/);
    expect(sql).toMatch(/public\.teacher_can_manage_exam\(v_class_id, v_level_id\)/);
  });

  it("keeps server grading authoritative and a second submit idempotent", () => {
    const submitStart = scoringSql.indexOf("CREATE OR REPLACE FUNCTION public.submit_exam_attempt");
    const gradeStart = scoringSql.indexOf(
      "CREATE OR REPLACE FUNCTION public.grade_exam_writing_answer",
    );
    const submitBody = scoringSql.slice(submitStart, gradeStart);
    expect(submitBody).toMatch(
      /IF attempt_row\.status NOT IN \('in_progress', 'expired'\) THEN\s+RETURN attempt_row;/,
    );
    expect(submitBody).toMatch(
      /exam_score_percentage\(attempt_row\.exam_id, total_score, total_max\)/,
    );
    expect(submitBody).not.toMatch(/p_points/);
    expect(scoringSql).toMatch(/IF p_points IS NULL OR p_points < 0 OR p_points > q_points THEN/);
    expect(scoringSql).toMatch(/RAISE EXCEPTION 'INVALID_POINTS'/);
  });

  it("freezes written answers at expiry without locking Goethe oral", () => {
    const saveFn = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION public.save_exam_answer"),
      sql.indexOf("CREATE OR REPLACE FUNCTION public.save_exam_oral_answer"),
    );
    expect(saveFn).toMatch(/RAISE EXCEPTION 'ATTEMPT_EXPIRED'/);
    expect(saveFn).toMatch(/goethe_a1_adult_v1/);
    expect(saveFn).toMatch(/IF NOT v_goethe THEN/);
    const oralFn = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION public.save_exam_oral_answer"),
      sql.indexOf("CREATE OR REPLACE FUNCTION public.grade_exam_writing_answer"),
    );
    expect(oralFn).toMatch(/A1-SIM-%/);
    expect(oralFn).toMatch(/RAISE EXCEPTION 'ATTEMPT_EXPIRED'/);
  });

  it("refuses manual grading until the attempt has been submitted", () => {
    const gradeFn = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION public.grade_exam_writing_answer"),
    );
    expect(gradeFn).toMatch(/IF attempt_row\.status NOT IN \('submitted', 'graded'\) THEN/);
    expect(gradeFn).toMatch(/RAISE EXCEPTION 'ATTEMPT_NOT_READY'/);
    expect(gradeFn).not.toMatch(/'submitted', 'graded', 'expired'/);
  });

  it("leaves the Goethe conversion function untouched", () => {
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.exam_score_percentage/);
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(scoringSql).toContain("RETURN round(coalesce(p_raw_score, 0) * 1.66);");
    expect(scoringSql).toContain("RETURN round((coalesce(p_raw_score, 0) / p_raw_max) * 100, 2);");
  });
});
