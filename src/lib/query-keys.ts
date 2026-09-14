export const queryKeys = {
  students: {
    all: ["students"] as const,
    detail: (id: string) => ["students", id] as const,
    search: (q: string) => ["students", "search", q] as const,
  },
  teachers: {
    all: ["teachers"] as const,
    detail: (id: string) => ["teachers", id] as const,
  },
  classes: {
    all: ["classes"] as const,
    detail: (id: string) => ["classes", id] as const,
    roster: (id: string) => ["classes", id, "roster"] as const,
  },
  enrollments: {
    all: ["enrollments"] as const,
    byStudent: (studentId: string) => ["enrollments", "student", studentId] as const,
    byClass: (classId: string) => ["enrollments", "class", classId] as const,
  },
};
