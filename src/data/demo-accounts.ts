import type { DemoAccount } from "@/types/academy";

export const LEAD_TEACHER = "Anna Schneider";

export const demoAccounts: DemoAccount[] = [
  { email: "ahmed@demo.ma", password: "password", role: "student", name: "Ahmed Benali" },
  { email: "ahmed.benali@demo.ma", password: "password", role: "student", name: "Ahmed Benali" },
  { email: "anna@demo.ma", password: "password", role: "teacher", name: LEAD_TEACHER },
  { email: "samira@demo.ma", password: "password", role: "director", name: "Samira El Mansouri" },
];
