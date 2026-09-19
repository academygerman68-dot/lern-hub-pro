import type { Role } from "@/types/academy";

export type CalendarFilterVisibility = {
  level: boolean;
  group: boolean;
  teacher: boolean;
  status: boolean;
};

/** Which calendar dropdowns a role may use. Students never get Niveau/Groupe/Professeur. */
export function calendarFilterVisibility(role: Role | null | undefined): CalendarFilterVisibility {
  if (role === "director") {
    return { level: true, group: true, teacher: true, status: true };
  }
  if (role === "teacher") {
    return { level: true, group: true, teacher: false, status: true };
  }
  return { level: false, group: false, teacher: false, status: true };
}

export function filterClassesByLevelCode<T extends { level: string }>(
  classes: T[],
  levelCode: string,
): T[] {
  if (!levelCode) return classes;
  return classes.filter((item) => item.level === levelCode);
}

export function studentScopeClassId(enrolledClassIds: string[]): string | undefined {
  return enrolledClassIds.length === 1 ? enrolledClassIds[0] : undefined;
}

export function sessionBelongsToEnrolledClasses(
  classId: string | null | undefined,
  enrolledClassIds: ReadonlySet<string>,
): boolean {
  if (enrolledClassIds.size === 0) return false;
  return Boolean(classId && enrolledClassIds.has(classId));
}

export function pickStudentCalendarClass<T extends { status?: string; id: string }>(
  classes: T[],
): T | null {
  if (classes.length === 0) return null;
  return classes.find((item) => item.status === "active") ?? classes[0] ?? null;
}

export function studentCalendarContextLabel(klass: {
  level: string;
  name: string;
  reference?: string | null;
  teacher: string;
}): { level: string; group: string; teacher: string } {
  return {
    level: klass.level,
    group: klass.reference?.trim() || klass.name,
    teacher: klass.teacher?.trim() || "—",
  };
}

export function resolveCalendarTeacherId(
  role: Role | null | undefined,
  classes: Array<{ teacherId?: string | null }>,
  teachers: Array<{ id: string; email: string; profileId?: string }>,
  identity: { profileId?: string | null; email?: string | null },
): string | null {
  if (role !== "teacher") return null;
  const fromClass = classes.find((item) => item.teacherId)?.teacherId ?? null;
  if (fromClass) return fromClass;
  const profileId = identity.profileId?.trim();
  if (profileId) {
    const byProfile = teachers.find((teacher) => teacher.profileId === profileId);
    if (byProfile) return byProfile.id;
  }
  const email = identity.email?.trim().toLowerCase();
  if (!email) return null;
  return teachers.find((teacher) => teacher.email.toLowerCase() === email)?.id ?? null;
}
