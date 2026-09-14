import { describe, expect, it } from "vitest";
import {
  mapClass,
  mapStudent,
  mapTeacher,
  toLevel,
  toUiSubscription,
  type ClassRow,
  type StudentRow,
  type TeacherRow,
} from "@/lib/academy-mappers";

describe("academy-mappers", () => {
  it("maps student rows with profile and enrollment", () => {
    const row: StudentRow = {
      id: "stu-1",
      student_code: "S-1",
      level_code: "A2",
      status: "active",
      notes: null,
      profile: {
        id: "p1",
        first_name: "Ahmed",
        last_name: "Benali",
        email: "ahmed@demo.ma",
      },
      enrollments: [
        {
          id: "e1",
          status: "active",
          class: {
            id: "c1",
            name: "A2 Group 2",
            schedule_label: "Tue/Thu",
            level: { code: "A2" },
          },
        },
      ],
      student_subscriptions: { status: "past_due" },
    };

    const student = mapStudent(row);
    expect(student.name).toBe("Ahmed Benali");
    expect(student.level).toBe("A2");
    expect(student.className).toBe("A2 Group 2");
    expect(student.subscription).toBe("PAST_DUE");
  });

  it("maps teacher specialties and classes", () => {
    const row: TeacherRow = {
      id: "t1",
      employee_code: "T-01",
      specialties: ["Conversation"],
      status: "active",
      bio: null,
      profile: {
        id: "p2",
        first_name: "Anna",
        last_name: "Schneider",
        email: "anna@demo.ma",
      },
      classes: [
        { id: "c1", name: "A2-G2", status: "active" },
        { id: "c2", name: "Old", status: "archived" },
      ],
    };

    const teacher = mapTeacher(row);
    expect(teacher.name).toBe("Anna Schneider");
    expect(teacher.subject).toBe("Conversation");
    expect(teacher.classes).toEqual(["A2-G2"]);
  });

  it("maps class size from active enrollments", () => {
    const row: ClassRow = {
      id: "c1",
      name: "B1 Group 1",
      capacity: 20,
      status: "active",
      room: "Room 3",
      schedule_label: "Mon/Wed",
      level: { id: "l1", code: "B1", name: "B1" },
      teacher: {
        id: "t1",
        profile: {
          id: "p2",
          first_name: "Anna",
          last_name: "Schneider",
          email: null,
        },
      },
      enrollments: [
        { id: "e1", status: "active" },
        { id: "e2", status: "withdrawn" },
        { id: "e3", status: "active" },
      ],
    };

    const klass = mapClass(row);
    expect(klass.level).toBe("B1");
    expect(klass.teacher).toBe("Anna Schneider");
    expect(klass.size).toBe(2);
    expect(klass.room).toBe("Room 3");
  });

  it("normalizes levels and subscriptions", () => {
    expect(toLevel("B2")).toBe("B2");
    expect(toLevel("Z9")).toBe("A1");
    expect(toUiSubscription("suspended")).toBe("SUSPENDED");
    expect(toUiSubscription("active")).toBe("ACTIVE");
  });
});
