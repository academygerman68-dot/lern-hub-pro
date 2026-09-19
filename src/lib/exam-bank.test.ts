import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateExamBank } from "./exam-bank";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bankPath = resolve(__dirname, "../../data/exams/german-academy-a1-exams.json");

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
