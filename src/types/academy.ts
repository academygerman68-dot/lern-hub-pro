export type Role = "student" | "teacher" | "director";
export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "SUSPENDED";
export type Locale = "fr" | "ar";
export type Level = "A1" | "A2" | "B1" | "B2";
export type AccountStatus = "active" | "restricted" | "suspended" | "archived";

export const STUDENT_PAGES = [
  "dashboard",
  "courses",
  "lesson",
  "materials",
  "live",
  "meeting",
  "calendar",
  "assignments",
  "assignment-detail",
  "exams",
  "mock-exam",
  "exam-result",
  "progress",
  "payments",
  "messages",
  "profile",
] as const;

export const TEACHER_PAGES = [
  "dashboard",
  "classes",
  "students",
  "calendar",
  "lessons",
  "materials",
  "assignments",
  "exams",
  "attendance",
  "live",
  "meeting",
  "messages",
  "profile",
] as const;

export const DIRECTOR_PAGES = [
  "dashboard",
  "students",
  "student360",
  "teachers",
  "classes",
  "courses",
  "levels",
  "materials",
  "assignments",
  "exams",
  "payments",
  "payroll",
  "subscriptions",
  "invoices",
  "calendar",
  "live",
  "meeting",
  "messages",
  "reports",
  "settings",
  "audit",
] as const;

export type StudentPage = (typeof STUDENT_PAGES)[number];
export type TeacherPage = (typeof TEACHER_PAGES)[number];
export type DirectorPage = (typeof DIRECTOR_PAGES)[number];
export type AcademyPage = StudentPage | TeacherPage | DirectorPage;

export interface Student {
  id: string;
  name: string;
  email: string;
  level: Level;
  className: string;
  progress: number;
  attendance: number;
  average: number;
  subscription: SubscriptionStatus;
  firstName: string;
  lastName: string;
  phone: string | null;
  profileId: string;
  accountStatus: AccountStatus;
  teacherName?: string;
  classId?: string;
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  classes: string[];
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  profileId: string;
  levels: string[];
  accountStatus: AccountStatus;
}

export interface CourseModule {
  id: string;
  title: string;
  progress: number;
  lessons: number;
  exercises: number;
  level?: string;
  courseTitle?: string;
}

export interface Resource {
  id?: string;
  title: string;
  level: string;
  type: "PDF" | "Audio" | "Video" | "Exercise";
  date: string;
  size: string;
  storage_path?: string;
  storage_bucket?: string;
  mime_type?: string | null;
}

export interface AssignmentListItem {
  id: string;
  title: string;
  due: string;
  status: string;
  classId?: string;
  description?: string | null;
  studentId?: string;
  studentName?: string;
  grade?: string;
}

export interface Question {
  id: number;
  prompt: string;
  answers: string[];
}

export interface Notification {
  id: number;
  title: string;
  time: string;
  unread?: boolean;
}

export interface AcademyClass {
  id: string;
  level: Level;
  teacher: string;
  size: number;
  schedule: string;
  room: string;
}

export interface LessonRecord {
  id: string;
  title: string;
  level: Level;
  module: string;
  status: "DRAFT" | "PUBLISHED";
  resources: number;
}

export interface AssignmentRecord {
  id: string;
  title: string;
  studentId: string;
  studentName: string;
  status: "Pending" | "Submitted" | "Corrected";
  deadline: string;
  grade: string;
}

export interface ExamRecord {
  id: string;
  title: string;
  level: Level;
  skill: string;
  status: "DRAFT" | "PUBLISHED";
}

export interface InvoiceRecord {
  id: string;
  studentId: string;
  studentName: string;
  period: string;
  amount: number;
  date: string;
  status: "PAID" | "PENDING" | "OVERDUE";
}

export interface DemoAccount {
  email: string;
  password: string;
  role: Role;
  name: string;
}

export interface SessionUser {
  id?: string;
  role: Role;
  name: string;
  email: string;
}

export interface ExamScore {
  overall: number;
  correct: number;
  total: number;
  skills: { name: string; value: number }[];
}

export interface NavigateOptions {
  studentId?: string;
  classId?: string;
  moduleId?: string;
  lessonId?: string;
  assignmentId?: string;
  recipientId?: string;
}
