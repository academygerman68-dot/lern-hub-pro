import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateExamBank } from "./exam-bank";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bankPath = resolve(__dirname, "../../data/exams/german-academy-a1-exams.json");
const completeBankPath = resolve(__dirname, "../../data/exams/a1-complete/a1-sim-01.json");

describe("A1 exam bank", () => {
  it("validates bank JSON with expected counts and totals", () => {
    const raw = JSON.parse(readFileSync(bankPath, "utf8"));
    const result = validateExamBank(raw);
    expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
    expect(result.data).toBeDefined();

    const bank = result.data!;
    expect(bank.exams).toHaveLength(3);

    for (const exam of bank.exams) {
      expect(exam.total_points).toBe(50);
      expect(exam.automatic_points).toBe(40);
      expect(exam.manual_points).toBe(10);

      const lesen = exam.sections.find((s) => s.type === "lesen");
      const hoeren = exam.sections.find((s) => s.type === "hoeren");
      const schreiben = exam.sections.find((s) => s.type === "schreiben");
      expect(lesen?.questions).toHaveLength(15);
      expect(hoeren?.questions).toHaveLength(15);
      expect(schreiben?.questions).toHaveLength(2);
    }

    const questionIds = bank.exams.flatMap((exam) =>
      exam.sections.flatMap((section) => section.questions.map((q) => q.id)),
    );
    expect(new Set(questionIds).size).toBe(questionIds.length);

    for (const exam of bank.exams) {
      for (const section of exam.sections) {
        for (const question of section.questions) {
          if (question.type !== "true_false" && question.type !== "single_choice") continue;
          const values = question.choices.map((c) => (typeof c === "string" ? c : c.id));
          const labels = question.choices.map((c) => (typeof c === "string" ? c : c.text));
          expect(
            values.includes(question.correct_answer) || labels.includes(question.correct_answer),
          ).toBe(true);
        }
      }
    }
  });
});

describe("complete A1 adult simulation", () => {
  it("validates four skills and official raw-point structure", () => {
    const raw = JSON.parse(readFileSync(completeBankPath, "utf8"));
    const result = validateExamBank(raw);
    expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);

    const exam = result.data!.exams[0]!;
    expect(exam.total_points).toBe(60);
    expect(exam.automatic_points).toBe(35);
    expect(exam.manual_points).toBe(25);
    expect(exam.sections.map((section) => section.type).sort()).toEqual([
      "hoeren",
      "lesen",
      "schreiben",
      "sprechen",
    ]);
    expect(exam.sections.every((section) => section.max_points === 15)).toBe(true);

    const horen = exam.sections.find((section) => section.type === "hoeren")!;
    const lesen = exam.sections.find((section) => section.type === "lesen")!;
    expect([1, 2, 3].map((part) => horen.questions.filter((q) => q.part === part).length)).toEqual([
      6, 4, 5,
    ]);
    expect([1, 2, 3].map((part) => lesen.questions.filter((q) => q.part === part).length)).toEqual([
      5, 5, 5,
    ]);
  });
});
