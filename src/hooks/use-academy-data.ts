import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  ClassService,
  EnrollmentService,
  StudentService,
  TeacherService,
} from "@/services/academy-services";

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
