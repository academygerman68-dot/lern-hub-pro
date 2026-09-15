import type { Role } from "@/types/academy";

/**
 * Seeded Supabase accounts for QA / test-phase one-click login.
 * Never use these as a production identity system — gate with isTestLoginAllowed().
 */
export type TestQuickAccount = {
  role: Role;
  email: string;
  labelFr: string;
  labelAr: string;
};

export const TEST_QUICK_ACCOUNTS: TestQuickAccount[] = [
  {
    role: "student",
    email: "student@gla.academy",
    labelFr: "Étudiant",
    labelAr: "طالب",
  },
  {
    role: "teacher",
    email: "teacher@gla.academy",
    labelFr: "Professeur",
    labelAr: "أستاذ",
  },
  {
    role: "director",
    email: "admin@gla.academy",
    labelFr: "Admin / Direction",
    labelAr: "إدارة",
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
 * One-click test login buttons.
 * - Always on in Vite DEV
 * - Or when VITE_ENABLE_TEST_LOGIN=true (Lovable / preview QA)
 * Set VITE_ENABLE_TEST_LOGIN=false to hide even in DEV.
 */
export function isTestLoginAllowed(): boolean {
  if (import.meta.env.VITE_ENABLE_TEST_LOGIN === "false") return false;
  if (import.meta.env.VITE_ENABLE_TEST_LOGIN === "true") return true;
  return import.meta.env.DEV === true;
}
