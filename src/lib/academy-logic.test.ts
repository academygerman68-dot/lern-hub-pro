import { describe, expect, it } from "vitest";
import { authenticate, isPageForRole, isRole, scoreExam } from "./academy-logic";

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
