import { describe, expect, it } from "vitest";
import {
  authenticate,
  isPageForRole,
  isRole,
  isStudentPendingAllowedPage,
  isStudentRestrictedAllowedPage,
  scoreExam,
  STUDENT_PENDING_MESSAGE,
  STUDENT_RESTRICTED_MESSAGE,
} from "./academy-logic";

describe("authenticate", () => {
  it("accepts demo student credentials", () => {
    const user = authenticate("ahmed@demo.ma", "password");
    expect(user?.role).toBe("student");
    expect(user?.name).toBe("Ahmed Benali");
  });

  it("rejects unknown passwords", () => {
    expect(authenticate("ahmed@demo.ma", "wrong")).toBeNull();
  });
});

describe("scoreExam", () => {
  it("scores a perfect paper", () => {
    expect(scoreExam({ 1: 1, 2: 2, 3: 0, 4: 0 }).overall).toBe(100);
  });

  it("scores a partial paper", () => {
    const result = scoreExam({ 1: 1, 2: 0, 3: 0, 4: 1 });
    expect(result.correct).toBe(2);
    expect(result.overall).toBe(50);
  });
});

describe("page guards", () => {
  it("recognizes roles and role pages", () => {
    expect(isRole("director")).toBe(true);
    expect(isPageForRole("student", "calendar")).toBe(true);
    expect(isPageForRole("student", "audit")).toBe(false);
  });
});

describe("restricted student access", () => {
  it("keeps profile, dashboard, payments and messages", () => {
    expect(isStudentRestrictedAllowedPage("dashboard")).toBe(true);
    expect(isStudentRestrictedAllowedPage("profile")).toBe(true);
    expect(isStudentRestrictedAllowedPage("payments")).toBe(true);
    expect(isStudentRestrictedAllowedPage("messages")).toBe(true);
  });

  it("blocks academic modules but keeps professional resources", () => {
    expect(isStudentRestrictedAllowedPage("courses")).toBe(false);
    expect(isStudentRestrictedAllowedPage("materials")).toBe(true);
    expect(isStudentRestrictedAllowedPage("assignments")).toBe(false);
    expect(isStudentRestrictedAllowedPage("exams")).toBe(false);
    expect(isStudentRestrictedAllowedPage("live")).toBe(false);
    expect(isStudentRestrictedAllowedPage("progress")).toBe(false);
    expect(STUDENT_RESTRICTED_MESSAGE).toContain("restreint");
  });
});

describe("pending student access", () => {
  it("allows only dashboard and profile", () => {
    expect(isStudentPendingAllowedPage("dashboard")).toBe(true);
    expect(isStudentPendingAllowedPage("profile")).toBe(true);
    expect(isStudentPendingAllowedPage("payments")).toBe(false);
    expect(isStudentPendingAllowedPage("live")).toBe(false);
    expect(STUDENT_PENDING_MESSAGE).toContain("attente");
  });
});
