import { describe, expect, it } from "vitest";
import {
  hasOralAudioAnswer,
  isSpeakingQuestionType,
  oralRubricFromMeta,
  parseOralAnswer,
  validateOralAnswerAudioFile,
} from "./exam-oral";

describe("exam-oral", () => {
  it("detects speaking type and oral payload", () => {
    expect(isSpeakingQuestionType("speaking")).toBe(true);
    expect(isSpeakingQuestionType("writing")).toBe(false);
    expect(
      parseOralAnswer({
        kind: "oral_audio",
        bucket: "course-materials",
        path: "exam-oral/a/b/c.webm",
        mime_type: "audio/webm",
      })?.path,
    ).toBe("exam-oral/a/b/c.webm");
    expect(hasOralAudioAnswer({ answer_media_path: "x" })).toBe(true);
    expect(hasOralAudioAnswer({ answer: { kind: "text" } })).toBe(false);
  });

  it("validates oral audio formats including webm", () => {
    const webm = new File([new Uint8Array([1, 2, 3])], "oral.webm", { type: "audio/webm" });
    expect(validateOralAnswerAudioFile(webm)).toBeNull();
    const bad = new File([new Uint8Array([1])], "x.txt", { type: "text/plain" });
    expect(validateOralAnswerAudioFile(bad)).toMatch(/Format/);
  });

  it("builds oral rubric from metadata or defaults", () => {
    expect(oralRubricFromMeta({ rubric: { fluency: 3 } }, 10)).toEqual({ fluency: 3 });
    const def = oralRubricFromMeta({}, 10);
    expect(Object.values(def).reduce((a, b) => a + b, 0)).toBe(10);
  });
});
