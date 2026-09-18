import { demoAccounts } from "@/data/demo-accounts";
import { questionKeys } from "@/data/question-keys";
import {
  DIRECTOR_PAGES,
  STUDENT_PAGES,
  TEACHER_PAGES,
  type AcademyPage,
  type ExamScore,
  type Role,
  type SessionUser,
} from "@/types/academy";

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function isRole(value: string): value is Role {
  return value === "student" || value === "teacher" || value === "director";
}

export function pagesForRole(role: Role): readonly string[] {
  if (role === "student") return STUDENT_PAGES;
  if (role === "teacher") return TEACHER_PAGES;
  return DIRECTOR_PAGES;
}

export function isPageForRole(role: Role, page: string): page is AcademyPage {
  return pagesForRole(role).includes(page);
}

export function defaultPageForRole(_role: Role): AcademyPage {
  return "dashboard";
}

/** Pages a restricted student may still open (profile / main space / payments). */
export const STUDENT_RESTRICTED_ALLOWED_PAGES = [
  "dashboard",
  "profile",
  "payments",
  "messages",
  "materials",
] as const;

export const STUDENT_RESTRICTED_MESSAGE =
  "Votre accès à cette fonctionnalité est actuellement restreint. Veuillez contacter l’administration.";

/** Pending accounts may only open the dashboard and profile until validated. */
export const STUDENT_PENDING_ALLOWED_PAGES = ["dashboard", "profile"] as const;

export const STUDENT_PENDING_MESSAGE =
  "Votre compte est en attente de validation par l’administration. L’accès aux cours et outils pédagogiques sera ouvert après acceptation.";

export function isStudentRestrictedAllowedPage(page: string): boolean {
  return (STUDENT_RESTRICTED_ALLOWED_PAGES as readonly string[]).includes(page);
}

export function isStudentPendingAllowedPage(page: string): boolean {
  return (STUDENT_PENDING_ALLOWED_PAGES as readonly string[]).includes(page);
}

export function authenticate(email: string, password: string): SessionUser | null {
  const account = demoAccounts.find(
    (item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password,
  );
  if (!account) return null;
  return { role: account.role, name: account.name, email: account.email };
}

export function scoreExam(answers: Record<number, number>): ExamScore {
  const ids = Object.keys(questionKeys).map(Number);
  const total = ids.length;
  const correct = ids.filter((id) => answers[id] === questionKeys[id]).length;
  const overall = total === 0 ? 0 : Math.round((correct / total) * 100);
  const writing = Math.max(55, overall - 8);
  const speaking = Math.max(58, overall - 4);
  const reading = Math.min(96, overall + 6);
  const listening = Math.min(94, overall + 2);
  return {
    overall,
    correct,
    total,
    skills: [
      { name: "Hören", value: listening },
      { name: "Lesen", value: reading },
      { name: "Schreiben", value: writing },
      { name: "Sprechen", value: speaking },
    ],
  };
}

export type TeacherScope = {
  classIds: Set<string>;
  levelIds: Set<string>;
  levelCodes: Set<string>;
};

export function isDirectorRole(role: Role | null | undefined) {
  return role === "director";
}

export function buildTeacherScope(
  classes: Array<{ id: string; levelId?: string | null; level?: string }>,
): TeacherScope {
  return {
    classIds: new Set(classes.map((item) => item.id)),
    levelIds: new Set(
      classes.map((item) => item.levelId).filter((value): value is string => Boolean(value)),
    ),
    levelCodes: new Set(
      classes.map((item) => item.level).filter((value): value is string => Boolean(value)),
    ),
  };
}

export function scopedClassOrLevelItemVisible(
  item: {
    class_id?: string | null;
    classId?: string | null;
    level_id?: string | null;
    levelId?: string | null;
    class?: { id: string } | null;
    level?: { id: string } | null;
  },
  scope: TeacherScope,
) {
  const classId = item.class_id ?? item.classId ?? item.class?.id ?? null;
  if (classId) return scope.classIds.has(classId);
  const levelId = item.level_id ?? item.levelId ?? item.level?.id ?? null;
  if (levelId) return scope.levelIds.has(levelId);
  return false;
}

export function scopedLibraryItemVisible(
  item: { audience: string; class_id?: string | null; level_code?: string | null },
  scope: TeacherScope,
) {
  if (item.audience === "everyone") return true;
  if (item.audience === "level") {
    return Boolean(item.level_code && scope.levelCodes.has(item.level_code));
  }
  if (item.audience === "class") {
    return Boolean(item.class_id && scope.classIds.has(item.class_id));
  }
  return false;
}

export function hideArchivedStatus<T extends { status?: string | null }>(items: T[]) {
  return items.filter((item) => item.status !== "archived");
}
