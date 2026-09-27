import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wave3Rls = resolve(
  __dirname,
  "../../supabase/migrations/20260914230118_exam_engine_wave3.sql",
);
const accessFn = resolve(
  __dirname,
  "../../supabase/migrations/20260917010000_academic_content_targeting.sql",
);
const securityMig = resolve(
  __dirname,
  "../../supabase/migrations/20260927180000_exam_engine_security_goethe_a1.sql",
);
const publishScript = resolve(__dirname, "../../scripts/publish-a1-sim-01.sql");
const rollbackScript = resolve(
  __dirname,
  "../../scripts/rollback-exam-engine-security-goethe-a1.sql",
);

describe("A1-SIM-01 draft access & publish separation", () => {
  const examsSelect = readFileSync(wave3Rls, "utf8");
  const studentAccess = readFileSync(accessFn, "utf8");
  const security = readFileSync(securityMig, "utf8");
  const publishSql = readFileSync(publishScript, "utf8");

  it("students only see published exams via RLS + student_can_access_exam", () => {
    expect(examsSelect).toMatch(
      /status = 'published' AND public\.student_can_access_exam\(id\)/,
    );
    expect(studentAccess).toMatch(/e\.status = 'published'/);
    // Draft rows are therefore invisible to students.
  });

  it("admins and teachers retain SELECT on draft exams", () => {
    expect(examsSelect).toMatch(
      /is_admin\(\)\s*\n\s*OR public\.is_teacher\(\)\s*\n\s*OR \(status = 'published'/,
    );
  });

  it("admins can run completeness on draft (not student-gated only)", () => {
    expect(security).toMatch(/public\.is_admin\(\)/);
    expect(security).toMatch(/public\.is_teacher\(\)/);
    expect(security).toMatch(/public\.student_can_access_exam\(p_exam_id\)/);
  });

  it("publish script targets only A1-SIM-01 and is not a migration", () => {
    expect(publishSql).toContain("A1-SIM-01");
    expect(publishSql).toContain("811f4e04-864d-46b4-8c61-c2d319003efc");
    expect(publishSql).toMatch(/code = 'A1-SIM-01'/);
    expect(publishSql).not.toMatch(/UPDATE public\.exams[\s\S]*WHERE code <>/i);
    expect(existsSync(resolve(__dirname, "../../supabase/migrations/publish-a1-sim-01.sql"))).toBe(
      false,
    );
  });

  it("keeps autonomous rollback available as pre-apply safety net", () => {
    expect(existsSync(rollbackScript)).toBe(true);
    const rollback = readFileSync(rollbackScript, "utf8");
    expect(rollback).toMatch(/CREATE OR REPLACE FUNCTION public\.start_exam_attempt/);
    expect(rollback).toMatch(/CREATE OR REPLACE FUNCTION public\.submit_exam_attempt/);
    expect(rollback).toMatch(/CREATE OR REPLACE FUNCTION public\.exam_completeness_report/);
    expect(rollback.length).toBeGreaterThan(10_000);
  });
});
