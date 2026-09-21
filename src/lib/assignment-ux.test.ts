import { describe, expect, it } from "vitest";
import {
  assignmentCtaLabel,
  assignmentUxLabel,
  matchesAssignmentFilter,
  resolveAssignmentUxStatus,
} from "./assignment-ux";

describe("assignment ux status", () => {
  const dueFuture = new Date(Date.now() + 86_400_000).toISOString();
  const duePast = new Date(Date.now() - 86_400_000).toISOString();

  it("marks missing work as todo or late", () => {
    expect(resolveAssignmentUxStatus({ dueAt: dueFuture })).toBe("todo");
    expect(resolveAssignmentUxStatus({ dueAt: duePast })).toBe("late");
  });

  it("detects in-progress drafts with content", () => {
    expect(
      resolveAssignmentUxStatus({
        dueAt: dueFuture,
        submission: { status: "draft", content_text: "brouillon" },
      }),
    ).toBe("in_progress");
  });

  it("detects submitted and graded", () => {
    expect(
      resolveAssignmentUxStatus({
        dueAt: dueFuture,
        submission: {
          status: "submitted",
          submitted_at: new Date().toISOString(),
          version: 1,
        },
      }),
    ).toBe("submitted");
    expect(
      resolveAssignmentUxStatus({
        dueAt: dueFuture,
        submission: { status: "graded", score: 12 },
      }),
    ).toBe("graded");
  });

  it("flags edits after submit or after due", () => {
    const submittedAt = new Date(Date.now() - 3_600_000).toISOString();
    expect(
      resolveAssignmentUxStatus({
        dueAt: dueFuture,
        submission: {
          status: "submitted",
          submitted_at: submittedAt,
          last_edited_at: new Date().toISOString(),
          version: 2,
        },
      }),
    ).toBe("edited_after_submit");
    expect(
      resolveAssignmentUxStatus({
        dueAt: duePast,
        submission: {
          status: "submitted",
          submitted_at: submittedAt,
          edited_after_due: true,
          version: 2,
        },
      }),
    ).toBe("edited_after_submit");
  });

  it("exposes french labels and cta", () => {
    expect(assignmentUxLabel("todo")).toBe("À faire");
    expect(assignmentUxLabel("graded")).toBe("Corrigé");
    expect(assignmentCtaLabel("todo")).toBe("Ouvrir");
    expect(assignmentCtaLabel("graded")).toBe("Voir la correction");
    expect(assignmentCtaLabel("submitted")).toBe("Voir / Modifier");
  });

  it("matches filters", () => {
    expect(matchesAssignmentFilter("todo", "todo")).toBe(true);
    expect(matchesAssignmentFilter("in_progress", "todo")).toBe(true);
    expect(matchesAssignmentFilter("edited_after_submit", "submitted")).toBe(true);
    expect(matchesAssignmentFilter("graded", "graded")).toBe(true);
    expect(matchesAssignmentFilter("late", "all")).toBe(true);
  });
});
