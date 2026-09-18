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
    schedules: (id: string) => ["classes", id, "schedules"] as const,
  },
  enrollments: {
    all: ["enrollments"] as const,
    byStudent: (studentId: string) => ["enrollments", "student", studentId] as const,
    byClass: (classId: string) => ["enrollments", "class", classId] as const,
  },
  courses: {
    all: ["courses"] as const,
    modules: ["courses", "modules"] as const,
    lessons: ["courses", "lessons"] as const,
  },
  library: {
    all: ["library"] as const,
  },
  conversations: {
    all: ["conversations"] as const,
    messages: (id: string) => ["conversations", id, "messages"] as const,
    members: (id: string) => ["conversations", id, "members"] as const,
  },
  profiles: {
    pending: ["profiles", "pending"] as const,
  },
  liveSessionParticipants: {
    bySession: (id: string) => ["live-session-participants", id] as const,
  },
  assignments: {
    all: ["assignments"] as const,
    byClass: (classId: string) => ["assignments", "class", classId] as const,
  },
  exams: {
    all: ["exams"] as const,
    published: ["exams", "published"] as const,
    detail: (id: string) => ["exams", id] as const,
    attempt: (id: string) => ["exams", "attempt", id] as const,
    answers: (attemptId: string) => ["exams", "answers", attemptId] as const,
    result: (attemptId: string) => ["exams", "result", attemptId] as const,
    myAttempts: ["exams", "my-attempts"] as const,
    allAttempts: ["exams", "all-attempts"] as const,
  },
  payments: {
    all: ["payments"] as const,
    byStudent: (studentId: string) => ["payments", "student", studentId] as const,
  },
  paymentProofs: {
    all: ["payment-proofs"] as const,
    byStudent: (studentId: string) => ["payment-proofs", "student", studentId] as const,
    pending: ["payment-proofs", "pending"] as const,
  },
  subscriptions: {
    all: ["subscriptions"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unread: ["notifications", "unread"] as const,
  },
  recordings: {
    all: ["recordings"] as const,
    provider: ["recordings", "provider"] as const,
  },
  liveSessions: {
    all: ["live-sessions"] as const,
    detail: (id: string) => ["live-sessions", id] as const,
  },
  access: {
    me: ["access", "me"] as const,
  },
  branding: {
    settings: ["branding", "settings"] as const,
  },
};
