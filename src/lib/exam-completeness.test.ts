import { describe, expect, it } from "vitest";
import {
  countHorenAudioReady,
  parseCompletenessReport,
  questionHasAudio,
  questionNeedsHorenAudio,
  validateExamAudioFile,
  validateExamCompleteness,
} from "./exam-completeness";

describe("exam completeness — Hören audio", () => {
  it("detects when Hören questions need audio", () => {
    expect(questionNeedsHorenAudio("hoeren", "true_false")).toBe(true);
    expect(questionNeedsHorenAudio("lesen", "listening")).toBe(true);
    expect(questionNeedsHorenAudio("lesen", "single_choice")).toBe(false);
  });

  it("accepts media_path or external audio_url", () => {
    expect(
      questionHasAudio({
        media_bucket: "course-materials",
        media_path: "exam-audio/q1/a.mp3",
      }),
    ).toBe(true);
    expect(questionHasAudio({ metadata: { audio_url: "https://cdn.example/a.mp3" } })).toBe(true);
    expect(questionHasAudio({ media_path: null, metadata: { audio_url: null } })).toBe(false);
  });

  it("blocks incomplete exams missing Hören audio and answer keys", () => {
    const report = validateExamCompleteness([
      {
        id: "1",
        prompt: "Wie spät ist es?",
        type: "true_false",
        points: 1,
        skill: "hoeren",
        sectionTitle: "Hören",
        correct_values: ["true"],
      },
      {
        id: "2",
        prompt: "QCM sans clé",
        type: "single_choice",
        points: 1,
        skill: "lesen",
        sectionTitle: "Lesen",
        correct_values: [],
      },
    ]);
    expect(report.ok).toBe(false);
    expect(report.horenTotal).toBe(1);
    expect(report.horenReady).toBe(0);
    expect(report.issues.some((i) => i.includes("Audio Hören manquant"))).toBe(true);
    expect(report.issues.some((i) => i.includes("Réponse correcte manquante"))).toBe(true);
  });

  it("passes when Hören audio and keys are present", () => {
    const questions = [
      {
        id: "1",
        prompt: "Wie spät ist es?",
        type: "true_false",
        points: 1,
        skill: "hoeren",
        sectionTitle: "Hören",
        media_bucket: "course-materials",
        media_path: "exam-audio/1.mp3",
        correct_values: ["true"],
      },
      {
        id: "2",
        prompt: "Schreiben Sie",
        type: "writing",
        points: 10,
        skill: "schreiben",
        sectionTitle: "Schreiben",
      },
    ];
    const report = validateExamCompleteness(questions);
    expect(report.ok).toBe(true);
    expect(countHorenAudioReady(questions)).toEqual({ ready: 1, total: 1 });
    expect(report.horenReady).toBe(1);
    expect(report.horenTotal).toBe(1);
  });

  it("validates audio file types", () => {
    expect(validateExamAudioFile(null)).toMatch(/Choisissez/);
    const mp3 = new File([new Uint8Array([1, 2, 3])], "track.mp3", { type: "audio/mpeg" });
    expect(validateExamAudioFile(mp3)).toBeNull();
    const bad = new File([new Uint8Array([1])], "x.txt", { type: "text/plain" });
    expect(validateExamAudioFile(bad)).toMatch(/Format/);
  });

  it("parses SQL completeness reports", () => {
    const parsed = parseCompletenessReport({
      ok: false,
      issues: ["Audio Hören manquant · « Test »"],
      horen_ready: 2,
      horen_total: 15,
      question_count: 32,
    });
    expect(parsed.ok).toBe(false);
    expect(parsed.horenReady).toBe(2);
    expect(parsed.horenTotal).toBe(15);
    expect(parsed.issues).toHaveLength(1);
  });

  it("flags OCR non validé for needs_review / ocr_unverified", () => {
    const report = validateExamCompleteness([
      {
        id: "ocr-1",
        prompt: "Lesen Sie den Text",
        type: "text",
        points: 1,
        skill: "lesen",
        sectionTitle: "Lesen",
        metadata: { needs_review: true, transcription_status: "ocr_unverified" },
      },
    ]);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes("OCR non validé"))).toBe(true);
  });

  it("flags Audio Hören non vérifié (contenu) when media present but not content_verified", () => {
    const report = validateExamCompleteness([
      {
        id: "h-1",
        prompt: "Hören Teil 1",
        type: "listening",
        points: 1,
        skill: "hoeren",
        sectionTitle: "Hören",
        media_bucket: "course-materials",
        media_path: "exams/b1/b1-mt01/hoeren/teil-1.mp3",
        metadata: {
          needs_review: true,
          transcription_status: "ocr_unverified",
          audio_verification_status: "unverified",
        },
        correct_values: null,
      },
    ]);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes("Audio Hören non vérifié (contenu)"))).toBe(
      true,
    );
    expect(report.issues.some((i) => i.includes("OCR non validé"))).toBe(true);
  });

  it("flags Barème provisoire and Placeholder OCR", () => {
    const report = validateExamCompleteness([
      {
        id: "p1",
        prompt: "Frage 3 — OCR unvollständig",
        type: "true_false",
        points: 1,
        skill: "lesen",
        sectionTitle: "Lesen",
        metadata: {
          transform_status: "placeholder",
          points_rubric: "provisional_needs_review",
        },
        correct_values: ["richtig"],
      },
    ]);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes("Barème provisoire"))).toBe(true);
    expect(report.issues.some((i) => i.includes("Placeholder OCR"))).toBe(true);
  });

  it("does not flag A1 when OCR/audio verification metadata absent", () => {
    const report = validateExamCompleteness([
      {
        id: "a1-h",
        prompt: "Wie spät ist es?",
        type: "true_false",
        points: 1,
        skill: "hoeren",
        sectionTitle: "Hören",
        media_bucket: "course-materials",
        media_path: "exam-audio/a1.mp3",
        correct_values: ["true"],
      },
      {
        id: "a1-w",
        prompt: "Schreiben Sie",
        type: "writing",
        points: 10,
        skill: "schreiben",
        sectionTitle: "Schreiben",
      },
    ]);
    expect(report.ok).toBe(true);
    expect(report.issues.some((i) => i.includes("OCR non validé"))).toBe(false);
    expect(report.issues.some((i) => i.includes("Audio Hören non confirmé"))).toBe(false);
  });
});
