import { SupabaseAssignmentService } from "@/services/supabase/assignment-service";
import { SupabaseAttendanceService } from "@/services/supabase/attendance-service";
import { SupabaseCurriculumService } from "@/services/supabase/curriculum-service";
import { SupabaseExamService } from "@/services/supabase/exam-service";
import { SupabaseLibraryService } from "@/services/supabase/library-service";
import { SupabaseEnrollmentService } from "@/services/supabase/enrollment-service";
import { SupabaseStudentService } from "@/services/supabase/student-service";
import { SupabaseTeacherService } from "@/services/supabase/teacher-service";
import { SupabaseClassService } from "@/services/supabase/class-service";
import { SupabaseAuthService } from "@/services/supabase/auth-service";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { authenticate } from "@/lib/academy-logic";
import {
  assignments as mockAssignments,
  modules as mockModules,
  resources as mockResources,
  students as mockStudents,
  teachers as mockTeachers,
  classes as mockClasses,
} from "@/data/mock-data";
import type { Role, SessionUser, SubscriptionStatus, AssignmentListItem } from "@/types/academy";
import type { Database, Json } from "@/types/database";

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

/** Curriculum + library are Supabase-backed when configured. */
export const CourseService = {
  async listModules() {
    if (isSupabaseConfigured) return SupabaseCurriculumService.listPublishedModules();
    await wait(200);
    return mockModules;
  },
  async listCourses() {
    if (isSupabaseConfigured) return SupabaseCurriculumService.listCourses();
    await wait(200);
    return [];
  },
  async listLessons() {
    if (isSupabaseConfigured) return SupabaseCurriculumService.listLessons();
    await wait(160);
    return [];
  },
  async getLesson(id: string) {
    if (isSupabaseConfigured) return SupabaseCurriculumService.getLesson(id);
    return null;
  },
  async createCourse(input: { levelId: string; title: string; description?: string }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseCurriculumService.createCourse(input);
  },
  async createLesson(input: {
    courseId?: string;
    unitId?: string;
    title: string;
    description?: string;
    contentMarkdown?: string;
  }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    let unitId = input.unitId;
    if (!unitId && input.courseId) {
      unitId = await SupabaseCurriculumService.ensureDefaultUnitForCourse(input.courseId);
    }
    if (!unitId) throw new Error("UNIT_REQUIRED");
    return SupabaseCurriculumService.createLesson({
      unitId,
      title: input.title,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.contentMarkdown !== undefined ? { contentMarkdown: input.contentMarkdown } : {}),
    });
  },
  async publishLesson(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseCurriculumService.publishLesson(id);
  },
  async updateLesson(
    id: string,
    patch: { title?: string; description?: string | null; content_markdown?: string | null; status?: Database["public"]["Enums"]["content_status"] },
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseCurriculumService.updateLesson(id, patch);
  },
  async listResources() {
    if (isSupabaseConfigured) {
      const items = await SupabaseLibraryService.list();
      return items.map((item) => ({
        id: item.id,
        title: item.title,
        level: item.level_code ?? "—",
        type: (item.category === "audio"
          ? "Audio"
          : item.category === "video"
            ? "Video"
            : item.category === "pdf" || item.category === "book"
              ? "PDF"
              : "Exercise") as "PDF" | "Audio" | "Video" | "Exercise",
        date: item.created_at.slice(0, 10),
        size: item.file_size ? `${Math.max(1, Math.round(item.file_size / 1024))} KB` : "—",
        storage_path: item.storage_path,
        storage_bucket: item.storage_bucket,
      }));
    }
    await wait(160);
    return mockResources;
  },
};

export const LibraryService = {
  async list() {
    if (!isSupabaseConfigured) return [];
    return SupabaseLibraryService.list();
  },
  async uploadAndCreate(input: Parameters<typeof SupabaseLibraryService.uploadAndCreate>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLibraryService.uploadAndCreate(input);
  },
  async getSignedUrl(item: { storage_bucket: string; storage_path: string }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLibraryService.getSignedUrl(item);
  },
};

export const AssignmentService = {
  async list(classId?: string): Promise<AssignmentListItem[]> {
    if (isSupabaseConfigured) {
      const rows = await SupabaseAssignmentService.list(classId);
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        due: row.due_at ? new Date(row.due_at).toLocaleString() : "—",
        status: row.status === "published" ? "Open" : row.status,
        classId: row.class_id,
        description: row.description,
      }));
    }
    await wait(180);
    return mockAssignments.map((row) => ({
      id: row.id,
      title: row.title,
      due: row.deadline,
      status: row.status,
      studentId: row.studentId,
      studentName: row.studentName,
      grade: row.grade,
      description: null,
    }));
  },
  async create(input: Parameters<typeof SupabaseAssignmentService.create>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAssignmentService.create(input);
  },
  async publish(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAssignmentService.publish(id);
  },
  async submit(input: Parameters<typeof SupabaseAssignmentService.upsertSubmission>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAssignmentService.upsertSubmission(input);
  },
  async grade(input: Parameters<typeof SupabaseAssignmentService.grade>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAssignmentService.grade(input);
  },
  async listSubmissions(assignmentId: string) {
    if (!isSupabaseConfigured) return [];
    return SupabaseAssignmentService.listSubmissions(assignmentId);
  },
};

export const AttendanceService = {
  async openSession(input: Parameters<typeof SupabaseAttendanceService.openSession>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAttendanceService.openSession(input);
  },
  async saveRecords(
    sessionId: string,
    records: Array<{ studentId: string; mark: Database["public"]["Enums"]["attendance_mark"]; note?: string }>,
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAttendanceService.saveRecords(sessionId, records);
  },
  async listSessions(classId: string) {
    if (!isSupabaseConfigured) return [];
    return SupabaseAttendanceService.listSessions(classId);
  },
};

export const ExamService = {
  async listPublished() {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.listPublished();
  },
  async listAll() {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.listAll();
  },
  async getExam(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.getExam(id);
  },
  async startAttempt(examId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.startAttempt(examId);
  },
  async getAttempt(attemptId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.getAttempt(attemptId);
  },
  async listAnswers(attemptId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.listAnswers(attemptId);
  },
  async saveAnswer(input: {
    attemptId: string;
    questionId: string;
    answer: Json;
    flagged?: boolean;
  }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.saveAnswer(input);
  },
  async submitAttempt(attemptId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.submitAttempt(attemptId);
  },
  async getResult(attemptId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.getResult(attemptId);
  },
  async listMyAttempts(examId?: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.listMyAttempts(examId);
  },
  async createExam(input: Parameters<typeof SupabaseExamService.createExam>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.createExam(input);
  },
  async publishExam(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.publishExam(id);
  },
  async archiveExam(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.archiveExam(id);
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
