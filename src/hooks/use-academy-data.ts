import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  AssignmentService,
  AttendanceService,
  ClassService,
  CourseService,
  EnrollmentService,
  ExamService,
  LibraryService,
  StudentService,
  TeacherService,
} from "@/services/academy-services";
import type { Json } from "@/types/database";

export function useLevels() {
  return useQuery({
    queryKey: ["levels"] as const,
    queryFn: () => ClassService.listLevels(),
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

export function useTeachers() {
  return useQuery({
    queryKey: queryKeys.teachers.all,
    queryFn: () => TeacherService.list(),
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

export function useCreateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: EnrollmentService.create,
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.enrollments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.enrollments.byClass(vars.classId) }),
        qc.invalidateQueries({ queryKey: queryKeys.enrollments.byStudent(vars.studentId) }),
        qc.invalidateQueries({ queryKey: queryKeys.classes.all }),
        qc.invalidateQueries({ queryKey: queryKeys.students.all }),
        qc.invalidateQueries({ queryKey: queryKeys.classes.roster(vars.classId) }),
      ]);
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

export function useLessons() {
  return useQuery({
    queryKey: queryKeys.courses.lessons,
    queryFn: () => CourseService.listLessons(),
  });
}

export function useLibrary() {
  return useQuery({
    queryKey: queryKeys.library.all,
    queryFn: () => CourseService.listResources(),
  });
}

export function useAssignments(classId?: string) {
  return useQuery({
    queryKey: classId ? queryKeys.assignments.byClass(classId) : queryKeys.assignments.all,
    queryFn: () => AssignmentService.list(classId),
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

export function useUploadLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: LibraryService.uploadAndCreate,
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
      await qc.invalidateQueries({ queryKey: queryKeys.assignments.byClass(vars.classId) });
    },
  });
}

export function useSaveAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      teacherId?: string | null;
      createdBy?: string | null;
      records: Array<{ studentId: string; mark: "present" | "absent" | "late" | "excused" }>;
    }) => {
      const session = await AttendanceService.openSession({
        classId: input.classId,
        ...(input.teacherId !== undefined ? { teacherId: input.teacherId } : {}),
        ...(input.createdBy !== undefined ? { createdBy: input.createdBy } : {}),
      });
      await AttendanceService.saveRecords(session.id, input.records);
      return session;
    },
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: queryKeys.attendance.byClass(vars.classId) });
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

export function useMyExamAttempts() {
  return useQuery({
    queryKey: queryKeys.exams.myAttempts,
    queryFn: () => ExamService.listMyAttempts(),
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

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ExamService.createExam,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.exams.all });
    },
  });
}
