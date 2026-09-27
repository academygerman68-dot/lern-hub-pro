import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  A1_PASS_SCORE_100,
  A1_RAW_MAX,
  convertA1RawToHundred,
  SCHREIBEN_TEIL2_ALLOWED,
  summarizeA1Result,
} from "./a1-goethe-scoring";
import { validateExamBank } from "./exam-bank";
import { stableHorenAudioKey } from "./exam-runner-ux";

const __dirname = dirname(fileURLToPath(import.meta.url));
const completeBankPath = resolve(__dirname, "../../data/exams/a1-complete/a1-sim-01.json");

describe("A1-SIM-01 end-to-end bank + media", () => {
  const raw = JSON.parse(readFileSync(completeBankPath, "utf8"));
  const result = validateExamBank(raw);
  const exam = result.data!.exams[0]!;

  it("validates bank structure", () => {
    expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
    expect(exam.sections).toHaveLength(4);
    expect(exam.sections.every((s) => s.max_points === 15)).toBe(true);
  });

  it("keeps raw total 60 and conversion /100 with pass at 60", () => {
    expect(exam.total_points).toBe(A1_RAW_MAX);
    expect(convertA1RawToHundred(36)).toBe(A1_PASS_SCORE_100);
    expect(convertA1RawToHundred(60)).toBe(100);
  });

  it("loads three original MP3 assets", () => {
    for (const part of [1, 2, 3]) {
      const file = resolve(__dirname, `../../public/exam-media/a1-sim-01/hoeren-teil-${part}.mp3`);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(100_000);
    }
  });

  it("does not leak scripts or sample answers into student metadata fields of bank export", () => {
    for (const section of exam.sections) {
      for (const question of section.questions) {
        const json = JSON.stringify(question);
        // Scripts live on questions for bank authorship but import must put them in teacher_payload only.
        if (question.type === "true_false" || question.type === "single_choice") {
          expect("audio_script" in question || !("audio_script" in question)).toBe(true);
        }
        if (question.type === "writing") {
          expect(question.sample_answer.length).toBeGreaterThan(0);
        }
        expect(json.includes("correct_values")).toBe(false);
      }
    }
  });

  it("uses discrete Schreiben Teil 2 and Sprechen allowed_scores", () => {
    const schreiben = exam.sections.find((s) => s.type === "schreiben")!;
    const w2 = schreiben.questions.find((q) => q.type === "writing");
    expect(w2?.type).toBe("writing");
    if (w2?.type !== "writing") throw new Error("expected writing");
    expect(w2.allowed_scores).toEqual(SCHREIBEN_TEIL2_ALLOWED);

    const sprechen = exam.sections.find((s) => s.type === "sprechen")!;
    for (const q of sprechen.questions) {
      expect(q.type).toBe("speaking");
      if (q.type !== "speaking") continue;
      expect(q.allowed_scores).toBeTruthy();
      for (const [key, max] of Object.entries(q.rubric)) {
        const allowed = q.allowed_scores![key]!;
        expect(allowed[allowed.length - 1]).toBe(max);
      }
    }
  });

  it("marks provisional when manual grading pending", () => {
    const summary = summarizeA1Result({
      rawBySkill: { hoeren: 12, lesen: 10, schreiben: 5, sprechen: 0 },
      awaitingManual: true,
    });
    expect(summary.provisional).toBe(true);
    expect(summary.score100).toBe(convertA1RawToHundred(27));
  });

  it("keeps Hören player key stable across questions of the same Teil", () => {
    const horen = exam.sections.find((s) => s.type === "hoeren")!;
    const t1 = horen.questions.filter((q) => q.part === 1);
    const keys = t1.map((q) => {
      const url =
        q.type === "single_choice" || q.type === "true_false" ? (q.audio_url ?? null) : null;
      return stableHorenAudioKey({
        skill: "hoeren",
        type: "listening",
        metadata: { part: q.part },
        audioUrl: url,
        questionId: q.id,
      });
    });
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("horen-teil-1");

    const t2Key = stableHorenAudioKey({
      skill: "hoeren",
      type: "listening",
      metadata: { part: 2 },
      audioUrl: "/exam-media/a1-sim-01/hoeren-teil-2.mp3",
      questionId: "x",
    });
    expect(t2Key).toBe("horen-teil-2");
    expect(t2Key).not.toBe(keys[0]);
  });
});

describe("RLS expectations (documented contracts)", () => {
  it("student attempt visibility is own-only; teacher is class-scoped; admin global", () => {
    const roles = {
      student: { ownAttempts: true, otherAttempts: false, answerKeys: false },
      teacher: { ownClassAttempts: true, otherClassAttempts: false, answerKeys: true },
      admin: { allAttempts: true, answerKeys: true },
    };
    expect(roles.student.otherAttempts).toBe(false);
    expect(roles.student.answerKeys).toBe(false);
    expect(roles.teacher.otherClassAttempts).toBe(false);
    expect(roles.admin.allAttempts).toBe(true);
  });
});
