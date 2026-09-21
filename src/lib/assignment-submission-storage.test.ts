import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_SUBMISSION_BUCKET,
  buildAssignmentSubmissionStoragePath,
  isForeignStudentSubmissionPath,
  mapAssignmentSubmissionError,
} from "./assignment-submission-storage";

describe("assignment submission storage", () => {
  it("builds a student-scoped path under course-materials contract", () => {
    const path = buildAssignmentSubmissionStoragePath({
      assignmentId: "asg-1",
      studentId: "stu-a",
      fileName: "photo.PNG",
      objectId: "obj-1",
    });
    expect(ASSIGNMENT_SUBMISSION_BUCKET).toBe("course-materials");
    expect(path).toBe("submissions/asg-1/stu-a/obj-1.png");
  });

  it("detects foreign student paths for isolation checks", () => {
    expect(isForeignStudentSubmissionPath("submissions/asg-1/stu-a/f.png", "stu-a")).toBe(false);
    expect(isForeignStudentSubmissionPath("submissions/asg-1/stu-b/f.png", "stu-a")).toBe(true);
    expect(isForeignStudentSubmissionPath("other/stu-a/f.png", "stu-a")).toBe(true);
  });

  it("never surfaces raw RLS to the student for storage failures", () => {
    const mapped = mapAssignmentSubmissionError(
      { message: "new row violates row-level security policy", statusCode: "403" },
      "storage",
    );
    expect(mapped.message).toBe(
      "Impossible d'envoyer votre fichier. Vérifiez le format ou réessayez.",
    );
    expect(mapped.message.toLowerCase()).not.toContain("row-level");
  });

  it("maps insert RLS without leaking policy text", () => {
    const mapped = mapAssignmentSubmissionError(
      { message: "new row violates row-level security policy", code: "42501" },
      "insert",
    );
    expect(mapped.message).toBe(
      "Impossible d'enregistrer votre remise. Réessayez ou contactez l'administration.",
    );
  });
});
