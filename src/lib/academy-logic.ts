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
