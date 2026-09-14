import { modules, students } from "@/data/mock-data";
import type { Role, SubscriptionStatus } from "@/types/academy";

const wait = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));

export const AuthService = {
  async demoLogin(role: Role) { await wait(); return { role, name: role === "student" ? "Ahmed Benali" : role === "teacher" ? "Anna Schneider" : "Samira El Mansouri" }; },
};
export const StudentService = { async list() { await wait(200); return students; } };
export const CourseService = { async listModules() { await wait(200); return modules; } };
export const ExamService = { async submit() { await wait(600); return { overall: 75 }; } };
export const PaymentService = { async pay(): Promise<SubscriptionStatus> { await wait(700); return "ACTIVE"; } };
export const NotificationService = { async markAllRead() { await wait(150); return true; } };