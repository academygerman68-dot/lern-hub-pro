import { describe, expect, it } from "vitest";
import {
  countExamParticipantStatuses,
  examParticipantStatusLabel,
  pickLatestAttempt,
  resolveExamParticipantStatus,
  type ExamParticipantRow,
} from "./exam-participant-status";

describe("exam-participant-status", () => {
  it("marks missing attempts as not_started or no_show after deadline", () => {
    expect(resolveExamParticipantStatus({ attempt: null })).toBe("not_started");
    expect(
      resolveExamParticipantStatus({
        attempt: null,
        endsAt: "2020-01-01T00:00:00Z",
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    ).toBe("no_show");
  });

  it("maps attempt statuses to staff tracking labels", () => {
    expect(
      resolveExamParticipantStatus({ attempt: { status: "in_progress" } }),
    ).toBe("in_progress");
    expect(
      resolveExamParticipantStatus({ attempt: { status: "submitted" } }),
    ).toBe("awaiting_grade");
    expect(resolveExamParticipantStatus({ attempt: { status: "graded" } })).toBe("graded");
    expect(examParticipantStatusLabel("awaiting_grade")).toBe("En attente de correction");
  });

  it("picks the latest attempt and counts statuses", () => {
    const latest = pickLatestAttempt([
      { started_at: "2026-01-01T10:00:00Z" },
      { started_at: "2026-01-02T10:00:00Z", submitted_at: "2026-01-02T11:00:00Z" },
    ]);
    expect(latest?.submitted_at).toBe("2026-01-02T11:00:00Z");

    const rows: ExamParticipantRow[] = [
      {
        studentId: "a",
        displayName: "A",
        email: null,
        status: "not_started",
        attemptId: null,
        attemptStatus: null,
        score: null,
        maxScore: null,
        percentage: null,
        startedAt: null,
        submittedAt: null,
      },
      {
        studentId: "b",
        displayName: "B",
        email: null,
        status: "graded",
        attemptId: "1",
        attemptStatus: "graded",
        score: 10,
        maxScore: 20,
        percentage: 50,
        startedAt: null,
        submittedAt: null,
      },
    ];
    expect(countExamParticipantStatuses(rows)).toMatchObject({ not_started: 1, graded: 1 });
  });
});
