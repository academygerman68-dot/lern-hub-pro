/**
 * DEVELOPMENT ONLY — fake credentials for local UI prototyping when
 * VITE_SUPABASE_URL is unset. Never use these accounts in production.
 * When Supabase Auth is configured, identity comes exclusively from Auth + profiles.
 */
import type { DemoAccount } from "@/types/academy";

export const LEAD_TEACHER = "Anna Schneider";

/** @deprecated Prefer Supabase Auth. Kept for offline/demo fallback only. */
export const demoAccounts: DemoAccount[] = [
  { email: "ahmed@demo.ma", password: "password", role: "student", name: "Ahmed Benali" },
  { email: "ahmed.benali@demo.ma", password: "password", role: "student", name: "Ahmed Benali" },
  { email: "anna@demo.ma", password: "password", role: "teacher", name: LEAD_TEACHER },
  { email: "samira@demo.ma", password: "password", role: "director", name: "Samira El Mansouri" },
];
