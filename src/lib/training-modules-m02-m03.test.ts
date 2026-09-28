import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  toStudentTrainingPayload,
  validateTrainingModule,
} from "./training-module-schema";
import { isExamSimulationCode, isTrainingModuleProfile } from "./training-module";

const modulesDir = path.resolve("data/exams/a1-b1-series/modules");

function load(code: string) {
  return JSON.parse(fs.readFileSync(path.join(modulesDir, `${code}.json`), "utf8"));
}

describe("GA-A1-M02 / GA-A1-M03 draft modules", () => {
  for (const code of ["GA-A1-M02", "GA-A1-M03"] as const) {
    it(`${code} validates as draft training module with 13 activities`, () => {
      const raw = load(code);
      const result = validateTrainingModule(raw);
      if (!result.ok) throw new Error(result.errors.join("\n"));
      expect(result.module.module_id).toBe(code);
      expect(result.module.publication_status).toBe("draft");
      expect(result.module.format_profile).toBe("ga_training_module_v1");
      expect(result.module.activities).toHaveLength(13);
      expect(isTrainingModuleProfile(result.module)).toBe(true);
      expect(isExamSimulationCode(code)).toBe(false);
      expect(result.module.correction.goethe_scoring).toBe(false);
      expect(result.module.correction.timed_exam).toBe(false);
      expect(result.module.provenance.content_origin).toBe("original");
      expect(result.module.provenance.commercial_media_used).toBe(false);
    });

    it(`${code} student payload strips keys and staff scripts`, () => {
      const result = validateTrainingModule(load(code));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const student = toStudentTrainingPayload(result.module);
      const blob = JSON.stringify(student);
      expect(blob).not.toMatch(/correct_answer/);
      expect(blob).not.toMatch(/correct_form/);
      expect(blob).not.toMatch(/sample_answer_staff_only/);
      expect(blob).not.toMatch(/script_staff_only/);
      expect(blob).not.toMatch(/audio_script_staff_only/);
    });
  }

  it("M02 and M03 have unique ids and distinct themes from M01", () => {
    const m01 = validateTrainingModule(load("GA-A1-M01"));
    const m02 = validateTrainingModule(load("GA-A1-M02"));
    const m03 = validateTrainingModule(load("GA-A1-M03"));
    expect(m01.ok && m02.ok && m03.ok).toBe(true);
    if (!m01.ok || !m02.ok || !m03.ok) return;

    expect(m02.module.title).toMatch(/Familie/);
    expect(m03.module.title).toMatch(/Zahlen|Preise|Einkaufen/);
    expect(m02.module.title).not.toBe(m01.module.title);
    expect(m03.module.title).not.toBe(m01.module.title);

    const ids = [
      ...m01.module.activities.map((a) => a.id),
      ...m02.module.activities.map((a) => a.id),
      ...m03.module.activities.map((a) => a.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);

    const m01Blob = JSON.stringify(m01.module.activities.map((a) => a.prompt)).toLowerCase();
    expect(m02.module.activities.some((a) => m01Blob.includes(a.prompt.toLowerCase()))).toBe(
      false,
    );
  });

  it("covers runner activity types used by M02/M03 without hardcoded pages", () => {
    const types = new Set<string>();
    for (const code of ["GA-A1-M02", "GA-A1-M03"]) {
      const result = validateTrainingModule(load(code));
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      for (const a of result.module.activities) types.add(a.activity_type);
      expect(result.module.activities.some((a) => a.skill === "hoeren")).toBe(true);
      expect(result.module.activities.filter((a) => a.activity_type === "listening")).toHaveLength(
        2,
      );
      expect(result.module.activities.some((a) => a.activity_type === "writing")).toBe(true);
      expect(result.module.activities.some((a) => a.activity_type === "speaking")).toBe(true);
      expect(result.module.activities.some((a) => a.activity_type === "form_fill")).toBe(true);
      expect(result.module.activities.some((a) => a.skill === "revision")).toBe(true);
    }
    expect(types.has("single_choice")).toBe(true);
    expect(types.has("true_false")).toBe(true);
    expect(types.has("listening")).toBe(true);
  });

  it("ships original audio assets for M02 and M03", () => {
    const a2 = path.resolve("public/exam-media/ga-a1-m02/hoeren-familie.mp3");
    const a3 = path.resolve("public/exam-media/ga-a1-m03/hoeren-einkaufen.mp3");
    expect(fs.existsSync(a2)).toBe(true);
    expect(fs.existsSync(a3)).toBe(true);
    expect(fs.statSync(a2).size).toBeGreaterThan(1000);
    expect(fs.statSync(a3).size).toBeGreaterThan(1000);
  });

  it("prepared draft seeds exist and are not auto-published", () => {
    const s2 = path.resolve(
      "supabase/migrations/20260928180200_seed_ga_a1_m02_training_module.sql",
    );
    const s3 = path.resolve(
      "supabase/migrations/20260928180300_seed_ga_a1_m03_training_module.sql",
    );
    expect(fs.existsSync(s2)).toBe(true);
    expect(fs.existsSync(s3)).toBe(true);
    expect(fs.readFileSync(s2, "utf8")).toMatch(/'draft'/);
    expect(fs.readFileSync(s3, "utf8")).toMatch(/'draft'/);
    expect(fs.readFileSync(s2, "utf8")).toMatch(/DO NOT apply without confirmation/);
  });
});
