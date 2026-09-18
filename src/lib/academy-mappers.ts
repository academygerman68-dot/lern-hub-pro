import type {
  AcademyClass,
  AccountStatus,
  Level,
  Student,
  SubscriptionStatus,
  Teacher,
} from "@/types/academy";
import type { Database } from "@/types/database";

type RecordStatus = Database["public"]["Enums"]["record_status"];
type ClassStatus = Database["public"]["Enums"]["class_status"];
type DbSubscription = Database["public"]["Enums"]["subscription_status"];
type ProfileStatus = Database["public"]["Enums"]["profile_status"];

export type ProfileLite = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone?: string | null;
  status?: ProfileStatus;
};

export type StudentRow = {
  id: string;
  student_code: string | null;
  level_code: string | null;
  created_at?: string;
  status: RecordStatus;
  notes: string | null;
  profile: ProfileLite | ProfileLite[] | null;
  enrollments?: Array<{
    id: string;
    status: Database["public"]["Enums"]["enrollment_status"];
    class:
      | {
          id: string;
          name: string;
          schedule_label: string | null;
          level: { code: string } | { code: string }[] | null;
          teacher?:
            | {
                id: string;
                profile: ProfileLite | ProfileLite[] | null;
              }
            | Array<{
                id: string;
                profile: ProfileLite | ProfileLite[] | null;
              }>
            | null;
        }
      | Array<{
          id: string;
          name: string;
          schedule_label: string | null;
          level: { code: string } | { code: string }[] | null;
          teacher?:
            | {
                id: string;
                profile: ProfileLite | ProfileLite[] | null;
              }
            | Array<{
                id: string;
                profile: ProfileLite | ProfileLite[] | null;
              }>
            | null;
        }>
      | null;
  }> | null;
  student_subscriptions?: { status: DbSubscription } | { status: DbSubscription }[] | null;
};

export type TeacherRow = {
  id: string;
  employee_code: string | null;
  specialties: string[];
  status: RecordStatus;
  bio: string | null;
  profile: ProfileLite | ProfileLite[] | null;
  classes?: Array<{
    id: string;
    name: string;
    status: ClassStatus;
    level?: { code: string } | { code: string }[] | null;
  }> | null;
};

export type ClassRow = {
  id: string;
  name: string;
  reference?: string | null;
  capacity: number;
  status: ClassStatus;
  room: string | null;
  schedule_label: string | null;
  start_date?: string | null;
  end_date?: string | null;
  level:
    | { id: string; code: string; name: string }
    | { id: string; code: string; name: string }[]
    | null;
  teacher:
    | {
        id: string;
        profile: ProfileLite | ProfileLite[] | null;
      }
    | Array<{
        id: string;
        profile: ProfileLite | ProfileLite[] | null;
      }>
    | null;
  enrollments?: Array<{
    id: string;
    status: Database["public"]["Enums"]["enrollment_status"];
  }> | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function profileName(profile: ProfileLite | null): string {
  if (!profile) return "Inconnu";
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Inconnu";
}

export function toLevel(code: string | null | undefined): Level {
  if (code === "A1" || code === "A2" || code === "B1" || code === "B2") return code;
  return "A1";
}

export function toAccountStatus(status: ProfileStatus | null | undefined): AccountStatus {
  if (
    status === "pending" ||
    status === "restricted" ||
    status === "suspended" ||
    status === "archived"
  ) {
    return status;
  }
  return "active";
}

export function toUiSubscription(status: DbSubscription | null | undefined): SubscriptionStatus {
  switch (status) {
    case "past_due":
    case "grace_period":
      return "PAST_DUE";
    case "suspended":
    case "cancelled":
      return "SUSPENDED";
    case "active":
    case "manually_extended":
    default:
      return "ACTIVE";
  }
}

export function mapStudent(row: StudentRow): Student {
  const profile = one(row.profile);
  const activeEnrollment = (row.enrollments ?? []).find((e) => e.status === "active");
  const klass = one(activeEnrollment?.class ?? null);
  const levelFromClass = one(klass?.level ?? null)?.code;
  const subscription = one(row.student_subscriptions ?? null);
  const classTeacher = one(klass?.teacher ?? null);
  const teacherProfile = one(classTeacher?.profile ?? null);

  return {
    id: row.id,
    name: profileName(profile),
    email: profile?.email ?? "",
    level: toLevel(row.level_code ?? levelFromClass),
    className: klass?.name ?? "—",
    progress: 0,
    average: 0,
    subscription: toUiSubscription(subscription?.status),
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    phone: profile?.phone ?? null,
    profileId: profile?.id ?? "",
    accountStatus: toAccountStatus(profile?.status),
    ...(teacherProfile ? { teacherName: profileName(teacherProfile) } : {}),
    ...(klass?.id ? { classId: klass.id } : {}),
    ...(row.created_at ? { createdAt: row.created_at } : {}),
  };
}

export function mapTeacher(row: TeacherRow): Teacher {
  const profile = one(row.profile);
  const activeClasses = (row.classes ?? []).filter((c) => c.status !== "archived");
  const classNames = activeClasses.map((c) => c.name);
  const levels = Array.from(
    new Set(
      activeClasses
        .map((c) => one(c.level ?? null)?.code)
        .filter((code): code is string => Boolean(code)),
    ),
  );

  return {
    id: row.id,
    name: profileName(profile),
    subject: row.specialties[0] ?? "Allemand",
    classes: classNames,
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? null,
    profileId: profile?.id ?? "",
    levels,
    accountStatus: toAccountStatus(profile?.status),
  };
}

export function mapClass(row: ClassRow): AcademyClass {
  const level = one(row.level);
  const teacher = one(row.teacher);
  const teacherProfile = one(teacher?.profile ?? null);
  const activeCount = (row.enrollments ?? []).filter((e) => e.status === "active").length;

  return {
    id: row.id,
    level: toLevel(level?.code),
    teacher: profileName(teacherProfile),
    size: activeCount,
    schedule: row.schedule_label ?? "—",
    room: row.room ?? "—",
  };
}

/** Richer class DTO for screens that need the real name + status. */
export type ClassDetail = AcademyClass & {
  name: string;
  reference: string | null;
  status: ClassStatus;
  capacity: number;
  teacherId: string | null;
  levelId: string | null;
  startDate: string | null;
  endDate: string | null;
};

export function mapClassDetail(row: ClassRow): ClassDetail {
  const base = mapClass(row);
  const level = one(row.level);
  const teacher = one(row.teacher);
  return {
    ...base,
    name: row.name,
    reference: row.reference ?? null,
    status: row.status,
    capacity: row.capacity,
    teacherId: teacher?.id ?? null,
    levelId: level?.id ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
  };
}
