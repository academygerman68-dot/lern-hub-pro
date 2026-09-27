import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  a1ConversionTable,
  convertA1RawToHundred,
  sqlRoundGoetheRawToHundred,
} from "./a1-goethe-scoring";

const __dirname = dirname(fileURLToPath(import.meta.url));
const additivePath = resolve(
  __dirname,
  "../../supabase/migrations/20260927120000_a1_complete_exam_additive.sql",
);
const securityPath = resolve(
  __dirname,
  "../../supabase/migrations/20260927180000_exam_engine_security_goethe_a1.sql",
);
const rollbackPath = resolve(
  __dirname,
  "../../scripts/rollback-exam-engine-security-goethe-a1.sql",
);

describe("A1 migration invariants", () => {
  const additive = readFileSync(additivePath, "utf8");
  const security = readFileSync(securityPath, "utf8");
  const rollback = readFileSync(rollbackPath, "utf8");

  it("additive migration is safe on empty schema evolution and existing exam tables", () => {
    expect(additive).toMatch(/ADD COLUMN IF NOT EXISTS format_profile/);
    expect(additive).toMatch(/ADD COLUMN IF NOT EXISTS written_duration_minutes/);
    expect(additive).toMatch(/ADD COLUMN IF NOT EXISTS speaking_duration_minutes/);
    expect(additive).toMatch(/ON CONFLICT \(id\) DO UPDATE/);
    expect(additive).toMatch(/ON CONFLICT \(question_id\) DO UPDATE/);
    // Does not DROP tables or truncate — additive/upsert only.
    expect(additive).not.toMatch(/\bDROP TABLE\b/i);
    expect(additive).not.toMatch(/\bTRUNCATE\b/i);
    expect(additive).not.toMatch(/\bDELETE FROM\b/i);
  });

  it("seeds A1-SIM-01 as draft and never force-publishes on re-seed", () => {
    expect(additive).toMatch(/'A1-SIM-01'/);
    expect(additive).toMatch(/'draft'/);
    expect(additive).toMatch(
      /status = CASE WHEN public\.exams\.status = 'published' THEN public\.exams\.status ELSE EXCLUDED\.status END/,
    );
    expect(additive).toMatch(/published_at = public\.exams\.published_at/);
    // Must not insert as published for the Goethe complete sim.
    const insertBlock = additive.slice(
      additive.indexOf("-- A1-SIM-01"),
      additive.indexOf("ON CONFLICT (id) DO UPDATE"),
    );
    expect(insertBlock).toContain("'draft'");
    expect(insertBlock).not.toMatch(/'published'/);
  });

  it("global security migration keeps classic path when format_profile is NULL", () => {
    expect(security).toMatch(/IF v_profile = 'goethe_a1_adult_v1' THEN/);
    expect(security).toMatch(
      /RETURN round\(\(coalesce\(p_raw_score, 0\) \/ p_raw_max\) \* 100, 2\);/,
    );
    expect(security).toMatch(
      /mins := coalesce\(exam_row\.written_duration_minutes, exam_row\.duration_minutes, 65\);/,
    );
    // Goethe structure gates only when profile/code match.
    expect(security).toMatch(
      /IF v_profile = 'goethe_a1_adult_v1' OR v_code = 'A1-SIM-01' THEN/,
    );
  });

  it("rollback is self-contained with full function bodies and honest headers", () => {
    expect(rollback).toMatch(/THIS ROLLBACK IS NOT A SECURITY HARDENING STEP/);
    expect(rollback).toMatch(/REMOVES/);
    expect(rollback).toMatch(/RESTORES/);
    expect(rollback).toMatch(/KEEPS INTENTIONALLY/);
    expect(rollback).toMatch(/CREATE OR REPLACE FUNCTION public\.teacher_can_manage_exam/);
    expect(rollback).toMatch(/CREATE OR REPLACE FUNCTION public\.start_exam_attempt/);
    expect(rollback).toMatch(/CREATE OR REPLACE FUNCTION public\.submit_exam_attempt/);
    expect(rollback).toMatch(/CREATE OR REPLACE FUNCTION public\.grade_exam_writing_answer/);
    expect(rollback).toMatch(/CREATE OR REPLACE FUNCTION public\.exam_completeness_report/);
    expect(rollback).toMatch(/duration_minutes/);
    expect(rollback).toMatch(/\(total_score \/ total_max\) \* 100/);
    expect(rollback).not.toMatch(/re-apply prior function bodies/i);
    expect(rollback).toMatch(/no external SQL lookup required/i);
  });
});

describe("Goethe conversion SQL ↔ TypeScript parity (0..60)", () => {
  it("stays in [0,100], non-decreasing, and 60 → 100", () => {
    const table = a1ConversionTable();
    expect(table).toHaveLength(61);
    let prev = -1;
    for (const { raw, score100 } of table) {
      expect(score100).toBeGreaterThanOrEqual(0);
      expect(score100).toBeLessThanOrEqual(100);
      expect(score100).toBeGreaterThanOrEqual(prev);
      prev = score100;
      expect(convertA1RawToHundred(raw)).toBe(score100);
      expect(sqlRoundGoetheRawToHundred(raw)).toBe(score100);
    }
    expect(table[0]?.score100).toBe(0);
    expect(table[60]?.score100).toBe(100);
  });

  it("matches the SQL formula round(raw * 1.66) for every integer 0..60", () => {
    for (let raw = 0; raw <= 60; raw += 1) {
      const sqlEquivalent = Math.round(raw * 1.66);
      expect(sqlRoundGoetheRawToHundred(raw)).toBe(sqlEquivalent);
      expect(convertA1RawToHundred(raw)).toBe(sqlEquivalent);
      // Guard the broken 2-decimal path that yielded 99.60 for a perfect score.
      if (raw === 60) {
        expect(Number((raw * 1.66).toFixed(2))).toBe(99.6);
        expect(sqlEquivalent).toBe(100);
      }
    }
  });

  it("security migration SQL uses integer round (not round(..., 2)) for Goethe", () => {
    const security = readFileSync(securityPath, "utf8");
    expect(security).toContain("RETURN round(coalesce(p_raw_score, 0) * 1.66);");
    expect(security).not.toContain("round(coalesce(p_raw_score, 0) * 1.66, 2)");
  });
});
