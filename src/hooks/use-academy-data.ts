import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  AssignmentService,
  AccessService,
  ClassService,
  CourseService,
  ClassScheduleService,
  EnrollmentService,
  ExamService,
  LibraryService,
  LiveSessionService,
  MessagingService,
  NotificationService,
  PaymentService,
  PaymentProofService,
  ProfileService,
  RecordingService,
  StudentService,
  SubscriptionService,
  TeacherService,
  GroupProgressService,
} from "@/services/academy-services";
import { SupabaseAssignmentService } from "@/services/supabase/assignment-service";
import type { Json } from "@/types/database";
import type { Database } from "@/types/database";

type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type LiveSessionStatus = Database["public"]["Enums"]["live_session_status"];

export function useLevels(enabled = true) {
  return useQuery({
    queryKey: ["levels"] as const,
    queryFn: () => ClassService.listLevels(),
    enabled,
  });
}

export function useStudents(search = "") {
  return useQuery({
    queryKey: search ? queryKeys.students.search(search) : queryKeys.students.all,
    queryFn: () => StudentService.list(search ? { search } : undefined),
  });
}

export function useStudent(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.students.detail(id ?? ""),
    queryFn: () => StudentService.get(id!),
    enabled: Boolean(id),
  });
}

export function useTeachers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.teachers.all,
    queryFn: () => TeacherService.list(),
    enabled,
  });
}

export function useTeacher(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.teachers.detail(id ?? ""),
    queryFn: () => TeacherService.get(id!),
    enabled: Boolean(id),
  });
}

export function useClasses() {
  return useQuery({
    queryKey: queryKeys.classes.all,
    queryFn: () => ClassService.listDetailed(),
  });
}

export function useClass(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.classes.detail(id ?? ""),
    queryFn: () => ClassService.get(id!),
    enabled: Boolean(id),
  });
}

export function useClassRoster(classId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.classes.roster(classId ?? ""),
    queryFn: () => ClassService.listEnrolledStudents(classId!),
    enabled: Boolean(classId),
  });
}

export function useEnrollmentsByStudent(studentId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.enrollments.byStudent(studentId ?? ""),
    queryFn: () => EnrollmentService.listByStudent(studentId!),
    enabled: Boolean(studentId),
  });
}

export function useEnrollmentsByClass(classId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.enrollments.byClass(classId ?? ""),
    queryFn: () => EnrollmentService.listByClass(classId!),
    enabled: Boolean(classId),
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ClassService.create,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.classes.all });
    },
  });
}

export function useArchiveClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ClassService.archive(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.classes.all });
    },
  });
}

export function useClassSchedules(classId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.classes.schedules(classId ?? ""),
    queryFn: () => ClassScheduleService.listByClass(classId!),
    enabled: Boolean(classId),
  });
}

export function useReplaceClassSchedules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ClassScheduleService.replaceForClass,
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.classes.schedules(vars.classId) }),
        qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
        qc.invalidateQueries({ queryKey: queryKeys.classes.detail(vars.classId) }),
        qc.invalidateQueries({ queryKey: queryKeys.liveSessions.all }),
      ]);
    },
  });
}

export function useCreateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: EnrollmentService.create,
    onSuccess: async (_data, vars) => {
      // Invalidate all class rosters: student may have been moved from another group.
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.enrollments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.enrollments.byStudent(vars.studentId) }),
        qc.invalidateQueries({ queryKey: queryKeys.enrollments.byClass(vars.classId) }),
        qc.invalidateQueries({ queryKey: queryKeys.classes.roster(vars.classId) }),
        qc.invalidateQueries({ queryKey: ["students"] }),
      ]);
    },
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof ClassService.update>[1] }) =>
      ClassService.update(id, patch),
    onSuccess: async (klass) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
        qc.invalidateQueries({ queryKey: queryKeys.classes.detail(klass.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.teachers.all }),
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
      ]);
    },
  });
}

export function useRemoveEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { enrollmentId: string; classId?: string; studentId?: string }) =>
      EnrollmentService.withdraw(input.enrollmentId),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.enrollments.all }),
        vars.classId
          ? qc.invalidateQueries({ queryKey: queryKeys.enrollments.byClass(vars.classId) })
          : Promise.resolve(),
        vars.studentId
          ? qc.invalidateQueries({ queryKey: queryKeys.enrollments.byStudent(vars.studentId) })
          : Promise.resolve(),
        qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        vars.classId
          ? qc.invalidateQueries({ queryKey: queryKeys.classes.roster(vars.classId) })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useSetProfileStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      status,
    }: {
      profileId: string;
      status: "active" | "pending" | "restricted" | "suspended" | "archived";
    }) => ProfileService.setProfileStatus(profileId, status),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.teachers.all }),
        qc.invalidateQueries({ queryKey: queryKeys.profiles.pending }),
        qc.invalidateQueries({ queryKey: ["students"] }),
        qc.invalidateQueries({ queryKey: ["teachers"] }),
      ]);
    },
  });
}

export function usePendingProfiles() {
  return useQuery({
    queryKey: queryKeys.profiles.pending,
    queryFn: () => ProfileService.listPendingProfiles(),
  });
}

export function useProfile(profileId: string | null | undefined) {
  return useQuery({
    queryKey: profileId ? queryKeys.profiles.detail(profileId) : (["profiles", "none"] as const),
    queryFn: () => ProfileService.getById(profileId!),
    enabled: Boolean(profileId),
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { firstName: string; lastName: string; phone?: string | null }) =>
      ProfileService.updateMyProfile(input),
    onSuccess: async (row) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.profiles.detail(row.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.teachers.all }),
      ]);
    },
  });
}

export function useAdminUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      profileId: string;
      firstName: string;
      lastName: string;
      phone?: string | null;
      avatarUrl?: string | null;
      clearAvatar?: boolean;
    }) =>
      ProfileService.adminUpdateProfile(input.profileId, {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.clearAvatar !== undefined ? { clearAvatar: input.clearAvatar } : {}),
      }),
    onSuccess: async (row) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.profiles.detail(row.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.teachers.all }),
        qc.invalidateQueries({ queryKey: queryKeys.profiles.pending }),
      ]);
    },
  });
}

export function useUploadProfileAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { profileId: string; file: File }) =>
      ProfileService.uploadAvatar(input.profileId, input.file),
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: queryKeys.profiles.detail(row.id) });
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.teachers.all }),
      ]);
    },
  });
}

export function useRemoveProfileAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => ProfileService.removeAvatar(profileId),
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: queryKeys.profiles.detail(row.id) });
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.teachers.all }),
      ]);
    },
  });
}

export function useCreateTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: TeacherService.createViaSignup,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.teachers.all });
    },
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof StudentService.update>[1];
    }) => StudentService.update(id, patch),
    onSuccess: async (student) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.students.detail(student.id) }),
      ]);
    },
  });
}

export function useStudentStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "archive" | "suspend" | "reactivate" }) => {
      if (action === "archive") return StudentService.archive(id);
      if (action === "suspend") return StudentService.suspend(id);
      return StudentService.reactivate(id);
    },
    onSuccess: async (student) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.students.detail(student.id) }),
      ]);
    },
  });
}

export function useCourses() {
  return useQuery({
    queryKey: queryKeys.courses.all,
    queryFn: () => CourseService.listCourses(),
  });
}

export function useCourseModules() {
  return useQuery({
    queryKey: queryKeys.courses.modules,
    queryFn: () => CourseService.listModules(),
  });
}

export function useGroupProgress(classId?: string, levelCode?: string | null) {
  return useQuery({
    queryKey: classId
      ? ([...queryKeys.groupProgress.byClass(classId), levelCode ?? ""] as const)
      : (["group-progress", "none"] as const),
    queryFn: () => GroupProgressService.listForClass(classId!, levelCode ?? null),
    enabled: Boolean(classId),
  });
}

export function useMarkGroupUnitCompleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: GroupProgressService.markCompleted,
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: queryKeys.groupProgress.byClass(vars.classId) });
    },
  });
}

export function useUnlockGroupUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: GroupProgressService.unlockUnit,
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: queryKeys.groupProgress.byClass(vars.classId) });
    },
  });
}

export function useLessons() {
  return useQuery({
    queryKey: queryKeys.courses.lessons,
    queryFn: () => CourseService.listLessons(),
  });
}

export function useLibrary() {
  return useQuery({
    queryKey: queryKeys.library.all,
    queryFn: () => LibraryService.list(),
  });
}

export function useAssignments(classId?: string) {
  return useQuery({
    queryKey: classId ? queryKeys.assignments.byClass(classId) : queryKeys.assignments.all,
    queryFn: () => AssignmentService.list(classId),
  });
}

export function useAssignmentRows(classId?: string) {
  return useQuery({
    queryKey: classId
      ? [...queryKeys.assignments.byClass(classId), "rows"]
      : [...queryKeys.assignments.all, "rows"],
    queryFn: () => SupabaseAssignmentService.list(classId),
  });
}

export function useCreateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: CourseService.createLesson,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.courses.lessons });
      await qc.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
  });
}

export function usePublishLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => CourseService.publishLesson(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.courses.lessons });
      await qc.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: CourseService.createCourse,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof CourseService.updateCourse>[1] }) =>
      CourseService.updateCourse(input.id, input.patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
  });
}

export function useArchiveCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => CourseService.archiveCourse(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => CourseService.deleteCourse(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.courses.all });
      await qc.invalidateQueries({ queryKey: queryKeys.courses.modules });
    },
  });
}

export function useArchiveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => AssignmentService.archive(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.assignments.all });
    },
  });
}

export function useUploadLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: LibraryService.uploadAndCreate,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function useArchiveLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => LibraryService.archive(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: AssignmentService.create,
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: queryKeys.assignments.all });
      if (vars.classId) {
        await qc.invalidateQueries({ queryKey: queryKeys.assignments.byClass(vars.classId) });
      }
    },
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof AssignmentService.update>[1] }) =>
      AssignmentService.update(input.id, input.patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.assignments.all });
    },
  });
}

export function useUpdateLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch?: Parameters<typeof LibraryService.update>[1];
      file?: File | null;
      clearFile?: boolean;
    }) => {
      if (input.file) {
        await LibraryService.replaceFile(input.id, input.file);
      }
      return LibraryService.update(input.id, {
        ...(input.patch ?? {}),
        ...(input.clearFile && !input.file ? { clearFile: true } : {}),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: AssignmentService.submit,
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.assignments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.submissions.all }),
        qc.invalidateQueries({ queryKey: queryKeys.submissions.byAssignment(vars.assignmentId) }),
        qc.invalidateQueries({ queryKey: queryKeys.submissions.byStudent(vars.studentId) }),
        qc.invalidateQueries({ queryKey: queryKeys.corrections.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.unread }),
      ]);
    },
  });
}

export function useGradeAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      submissionId: string;
      score: number;
      feedback?: string;
      gradedBy?: string | null;
      assignmentId?: string;
    }) =>
      AssignmentService.grade({
        submissionId: input.submissionId,
        score: input.score,
        ...(input.feedback !== undefined ? { feedback: input.feedback } : {}),
        ...(input.gradedBy !== undefined ? { gradedBy: input.gradedBy } : {}),
      }),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.assignments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.submissions.all }),
        vars.assignmentId
          ? qc.invalidateQueries({
              queryKey: queryKeys.submissions.byAssignment(vars.assignmentId),
            })
          : Promise.resolve(),
        qc.invalidateQueries({ queryKey: queryKeys.corrections.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.unread }),
      ]);
    },
  });
}

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations.all,
    queryFn: () => MessagingService.listConversations(),
  });
}

export function useConversationMessages(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.conversations.messages(conversationId ?? ""),
    queryFn: () => MessagingService.listMessages(conversationId!),
    enabled: Boolean(conversationId),
    refetchInterval: 8_000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: MessagingService.sendMessage,
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: queryKeys.conversations.messages(vars.conversationId),
        }),
        qc.invalidateQueries({ queryKey: queryKeys.conversations.all }),
      ]);
    },
  });
}

export function useCreateClassConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: MessagingService.createClassConversation,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useAddConversationMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { conversationId: string; profileId: string; role?: string }) =>
      MessagingService.addMember(input.conversationId, input.profileId, input.role ?? "member"),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.conversations.all }),
        qc.invalidateQueries({ queryKey: queryKeys.conversations.members(vars.conversationId) }),
      ]);
    },
  });
}

export function useRemoveConversationMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { conversationId: string; profileId: string }) =>
      MessagingService.removeMember(input.conversationId, input.profileId),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.conversations.all }),
        qc.invalidateQueries({ queryKey: queryKeys.conversations.members(vars.conversationId) }),
      ]);
    },
  });
}

export function usePublishedExams() {
  return useQuery({
    queryKey: queryKeys.exams.published,
    queryFn: () => ExamService.listPublished(),
  });
}

export function useAllExams() {
  return useQuery({
    queryKey: queryKeys.exams.all,
    queryFn: () => ExamService.listAll(),
  });
}

export function useExam(examId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.exams.detail(examId ?? ""),
    queryFn: () => ExamService.getExam(examId!),
    enabled: Boolean(examId),
  });
}

export function useExamAttempt(attemptId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.exams.attempt(attemptId ?? ""),
    queryFn: () => ExamService.getAttempt(attemptId!),
    enabled: Boolean(attemptId),
    refetchInterval: (query) => (query.state.data?.status === "in_progress" ? 15000 : false),
  });
}

export function useExamAnswers(attemptId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.exams.answers(attemptId ?? ""),
    queryFn: () => ExamService.listAnswers(attemptId!),
    enabled: Boolean(attemptId),
  });
}

export function useExamResult(attemptId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.exams.result(attemptId ?? ""),
    queryFn: () => ExamService.getResult(attemptId!),
    enabled: Boolean(attemptId),
  });
}

export function useExamAttemptReview(attemptId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.exams.review(attemptId ?? ""),
    queryFn: () => ExamService.getAttemptReview(attemptId!),
    enabled: Boolean(attemptId),
  });
}

export function useMyExamAttempts() {
  return useQuery({
    queryKey: queryKeys.exams.myAttempts,
    queryFn: () => ExamService.listMyAttempts(),
  });
}

export function useAllExamAttempts() {
  return useQuery({
    queryKey: queryKeys.exams.allAttempts,
    queryFn: () => ExamService.listAllAttempts(),
  });
}

export function useExamAttemptsForExam(examId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.exams.attemptsByExam(examId ?? ""),
    queryFn: () => ExamService.listAttemptsForExam(examId!),
    enabled: Boolean(examId),
  });
}

export function useExamParticipantRoster(examId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.exams.attemptsByExam(examId ?? ""), "roster"] as const,
    queryFn: () => ExamService.listExamParticipantRoster(examId!),
    enabled: Boolean(examId),
  });
}

export function useGradeWritingAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      attemptId: string;
      questionId: string;
      points: number;
      comment?: string | null;
      gradingDetail?: Json | null;
    }) => ExamService.gradeWritingAnswer(input),
    onSuccess: async (attempt) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.exams.attempt(attempt.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.exams.answers(attempt.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.exams.result(attempt.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.exams.review(attempt.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.exams.attemptsByExam(attempt.exam_id) }),
        qc.invalidateQueries({
          queryKey: [...queryKeys.exams.attemptsByExam(attempt.exam_id), "roster"] as const,
        }),
        qc.invalidateQueries({ queryKey: queryKeys.exams.allAttempts }),
        qc.invalidateQueries({ queryKey: queryKeys.corrections.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.unread }),
      ]);
    },
  });
}

export function useStartExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => ExamService.startAttempt(examId),
    onSuccess: async (attempt) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.exams.myAttempts }),
        qc.invalidateQueries({ queryKey: queryKeys.exams.attempt(attempt.id) }),
      ]);
    },
  });
}

export function useSaveExamAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      attemptId: string;
      questionId: string;
      answer: Json;
      flagged?: boolean;
    }) => ExamService.saveAnswer(input),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: queryKeys.exams.answers(vars.attemptId) });
    },
  });
}

export function useSubmitExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attemptId: string) => ExamService.submitAttempt(attemptId),
    onSuccess: async (attempt) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.exams.attempt(attempt.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.exams.result(attempt.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.exams.myAttempts }),
        qc.invalidateQueries({ queryKey: queryKeys.exams.answers(attempt.id) }),
      ]);
    },
  });
}

export function usePublishExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ExamService.publishExam(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.exams.all }),
        qc.invalidateQueries({ queryKey: queryKeys.exams.published }),
      ]);
    },
  });
}

export function useArchiveExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ExamService.archiveExam(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.exams.all }),
        qc.invalidateQueries({ queryKey: queryKeys.exams.published }),
      ]);
    },
  });
}

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ExamService.createExam,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.exams.all });
    },
  });
}

export function usePayments(studentId?: string) {
  return useQuery({
    queryKey: studentId ? queryKeys.payments.byStudent(studentId) : queryKeys.payments.all,
    queryFn: () => (studentId ? PaymentService.listForStudent(studentId) : PaymentService.list()),
    enabled: studentId === undefined || Boolean(studentId),
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: PaymentService.create,
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.payments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.byStudent(vars.studentId) }),
        qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
      ]);
    },
  });
}

export function useMarkPaymentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => PaymentService.markPaid(paymentId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.payments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        qc.invalidateQueries({ queryKey: queryKeys.access.me }),
      ]);
    },
  });
}

export function useMarkPaymentOverdue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => PaymentService.markOverdue(paymentId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.payments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        qc.invalidateQueries({ queryKey: queryKeys.access.me }),
      ]);
    },
  });
}

export function useRemindPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => PaymentService.remindStudent(paymentId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.payments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
      ]);
    },
  });
}

export function usePaymentProofs(studentId?: string) {
  return useQuery({
    queryKey: studentId
      ? queryKeys.paymentProofs.byStudent(studentId)
      : queryKeys.paymentProofs.all,
    queryFn: () =>
      studentId ? PaymentProofService.listMine(studentId) : PaymentProofService.list(),
    enabled: studentId === undefined || Boolean(studentId),
  });
}

export function usePendingPaymentProofs() {
  return useQuery({
    queryKey: queryKeys.paymentProofs.pending,
    queryFn: () => PaymentProofService.listPending(),
  });
}

export function useSubmitPaymentProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: PaymentProofService.uploadAndSubmit,
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.paymentProofs.all }),
        qc.invalidateQueries({ queryKey: queryKeys.paymentProofs.pending }),
        qc.invalidateQueries({ queryKey: queryKeys.paymentProofs.byStudent(vars.studentId) }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.byStudent(vars.studentId) }),
      ]);
    },
  });
}

export function useReviewPaymentProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { proofId: string; approve: boolean; adminNote?: string | null }) =>
      PaymentProofService.review(input.proofId, input.approve, input.adminNote),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.paymentProofs.all }),
        qc.invalidateQueries({ queryKey: queryKeys.paymentProofs.pending }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        qc.invalidateQueries({ queryKey: queryKeys.access.me }),
      ]);
    },
  });
}

export function useUploadAdminReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { proofId: string; file: File }) =>
      PaymentProofService.uploadAdminReceipt(input.proofId, input.file),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.paymentProofs.all }),
        qc.invalidateQueries({ queryKey: queryKeys.paymentProofs.pending }),
      ]);
    },
  });
}

export function useDeleteAdminReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proofId: string) => PaymentProofService.deleteAdminReceipt(proofId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.paymentProofs.all }),
        qc.invalidateQueries({ queryKey: queryKeys.paymentProofs.pending }),
      ]);
    },
  });
}

/** Admin receipt attached to a student_payments row (not payment_proofs). */
export function useUploadPaymentAdminReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { paymentId: string; file: File }) =>
      PaymentService.uploadAdminReceipt(input.paymentId, input.file),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.payments.all });
    },
  });
}

export function useDeletePaymentAdminReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => PaymentService.deleteAdminReceipt(paymentId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.payments.all });
    },
  });
}

export function useRecordingProvider() {
  return useQuery({
    queryKey: queryKeys.recordings.provider,
    queryFn: () => RecordingService.getProviderStatus(),
  });
}

export function useRecordings(classId?: string) {
  return useQuery({
    queryKey: classId
      ? ([...queryKeys.recordings.all, classId] as const)
      : queryKeys.recordings.all,
    queryFn: () => RecordingService.list(classId ? { classId } : undefined),
  });
}

export function useCreateRecordingFromUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: RecordingService.createFromExternalUrl,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.recordings.all });
    },
  });
}

export function useUpdateRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: RecordingService.update,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.recordings.all });
    },
  });
}

export function useDeleteRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => RecordingService.delete(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.recordings.all });
    },
  });
}

export function useUploadRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: RecordingService.uploadRecording,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.recordings.all });
    },
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: queryKeys.subscriptions.all,
    queryFn: () => SubscriptionService.list(),
  });
}

export function useMySubscription(studentId?: string) {
  return useQuery({
    queryKey: studentId
      ? ([...queryKeys.subscriptions.all, "student", studentId] as const)
      : (["subscriptions", "student", "none"] as const),
    queryFn: () => SubscriptionService.getByStudent(studentId!),
    enabled: Boolean(studentId),
  });
}

export function useSetStudentBillingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: SubscriptionService.setBillingPlan,
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.byStudent(vars.studentId) }),
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
      ]);
    },
  });
}

export function useAcademicAccess() {
  return useQuery({
    queryKey: queryKeys.access.me,
    queryFn: () => AccessService.hasActiveAcademicAccess(),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: () => NotificationService.listMine(),
    refetchInterval: 60_000,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: () => NotificationService.unreadCount(),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => NotificationService.markRead(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.unread }),
      ]);
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => NotificationService.markAllRead(),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.unread }),
      ]);
    },
  });
}

export function useLiveSessions(classId?: string) {
  return useQuery({
    queryKey: classId
      ? ([...queryKeys.liveSessions.all, classId] as const)
      : queryKeys.liveSessions.all,
    queryFn: () => LiveSessionService.list(classId ? { classId } : undefined),
    refetchInterval: 15_000,
  });
}

export function useLiveSessionsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel("live-sessions-switch")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, () => {
        void qc.invalidateQueries({ queryKey: queryKeys.liveSessions.all });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useLiveSession(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.liveSessions.detail(id ?? ""),
    queryFn: () => LiveSessionService.get(id!),
    enabled: Boolean(id),
    refetchInterval: 8_000,
  });
}

export function useCreateLiveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: LiveSessionService.create,
    onSuccess: async (session) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.liveSessions.all }),
        qc.invalidateQueries({ queryKey: queryKeys.liveSessions.detail(session.id) }),
      ]);
    },
  });
}

export function useUpdateLiveSessionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: LiveSessionStatus }) =>
      LiveSessionService.updateStatus(input.id, input.status),
    onSuccess: async (session) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.liveSessions.all }),
        qc.invalidateQueries({ queryKey: queryKeys.liveSessions.detail(session.id) }),
      ]);
    },
  });
}

export function useUpdateLiveSessionSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      title?: string;
      startsAt: string;
      endsAt: string | null;
      actorProfileId?: string | null;
    }) =>
      LiveSessionService.updateSchedule(input.id, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        ...(input.actorProfileId !== undefined ? { actorProfileId: input.actorProfileId } : {}),
      }),
    onSuccess: async (session) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.liveSessions.all }),
        qc.invalidateQueries({ queryKey: queryKeys.liveSessions.detail(session.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.unread }),
      ]);
    },
  });
}

export function useCreateEmergencyZoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => LiveSessionService.createEmergencyZoom(id),
    onSuccess: async (result) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.liveSessions.all }),
        qc.invalidateQueries({ queryKey: queryKeys.liveSessions.detail(result.session.id) }),
      ]);
    },
  });
}

export function useRevertLiveSessionToJitsi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => LiveSessionService.revertToJitsi(id),
    onSuccess: async (session) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.liveSessions.all }),
        qc.invalidateQueries({ queryKey: queryKeys.liveSessions.detail(session.id) }),
      ]);
    },
  });
}

export function useGenerateMonthSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { classId: string; year: number; month: number }) =>
      LiveSessionService.generateMonthSessions(input.classId, input.year, input.month),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.liveSessions.all });
    },
  });
}

export function useLiveSessionParticipants(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.liveSessionParticipants.bySession(sessionId ?? ""),
    queryFn: () => LiveSessionService.listParticipants(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useAddLiveSessionParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: string; profileId: string; addedBy?: string | null }) =>
      LiveSessionService.addParticipant(input.sessionId, input.profileId, input.addedBy),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({
        queryKey: queryKeys.liveSessionParticipants.bySession(vars.sessionId),
      });
    },
  });
}

export function useRemoveLiveSessionParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: string; profileId: string }) =>
      LiveSessionService.removeParticipant(input.sessionId, input.profileId),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({
        queryKey: queryKeys.liveSessionParticipants.bySession(vars.sessionId),
      });
    },
  });
}

export type { PaymentStatus, LiveSessionStatus };
