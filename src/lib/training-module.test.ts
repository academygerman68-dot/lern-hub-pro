import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  isExamSimulationCode,
  isTrainingModuleProfile,
  TRAINING_MODULE_PROFILE,
} from "./training-module";
import {
  toStudentTrainingPayload,
  validateTrainingModule,
} from "./training-module-schema";

const modulePath = path.resolve("data/exams/a1-b1-series/modules/GA-A1-M01.json");

describe("training module identity", () => {
  it("recognizes GA training codes and never treats them as exam sims", () => {
    expect(isTrainingModuleProfile({ code: "GA-A1-M01" })).toBe(true);
    expect(
      isTrainingModuleProfile({ format_profile: TRAINING_MODULE_PROFILE }),
    ).toBe(true);
    expect(isExamSimulationCode("GA-A1-M01")).toBe(false);
    expect(isExamSimulationCode("A1-SIM-01")).toBe(true);
    expect(isExamSimulationCode("B1-MT01")).toBe(true);
  });
});

describe("GA-A1-M01 pilot module", () => {
  const raw = JSON.parse(fs.readFileSync(modulePath, "utf8"));

  it("validates against the shared A1→B1 schema", () => {
    const result = validateTrainingModule(raw);
    if (!result.ok) {
      throw new Error(result.errors.join("\n"));
    }
    expect(result.module.module_id).toBe("GA-A1-M01");
    expect(result.module.kind).toBe("training_module");
    expect(result.module.publication_status).toBe("draft");
    expect(result.module.correction.goethe_scoring).toBe(false);
    expect(result.module.correction.timed_exam).toBe(false);
    expect(result.module.correction.pass_fail_certificate).toBe(false);
    expect(result.module.activities).toHaveLength(13);
  });

  it("covers required skills and keeps original provenance", () => {
    const result = validateTrainingModule(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const skill of [
      "wortschatz",
      "grammatik",
      "lesen",
      "hoeren",
      "schreiben",
      "sprechen",
      "revision",
    ]) {
      expect(result.module.skills).toContain(skill);
      expect(result.module.activities.some((a) => a.skill === skill)).toBe(true);
    }
    expect(result.module.provenance.content_origin).toBe("original");
    expect(result.module.provenance.publisher_content_embedded).toBe(false);
    expect(result.module.provenance.commercial_media_used).toBe(false);
  });

  it("fixes formal heißen and strips keys from student payload", () => {
    const result = validateTrainingModule(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const g01 = result.module.activities.find((a) => a.id === "GA-A1-M01-G01");
    expect(g01 && "correct_answer" in g01 && g01.correct_answer).toBe("A");

    const student = toStudentTrainingPayload(result.module);
    const blob = JSON.stringify(student);
    expect(blob).not.toContain("correct_answer");
    expect(blob).not.toContain("correct_form");
    expect(blob).not.toContain("audio_script_staff_only");
    expect(blob).not.toContain("sample_answer_staff_only");
    expect(blob).not.toContain("a1-b1-series/source");
    expect(blob.toLowerCase()).not.toMatch(/schritte|hueber|cornelsen|klett/);
  });

  it("rejects duplicate ids and missing hören audio", () => {
    const bad = structuredClone(raw);
    bad.activities[0].id = bad.activities[1].id;
    expect(validateTrainingModule(bad).ok).toBe(false);

    const noAudio = structuredClone(raw);
    const hoeren = noAudio.activities.find((a: { skill: string }) => a.skill === "hoeren");
    if (hoeren?.media) delete hoeren.media.audio_url;
    expect(validateTrainingModule(noAudio).ok).toBe(false);
  });

  it("rejects commercial source markers in publishable payload", () => {
    const dirty = structuredClone(raw);
    dirty.subtitle = "Based on Schritte Plus Neu workbook";
    expect(validateTrainingModule(dirty).ok).toBe(false);
  });
});
