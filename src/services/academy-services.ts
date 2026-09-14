import {
  students as mockStudents,
  teachers as mockTeachers,
  classes as mockClasses,
  assignments,
  exams,
  modules,
  resources,
} from "@/data/mock-data";
import { authenticate, scoreExam } from "@/lib/academy-logic";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseAuthService } from "@/services/supabase/auth-service";
import { SupabaseClassService } from "@/services/supabase/class-service";
import { SupabaseEnrollmentService } from "@/services/supabase/enrollment-service";
import { SupabaseStudentService } from "@/services/supabase/student-service";
import { SupabaseTeacherService } from "@/services/supabase/teacher-service";
import { getSupabase } from "@/lib/supabase";
import type { ExamScore, Role, SessionUser, SubscriptionStatus } from "@/types/academy";
import type { Database } from "@/types/database";

const wait = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));

type RecordStatus = Database["public"]["Enums"]["record_status"];
type ClassStatus = Database["public"]["Enums"]["class_status"];
type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];

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

export const StudentService = {
  async list(filters?: { status?: RecordStatus; search?: string }) {
    if (isSupabaseConfigured) return SupabaseStudentService.list(filters);
    await wait(200);
    let rows = mockStudents;
    const search = filters?.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.email.toLowerCase().includes(search) ||
          s.className.toLowerCase().includes(search),
      );
    }
    return rows;
  },
  async get(id: string) {
    if (isSupabaseConfigured) return SupabaseStudentService.get(id);
    await wait(120);
    return mockStudents.find((student) => student.id === id) ?? null;
  },
  async search(query: string) {
    return this.list({ search: query });
  },
  async create(input: {
    profileId: string;
    levelCode?: string | null;
    studentCode?: string | null;
    notes?: string | null;
  }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseStudentService.create(input);
  },
  async update(
    id: string,
    patch: {
      level_code?: string | null;
      notes?: string | null;
      student_code?: string | null;
      status?: RecordStatus;
    },
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseStudentService.update(id, patch);
  },
  async archive(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseStudentService.archive(id);
  },
  async suspend(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseStudentService.suspend(id);
  },
  async reactivate(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseStudentService.reactivate(id);
  },
};

export const TeacherService = {
  async list() {
    if (isSupabaseConfigured) return SupabaseTeacherService.list();
    await wait(200);
    return mockTeachers;
  },
  async get(id: string) {
    if (isSupabaseConfigured) return SupabaseTeacherService.get(id);
    await wait(120);
    return mockTeachers.find((t) => t.id === id) ?? null;
  },
  async create(input: {
    profileId: string;
    specialties?: string[];
    employeeCode?: string | null;
    bio?: string | null;
  }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseTeacherService.create(input);
  },
  async update(
    id: string,
    patch: {
      specialties?: string[];
      bio?: string | null;
      employee_code?: string | null;
      status?: RecordStatus;
      hourly_rate?: number | null;
    },
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseTeacherService.update(id, patch);
  },
  async archive(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseTeacherService.archive(id);
  },
  async suspend(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseTeacherService.suspend(id);
  },
  async reactivate(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseTeacherService.reactivate(id);
  },
  async listAssignedClasses(teacherId: string) {
    if (isSupabaseConfigured) return SupabaseTeacherService.listAssignedClasses(teacherId);
    await wait(120);
    const teacher = mockTeachers.find((t) => t.id === teacherId);
    return (teacher?.classes ?? []).map((name) => ({
      id: name,
      name,
      status: "active" as const,
      schedule_label: null,
      room: null,
    }));
  },
};

export const ClassService = {
  async list() {
    if (isSupabaseConfigured) return SupabaseClassService.list();
    await wait(200);
    return mockClasses;
  },
  async listDetailed() {
    if (isSupabaseConfigured) return SupabaseClassService.listDetailed();
    await wait(200);
    return mockClasses.map((item) => ({
      ...item,
      name: item.id,
      status: "active" as ClassStatus,
      capacity: 20,
      teacherId: null,
      levelId: null,
    }));
  },
  async get(id: string) {
    if (isSupabaseConfigured) return SupabaseClassService.get(id);
    await wait(120);
    const item = mockClasses.find((c) => c.id === id);
    if (!item) return null;
    return {
      ...item,
      name: item.id,
      status: "active" as ClassStatus,
      capacity: 20,
      teacherId: null,
      levelId: null,
    };
  },
  async create(input: {
    name: string;
    levelId: string;
    teacherId?: string | null;
    capacity?: number;
    room?: string | null;
    scheduleLabel?: string | null;
    status?: ClassStatus;
  }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseClassService.create(input);
  },
  async update(
    id: string,
    patch: {
      name?: string;
      level_id?: string;
      teacher_id?: string | null;
      capacity?: number;
      room?: string | null;
      schedule_label?: string | null;
      status?: ClassStatus;
    },
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseClassService.update(id, patch);
  },
  async archive(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseClassService.archive(id);
  },
  async listEnrolledStudents(classId: string) {
    if (isSupabaseConfigured) return SupabaseClassService.listEnrolledStudents(classId);
    await wait(120);
    return mockStudents.filter((s) => s.className === classId || s.level === "A2");
  },
  async listLevels() {
    if (!isSupabaseConfigured) {
      await wait(80);
      return [
        { id: "a1", code: "A1", name: "A1" },
        { id: "a2", code: "A2", name: "A2" },
        { id: "b1", code: "B1", name: "B1" },
        { id: "b2", code: "B2", name: "B2" },
      ];
    }
    const { data, error } = await getSupabase()
      .from("levels")
      .select("id, code, name")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
};

export const EnrollmentService = {
  async list() {
    if (isSupabaseConfigured) return SupabaseEnrollmentService.list();
    await wait(150);
    return [];
  },
  async listByStudent(studentId: string) {
    if (isSupabaseConfigured) return SupabaseEnrollmentService.listByStudent(studentId);
    await wait(120);
    return [];
  },
  async listByClass(classId: string) {
    if (isSupabaseConfigured) return SupabaseEnrollmentService.listByClass(classId);
    await wait(120);
    return [];
  },
  async create(input: {
    studentId: string;
    classId: string;
    status?: EnrollmentStatus;
    startDate?: string | null;
  }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseEnrollmentService.create(input);
  },
  async end(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseEnrollmentService.end(id);
  },
  async withdraw(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseEnrollmentService.withdraw(id);
  },
  async suspend(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseEnrollmentService.suspend(id);
  },
};

/** Remaining LMS modules still mock until migrated. */
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
