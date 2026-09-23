import { describe, expect, it } from "vitest";
import { auditB1ExamContent, classifyB1QuestionContent } from "./b1-content-status";

describe("b1-content-status", () => {
  it("marks placeholders as blocked, never ready", () => {
    const r = classifyB1QuestionContent({
      id: "1",
      prompt: "Frage 8 — OCR unvollständig",
      type: "single_choice",
      skill: "lesen",
      metadata: { transform_status: "placeholder", teil: 2 },
      options: [{ label: "a", value: "a" }],
      correct_values: ["a"],
    });
    expect(r.status).toBe("blocked");
    expect(r.reasons).toContain("placeholder_ocr");
  });

  it("marks glued OCR with review flags as needs_review, not ready", () => {
    const r = classifyB1QuestionContent({
      id: "2",
      prompt: "ClemenskannsichkaumnochandieZeitimLibanonerinnern.",
      type: "true_false",
      skill: "lesen",
      metadata: { teil: 1, needs_review: true, transcription_status: "ocr_unverified" },
      options: [
        { label: "richtig", value: "richtig" },
        { label: "falsch", value: "falsch" },
      ],
      correct_values: ["richtig"],
    });
    expect(r.status).toBe("needs_review");
    expect(r.status).not.toBe("ready");
  });

  it("audits exam totals without inflating ready from placeholders", () => {
    const audit = auditB1ExamContent({
      code: "B1-MT03",
      status: "draft",
      sections: [
        {
          skill: "lesen",
          questions: [
            {
              id: "ok",
              prompt: "Was macht Anna am Wochenende?",
              type: "single_choice",
              sort_order: 1,
              metadata: { teil: 1 },
              options: [
                { label: "a", value: "a" },
                { label: "b", value: "b" },
              ],
              correct_values: ["a"],
            },
            {
              id: "ph",
              prompt: "Frage 11 — OCR unvollständig",
              type: "single_choice",
              sort_order: 11,
              metadata: { transform_status: "placeholder", teil: 2 },
              options: [{ label: "a", value: "a" }],
              correct_values: ["a"],
            },
          ],
        },
      ],
    });
    expect(audit.totals.blocked).toBe(1);
    expect(audit.totals.ready + audit.totals.needs_review).toBe(1);
    expect(audit.blockedItems[0]?.questionId).toBe("ph");
  });
});
