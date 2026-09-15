import type { Role } from "@/types/academy";

/**
 * Seeded Supabase accounts for QA / test-phase one-click login.
 * Gate with isTestLoginAllowed() — not a production identity system.
 */
export type TestQuickAccount = {
  role: Role;
  email: string;
  labelFr: string;
  labelAr: string;
  descriptionFr: string;
  descriptionAr: string;
};

export const TEST_QUICK_ACCOUNTS: TestQuickAccount[] = [
  {
    role: "student",
    email: "student@gla.academy",
    labelFr: "Étudiant",
    labelAr: "طالب",
    descriptionFr: "Cours, devoirs, examens, live",
    descriptionAr: "دروس، واجبات، امتحانات، بث مباشر",
  },
  {
    role: "teacher",
    email: "teacher@gla.academy",
    labelFr: "Professeur",
    labelAr: "أستاذ",
    descriptionFr: "Classes, présence, corrections",
    descriptionAr: "أقسام، حضور، تصحيح",
  },
  {
    role: "director",
    email: "admin@gla.academy",
    labelFr: "Admin",
    labelAr: "إدارة",
    descriptionFr: "Direction, élèves, enseignants",
    descriptionAr: "إدارة، طلاب، أساتذة",
  },
];

/** Shared password for seeded test users (override with VITE_TEST_ACCOUNT_PASSWORD). */
export function getTestAccountPassword(): string {
  const fromEnv = import.meta.env.VITE_TEST_ACCOUNT_PASSWORD;
  if (typeof fromEnv === "string") {
    const trimmed = fromEnv.trim();
    if (trimmed && trimmed !== "undefined") return trimmed;
  }
  return "Gla-2c35a11966de95";
}

/**
 * Show the 3 role sections on the login page during the test phase.
 * Hidden only when VITE_ENABLE_TEST_LOGIN=false.
 */
export function isTestLoginAllowed(): boolean {
  return import.meta.env.VITE_ENABLE_TEST_LOGIN !== "false";
}
