import { describe, expect, it } from "vitest";
import {
  calendarFilterVisibility,
  filterClassesByLevelCode,
  pickStudentCalendarClass,
  resolveCalendarTeacherId,
  sessionBelongsToEnrolledClasses,
  studentCalendarContextLabel,
  studentScopeClassId,
} from "./live-calendar-scope";

describe("calendar filter visibility by role", () => {
  it("hides Niveau/Groupe/Professeur for students and keeps Statut", () => {
    expect(calendarFilterVisibility("student")).toEqual({
      level: false,
      group: false,
      teacher: false,
      status: true,
    });
  });

  it("keeps Niveau/Groupe/Statut for teachers and hides Professeur", () => {
    expect(calendarFilterVisibility("teacher")).toEqual({
      level: true,
      group: true,
      teacher: false,
      status: true,
    });
  });

  it("keeps every filter for admin/director", () => {
    expect(calendarFilterVisibility("director")).toEqual({
      level: true,
      group: true,
      teacher: true,
      status: true,
    });
  });
});

describe("student session scope", () => {
  it("scopes the query to the single enrolled group", () => {
    expect(studentScopeClassId(["class-a"])).toBe("class-a");
    expect(studentScopeClassId(["class-a", "class-b"])).toBeUndefined();
  });

  it("rejects sessions from other groups even if they leaked into the payload", () => {
    const mine = new Set(["class-a"]);
    expect(sessionBelongsToEnrolledClasses("class-a", mine)).toBe(true);
    expect(sessionBelongsToEnrolledClasses("class-other", mine)).toBe(false);
    expect(sessionBelongsToEnrolledClasses(null, mine)).toBe(false);
  });

  it("prefers the active group for the read-only context chip", () => {
    const picked = pickStudentCalendarClass([
      { id: "old", status: "completed" },
      { id: "live", status: "active" },
    ]);
    expect(picked?.id).toBe("live");
  });

  it("formats [level] [group] • teacher without using filter widgets", () => {
    expect(
      studentCalendarContextLabel({
        level: "A1",
        name: "A1 Group",
        reference: "A1-AUG-2026-c100",
        teacher: "Walid Benkirane",
      }),
    ).toEqual({
      level: "A1",
      group: "A1-AUG-2026-c100",
      teacher: "Walid Benkirane",
    });
  });
});

describe("admin Niveau → Groupes", () => {
  it("keeps only groups of the selected level", () => {
    const groups = [
      { id: "1", level: "A1", name: "A1-AUG" },
      { id: "2", level: "A1", name: "A1-SEP" },
      { id: "3", level: "B1", name: "B1-AUG" },
    ];
    expect(filterClassesByLevelCode(groups, "A1").map((g) => g.id)).toEqual(["1", "2"]);
    expect(filterClassesByLevelCode(groups, "").map((g) => g.id)).toEqual(["1", "2", "3"]);
  });
});

describe("teacher identity for session edit", () => {
  it("uses the assigned class teacher id", () => {
    expect(
      resolveCalendarTeacherId("teacher", [{ teacherId: "t-1" }], [], {
        profileId: "p-1",
        email: "walid@gla.academy",
      }),
    ).toBe("t-1");
  });

  it("does not resolve a teacher id for students", () => {
    expect(
      resolveCalendarTeacherId("student", [{ teacherId: "t-1" }], [], {
        profileId: "p-1",
        email: "etudiant01@gla.academy",
      }),
    ).toBeNull();
  });
});
