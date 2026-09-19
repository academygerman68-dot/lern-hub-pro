import { SupabaseAssignmentService } from "@/services/supabase/assignment-service";
import { SupabaseCurriculumService } from "@/services/supabase/curriculum-service";
import { SupabaseExamService } from "@/services/supabase/exam-service";
import { SupabaseLibraryService } from "@/services/supabase/library-service";
import { SupabaseEnrollmentService } from "@/services/supabase/enrollment-service";
import { SupabaseClassScheduleService } from "@/services/supabase/class-schedule-service";
import { SupabaseStudentService } from "@/services/supabase/student-service";
import { SupabaseTeacherService } from "@/services/supabase/teacher-service";
import { SupabaseClassService } from "@/services/supabase/class-service";
import {
  SupabaseAccessService,
  SupabasePaymentService,
  SupabaseSubscriptionService,
} from "@/services/supabase/payment-service";
import { SupabaseNotificationService } from "@/services/supabase/notification-service";
import { SupabaseLiveSessionService } from "@/services/supabase/live-session-service";
import { AuthError, SupabaseAuthService } from "@/services/supabase/auth-service";
import { SupabaseProfileService } from "@/services/supabase/profile-service";
import { isDemoAuthAllowed } from "@/lib/auth-config";
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
import type {
  AccountStatus,
  Role,
  SessionUser,
  SubscriptionStatus,
  AssignmentListItem,
} from "@/types/academy";
import type { Database, Json } from "@/types/database";

const wait = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));

type RecordStatus = Database["public"]["Enums"]["record_status"];
type ClassStatus = Database["public"]["Enums"]["class_status"];
type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];

/**
 * Auth: Supabase Auth is the sole identity source on the normal app path.
 * Demo authenticate() only runs when explicitly enabled for local UI prototyping.
 */
export const AuthService = {
  async login(email: string, password: string): Promise<SessionUser> {
    if (isSupabaseConfigured) {
      const payload = await SupabaseAuthService.login(email, password);
      return payload.sessionUser;
    }
    if (!isDemoAuthAllowed(isSupabaseConfigured)) {
      throw new AuthError("SUPABASE_REQUIRED", "SUPABASE_REQUIRED");
    }
    await wait(350);
    const user = authenticate(email, password);
    if (!user) throw new AuthError("INVALID_CREDENTIALS");
    return user;
  },
  async demoLogin(role: Role): Promise<SessionUser> {
    if (!isDemoAuthAllowed(isSupabaseConfigured)) {
      throw new AuthError("DEMO_AUTH_DISABLED", "DEMO_AUTH_DISABLED");
    }
    await wait();
    const email =
      role === "student" ? "ahmed@demo.ma" : role === "teacher" ? "anna@demo.ma" : "samira@demo.ma";
    const user = authenticate(email, "password");
    if (!user) throw new AuthError("INVALID_CREDENTIALS");
    return user;
  },
  async signUp(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<SessionUser | { needsEmailConfirmation: true; email: string }> {
    if (!isSupabaseConfigured) {
      throw new AuthError("SIGNUP_UNAVAILABLE", "SIGNUP_UNAVAILABLE");
    }
    const result = await SupabaseAuthService.signUp(input);
    if ("needsEmailConfirmation" in result) return result;
    return result.sessionUser;
  },
  async signInWithGoogle(): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new AuthError("GOOGLE_AUTH_UNAVAILABLE", "GOOGLE_AUTH_UNAVAILABLE");
    }
    await SupabaseAuthService.signInWithGoogle();
  },
  async logout(): Promise<void> {
    if (isSupabaseConfigured) {
      await SupabaseAuthService.logout();
    }
  },
  async requestReset(email: string) {
    if (!isSupabaseConfigured) {
      throw new AuthError("RESET_UNAVAILABLE", "RESET_UNAVAILABLE");
    }
    return SupabaseAuthService.requestPasswordReset(email);
  },
  async updatePassword(newPassword: string) {
    if (!isSupabaseConfigured) {
      throw new AuthError("RESET_UNAVAILABLE", "RESET_UNAVAILABLE");
    }
    await SupabaseAuthService.updatePassword(newPassword);
  },
  async resendConfirmation(email: string) {
    if (!isSupabaseConfigured) {
      throw new AuthError("SIGNUP_UNAVAILABLE", "SIGNUP_UNAVAILABLE");
    }
    await SupabaseAuthService.resendSignupConfirmation(email);
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
  async setProfileStatus(profileId: string, status: AccountStatus) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseProfileService.setProfileStatus(profileId, status);
  },
};

export const ProfileService = {
  async listPendingProfiles() {
    if (!isSupabaseConfigured) return [];
    return SupabaseProfileService.listPendingProfiles();
  },
  async getById(profileId: string) {
    if (!isSupabaseConfigured) return null;
    return SupabaseProfileService.getById(profileId);
  },
  async setProfileStatus(profileId: string, status: AccountStatus) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseProfileService.setProfileStatus(profileId, status);
  },
  async setStatus(profileId: string, status: AccountStatus) {
    return this.setProfileStatus(profileId, status);
  },
  async updateMyProfile(input: { firstName: string; lastName: string; phone?: string | null }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseProfileService.updateMyProfile(input);
  },
  async adminUpdateProfile(
    profileId: string,
    input: {
      firstName: string;
      lastName: string;
      phone?: string | null;
      avatarUrl?: string | null;
      clearAvatar?: boolean;
    },
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseProfileService.adminUpdateProfile(profileId, input);
  },
  async uploadAvatar(profileId: string, file: File) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseProfileService.uploadAvatar(profileId, file);
  },
  async removeAvatar(profileId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseProfileService.removeAvatar(profileId);
  },
  async getAvatarSignedUrl(avatarUrl: string | null | undefined) {
    if (!isSupabaseConfigured || !avatarUrl) return null;
    return SupabaseProfileService.getAvatarSignedUrl(avatarUrl);
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
  async createViaSignup(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    specialties?: string[];
  }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseTeacherService.createViaSignup(input);
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
      reference: null,
      status: "active" as ClassStatus,
      capacity: 20,
      teacherId: null,
      levelId: null,
      startDate: null,
      endDate: null,
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
      reference: null,
      status: "active" as ClassStatus,
      capacity: 20,
      teacherId: null,
      levelId: null,
      startDate: null,
      endDate: null,
    };
  },
  async create(input: {
    name: string;
    levelId: string;
    reference?: string | null;
    teacherId?: string | null;
    capacity?: number;
    room?: string | null;
    scheduleLabel?: string | null;
    status?: ClassStatus;
    startDate?: string | null;
    endDate?: string | null;
  }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseClassService.create(input);
  },
  async update(
    id: string,
    patch: {
      name?: string;
      level_id?: string;
      reference?: string | null;
      teacher_id?: string | null;
      capacity?: number;
      room?: string | null;
      schedule_label?: string | null;
      status?: ClassStatus;
      start_date?: string | null;
      end_date?: string | null;
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

export const ClassScheduleService = {
  async listByClass(classId: string) {
    if (!isSupabaseConfigured) return [];
    return SupabaseClassScheduleService.listByClass(classId);
  },
  async replaceForClass(input: Parameters<typeof SupabaseClassScheduleService.replaceForClass>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseClassScheduleService.replaceForClass(input);
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
  async createCourse(input: {
    levelId: string;
    title: string;
    description?: string;
    contentKind?: Database["public"]["Enums"]["course_content_kind"];
    contentUrl?: string | null;
    storageBucket?: string | null;
    storagePath?: string | null;
    mimeType?: string | null;
    status?: Database["public"]["Enums"]["content_status"];
  }) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseCurriculumService.createCourse(input);
  },
  async updateCourse(id: string, patch: Database["public"]["Tables"]["courses"]["Update"]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseCurriculumService.updateCourse(id, patch);
  },
  async archiveCourse(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseCurriculumService.archiveCourse(id);
  },
  async deleteCourse(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseCurriculumService.deleteCourse(id);
  },
  async uploadCourseMaterial(file: File, folder = "courses") {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseCurriculumService.uploadCourseMaterial(file, folder);
  },
  async getCourseMaterialUrl(
    course: Parameters<typeof SupabaseCurriculumService.getCourseMaterialUrl>[0],
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseCurriculumService.getCourseMaterialUrl(course);
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
    patch: {
      title?: string;
      description?: string | null;
      content_markdown?: string | null;
      status?: Database["public"]["Enums"]["content_status"];
    },
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
        mime_type: item.mime_type,
      }));
    }
    await wait(160);
    if (!isDemoAuthAllowed(isSupabaseConfigured)) return [];
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
  async update(id: string, patch: Parameters<typeof SupabaseLibraryService.update>[1]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLibraryService.update(id, patch);
  },
  async replaceFile(id: string, file: File) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLibraryService.replaceFile(id, file);
  },
  async getSignedUrl(item: Parameters<typeof SupabaseLibraryService.getSignedUrl>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLibraryService.getSignedUrl(item);
  },
  async archive(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLibraryService.archive(id);
  },
};

export const AssignmentService = {
  async list(classId?: string): Promise<AssignmentListItem[]> {
    if (isSupabaseConfigured) {
      const rows = await SupabaseAssignmentService.list(classId);
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        due: row.due_at ? new Date(row.due_at).toLocaleString("fr-FR") : "—",
        dueAt: row.due_at,
        status:
          row.status === "published" ? "Publié" : row.status === "draft" ? "Brouillon" : row.status,
        ...(row.class_id ? { classId: row.class_id } : {}),
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
  async update(id: string, patch: Parameters<typeof SupabaseAssignmentService.update>[1]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAssignmentService.update(id, patch);
  },
  async uploadAttachment(file: File) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAssignmentService.uploadAttachment(file);
  },
  async getAttachmentUrl(row: Parameters<typeof SupabaseAssignmentService.getAttachmentUrl>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAssignmentService.getAttachmentUrl(row);
  },
  async archive(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAssignmentService.archive(id);
  },
  async publish(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAssignmentService.publish(id);
  },
  async submit(input: Parameters<typeof SupabaseAssignmentService.upsertSubmission>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAssignmentService.upsertSubmission(input);
  },
  async getSubmissionFileUrl(
    submission: Parameters<typeof SupabaseAssignmentService.getSubmissionFileUrl>[0],
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseAssignmentService.getSubmissionFileUrl(submission);
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
  async gradeWritingAnswer(input: Parameters<typeof SupabaseExamService.gradeWritingAnswer>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.gradeWritingAnswer(input);
  },
  async listAttemptsForExam(examId: string) {
    if (!isSupabaseConfigured) return [];
    return SupabaseExamService.listAttemptsForExam(examId);
  },
  async getResult(attemptId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.getResult(attemptId);
  },
  async listMyAttempts(examId?: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.listMyAttempts(examId);
  },
  async listAllAttempts() {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.listAllAttempts();
  },
  async createExam(input: Parameters<typeof SupabaseExamService.createExam>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.createExam(input);
  },
  async uploadExamMaterial(file: File) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.uploadExamMaterial(file);
  },
  async getExamMaterialUrl(exam: Parameters<typeof SupabaseExamService.getExamMaterialUrl>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.getExamMaterialUrl(exam);
  },
  async publishExam(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.publishExam(id);
  },
  async archiveExam(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.archiveExam(id);
  },
  async listExamStructure(examId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.listExamStructure(examId);
  },
  async createSection(input: Parameters<typeof SupabaseExamService.createSection>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.createSection(input);
  },
  async createQuestion(input: Parameters<typeof SupabaseExamService.createQuestion>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.createQuestion(input);
  },
  async createOptions(
    questionId: string,
    options: Parameters<typeof SupabaseExamService.createOptions>[1],
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.createOptions(questionId, options);
  },
  async setAnswerKey(questionId: string, correctValues: string[]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.setAnswerKey(questionId, correctValues);
  },
  async syncSectionMaxScore(sectionId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.syncSectionMaxScore(sectionId);
  },
  async deleteQuestion(questionId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.deleteQuestion(questionId);
  },
  async deleteSection(sectionId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseExamService.deleteSection(sectionId);
  },
};

export const PaymentService = {
  async list(filters?: Parameters<typeof SupabasePaymentService.list>[0]) {
    if (!isSupabaseConfigured) return [];
    return SupabasePaymentService.list(filters);
  },
  async listForStudent(studentId: string) {
    if (!isSupabaseConfigured) return [];
    return SupabasePaymentService.listForStudent(studentId);
  },
  async create(input: Parameters<typeof SupabasePaymentService.create>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabasePaymentService.create(input);
  },
  async uploadAdminReceipt(paymentId: string, file: File) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabasePaymentService.uploadAdminReceipt(paymentId, file);
  },
  async deleteAdminReceipt(paymentId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabasePaymentService.deleteAdminReceipt(paymentId);
  },
  async getAdminReceiptSignedUrl(
    payment: Parameters<typeof SupabasePaymentService.getAdminReceiptSignedUrl>[0],
    expiresIn?: number,
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabasePaymentService.getAdminReceiptSignedUrl(payment, expiresIn);
  },
  async markPaid(paymentId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabasePaymentService.markPaid(paymentId);
  },
  async markOverdue(paymentId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabasePaymentService.markOverdue(paymentId);
  },
  async remindStudent(paymentId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabasePaymentService.remindStudent(paymentId);
  },
  /** Legacy renew button — does not fake activation. Use payment proofs or admin markPaid. */
  async pay(): Promise<never> {
    throw new Error(
      "Paiement fictif désactivé. Déposez un avis d’opération ou contactez l’administration.",
    );
  },
};

export { SupabasePaymentProofService as PaymentProofService } from "@/services/supabase/payment-proof-service";
export { SupabaseRecordingService as RecordingService } from "@/services/supabase/recording-service";
export { OutboxService } from "@/services/messaging/outbox-service";
export { SupabaseMessagingService as MessagingService } from "@/services/supabase/messaging-service";

export const SubscriptionService = {
  async list() {
    if (!isSupabaseConfigured) return [];
    return SupabaseSubscriptionService.list();
  },
  async getByStudent(studentId: string) {
    if (!isSupabaseConfigured) return null;
    return SupabaseSubscriptionService.getByStudent(studentId);
  },
  async ensure(studentId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseSubscriptionService.ensure(studentId);
  },
  async setStatus(
    studentId: string,
    status: Parameters<typeof SupabaseSubscriptionService.setStatus>[1],
    extras?: Parameters<typeof SupabaseSubscriptionService.setStatus>[2],
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseSubscriptionService.setStatus(studentId, status, extras);
  },
};

export const AccessService = {
  async hasActiveAcademicAccess(userId?: string) {
    if (!isSupabaseConfigured) return true;
    return SupabaseAccessService.hasActiveAcademicAccess(userId);
  },
  async hasAcademicAccess(studentId: string) {
    if (!isSupabaseConfigured) return true;
    return SupabaseAccessService.hasAcademicAccess(studentId);
  },
  async recordFirstLogin() {
    if (!isSupabaseConfigured) return null;
    return SupabaseAccessService.recordFirstLogin();
  },
};

export const NotificationService = {
  async listMine(limit?: number) {
    if (!isSupabaseConfigured) return [];
    return SupabaseNotificationService.listMine(limit);
  },
  async unreadCount() {
    if (!isSupabaseConfigured) return 0;
    return SupabaseNotificationService.unreadCount();
  },
  async markRead(id: string) {
    if (!isSupabaseConfigured) return null;
    return SupabaseNotificationService.markRead(id);
  },
  async markAllRead() {
    if (!isSupabaseConfigured) return true;
    return SupabaseNotificationService.markAllRead();
  },
  async create(input: Parameters<typeof SupabaseNotificationService.create>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseNotificationService.create(input);
  },
};

export const LiveSessionService = {
  async list(filters?: Parameters<typeof SupabaseLiveSessionService.list>[0]) {
    if (!isSupabaseConfigured) return [];
    return SupabaseLiveSessionService.list(filters);
  },
  async get(id: string) {
    if (!isSupabaseConfigured) return null;
    return SupabaseLiveSessionService.get(id);
  },
  async joinTarget(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLiveSessionService.joinTarget(id);
  },
  async create(input: Parameters<typeof SupabaseLiveSessionService.create>[0]) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLiveSessionService.create(input);
  },
  async updateStatus(
    id: string,
    status: Parameters<typeof SupabaseLiveSessionService.updateStatus>[1],
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLiveSessionService.updateStatus(id, status);
  },
  async updateSchedule(
    id: string,
    input: Parameters<typeof SupabaseLiveSessionService.updateSchedule>[1],
  ) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLiveSessionService.updateSchedule(id, input);
  },
  async createEmergencyZoom(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLiveSessionService.createEmergencyZoom(id);
  },
  async revertToJitsi(id: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLiveSessionService.revertToJitsi(id);
  },
  async generateMonthSessions(classId: string, year: number, month: number) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLiveSessionService.generateMonthSessions(classId, year, month);
  },
  async listParticipants(sessionId: string) {
    if (!isSupabaseConfigured) return [];
    return SupabaseLiveSessionService.listParticipants(sessionId);
  },
  async addParticipant(sessionId: string, profileId: string, addedBy?: string | null) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLiveSessionService.addParticipant(sessionId, profileId, addedBy);
  },
  async removeParticipant(sessionId: string, profileId: string) {
    if (!isSupabaseConfigured) throw new Error("SUPABASE_REQUIRED");
    return SupabaseLiveSessionService.removeParticipant(sessionId, profileId);
  },
};
