import { authenticate, scoreExam } from "@/lib/academy-logic";
import { assignments, exams, modules, resources, students } from "@/data/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseAuthService } from "@/services/supabase/auth-service";
import type { ExamScore, Role, SessionUser, SubscriptionStatus } from "@/types/academy";

const wait = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Auth: Supabase Auth is the sole identity source when configured.
 * Mock authenticate() is only used when VITE_SUPABASE_* is missing (local UI without backend).
 */
export const AuthService = {
  async login(email: string, password: string): Promise<SessionUser> {
    if (isSupabaseConfigured) {
      const payload = await SupabaseAuthService.login(email, password);
      return payload.sessionUser;
    }
    await wait(350);
    const user = authenticate(email, password);
    if (!user) throw new Error("INVALID_CREDENTIALS");
    return user;
  },
  async demoLogin(role: Role): Promise<SessionUser> {
    if (isSupabaseConfigured) {
      throw new Error("DEMO_AUTH_DISABLED");
    }
    await wait();
    const email =
      role === "student" ? "ahmed@demo.ma" : role === "teacher" ? "anna@demo.ma" : "samira@demo.ma";
    const user = authenticate(email, "password");
    if (!user) throw new Error("INVALID_CREDENTIALS");
    return user;
  },
  async logout(): Promise<void> {
    if (isSupabaseConfigured) {
      await SupabaseAuthService.logout();
    }
  },
  async requestReset(email: string) {
    if (isSupabaseConfigured) {
      return SupabaseAuthService.requestPasswordReset(email);
    }
    await wait(250);
    return { sent: email.trim().length > 0 };
  },
};

/** DEVELOPMENT ONLY — mock LMS data until domain services are migrated. */
export const StudentService = {
  async list() {
    await wait(200);
    return students;
  },
  async get(id: string) {
    await wait(120);
    return students.find((student) => student.id === id) ?? students[0];
  },
};

export const CourseService = {
  async listModules() {
    await wait(200);
    return modules;
  },
  async listResources() {
    await wait(160);
    return resources;
  },
};

export const AssignmentService = {
  async list() {
    await wait(180);
    return assignments;
  },
};

export const ExamService = {
  async list() {
    await wait(160);
    return exams;
  },
  async submit(answers: Record<number, number>): Promise<ExamScore> {
    await wait(600);
    return scoreExam(answers);
  },
};

export const PaymentService = {
  async pay(): Promise<SubscriptionStatus> {
    await wait(700);
    return "ACTIVE";
  },
};

export const NotificationService = {
  async markAllRead() {
    await wait(150);
    return true;
  },
};
