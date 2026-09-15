/**
 * DEVELOPMENT ONLY — static mock LMS content for UI prototyping.
 * Not a source of truth. Replace progressively with Supabase domain services.
 */
import { LEAD_TEACHER } from "@/data/demo-accounts";
import type {
  AcademyClass,
  AssignmentRecord,
  CourseModule,
  ExamRecord,
  InvoiceRecord,
  LessonRecord,
  Notification,
  Question,
  Resource,
  Student,
  Teacher,
} from "@/types/academy";

const names = [
  "Ahmed Benali",
  "Sara El Amrani",
  "Youssef Alaoui",
  "Lina Idrissi",
  "Omar Berrada",
  "Meryem Chraibi",
  "Hamza Tazi",
  "Inès Saidi",
  "Adam Fassi",
  "Salma Naciri",
  "Rayan Amrani",
  "Nora Bennani",
  "Mehdi Karim",
  "Aya Mansouri",
  "Ilyas Zahraoui",
];
const levels = [
  "A2",
  "A1",
  "B1",
  "A2",
  "A1",
  "B2",
  "A2",
  "B1",
  "A1",
  "A2",
  "B1",
  "A1",
  "B2",
  "A2",
  "B1",
] as const;

export const students: Student[] = names.map((name, i) => ({
  id: `ST-${String(i + 1).padStart(3, "0")}`,
  name,
  email: `${name.toLowerCase().replaceAll(" ", ".")}@demo.ma`,
  level: levels[i] ?? "A1",
  className: `${levels[i] ?? "A1"}-G${(i % 2) + 1}`,
  progress: i === 0 ? 68 : 42 + ((i * 7) % 50),
  attendance: i === 0 ? 94 : 79 + ((i * 3) % 20),
  average: i === 0 ? 81 : 64 + ((i * 5) % 29),
  subscription: i === 3 ? "SUSPENDED" : i === 7 ? "PAST_DUE" : "ACTIVE",
}));

export const teachers: Teacher[] = [
  { id: "T-01", name: LEAD_TEACHER, subject: "Deutsch A2 · B1", classes: ["A2-G2", "B1-G1"] },
  { id: "T-02", name: "Felix Wagner", subject: "Deutsch A1", classes: ["A1-G1"] },
  { id: "T-03", name: "Laura Schneider", subject: "Deutsch A1 · A2", classes: ["A1-G2", "A2-G1"] },
  { id: "T-04", name: "Jonas Fischer", subject: "Deutsch B2", classes: ["B2-G1"] },
  { id: "T-05", name: "Mia Hoffmann", subject: "Exam preparation", classes: ["A2-G2"] },
];

export const modules: CourseModule[] = [
  { id: "alltag", title: "Alltag", progress: 100, lessons: 8, exercises: 14 },
  { id: "arbeit", title: "Arbeit", progress: 75, lessons: 7, exercises: 12 },
  { id: "reisen", title: "Reisen", progress: 42, lessons: 6, exercises: 10 },
  { id: "gesundheit", title: "Gesundheit", progress: 10, lessons: 8, exercises: 13 },
  { id: "kommunikation", title: "Kommunikation", progress: 0, lessons: 7, exercises: 12 },
];

export const resources: Resource[] = [
  { title: "A2 Grammar Guide.pdf", level: "A2", type: "PDF", date: "12 Sep 2026", size: "4.2 MB" },
  {
    title: "A2 Vocabulary — Arbeit.pdf",
    level: "A2",
    type: "PDF",
    date: "10 Sep 2026",
    size: "1.8 MB",
  },
  {
    title: "Listening Exercise 04.mp3",
    level: "A2",
    type: "Audio",
    date: "08 Sep 2026",
    size: "8.6 MB",
  },
  {
    title: "German Conversation.mp4",
    level: "A2",
    type: "Video",
    date: "04 Sep 2026",
    size: "84 MB",
  },
  {
    title: "B1 Satzbau Training",
    level: "B1",
    type: "Exercise",
    date: "01 Sep 2026",
    size: "Interactive",
  },
];

export const questions: Question[] = [
  {
    id: 1,
    prompt: "Wo findet das Gespräch statt?",
    answers: ["Im Bahnhof", "Im Büro", "Im Restaurant", "Im Supermarkt"],
  },
  {
    id: 2,
    prompt: "Wann beginnt die Besprechung?",
    answers: ["Um acht Uhr", "Um neun Uhr", "Um halb zehn", "Um elf Uhr"],
  },
  {
    id: 3,
    prompt: "Was soll Herr Weber mitbringen?",
    answers: ["Den Bericht", "Einen Kaffee", "Den Laptop", "Die Rechnung"],
  },
  {
    id: 4,
    prompt: "Warum kommt Lena später?",
    answers: ["Der Bus ist spät", "Sie ist krank", "Sie telefoniert", "Sie hat Urlaub"],
  },
];

export const notifications: Notification[] = [
  { id: 1, title: "Your German class starts in 30 minutes.", time: "Now", unread: true },
  { id: 2, title: "Your payment is due in 3 days.", time: "2h", unread: true },
  { id: 3, title: "Your teacher corrected your assignment.", time: "Yesterday" },
  { id: 4, title: "A2 Mock Exam 02 is now available.", time: "2 days" },
];

export const classes: AcademyClass[] = [
  {
    id: "A1-G1",
    level: "A1",
    teacher: "Felix Wagner",
    size: 14,
    schedule: "Mon & Wed · 18:00",
    room: "Room 2",
  },
  {
    id: "A1-G2",
    level: "A1",
    teacher: "Laura Schneider",
    size: 16,
    schedule: "Tue & Thu · 18:00",
    room: "Online",
  },
  {
    id: "A2-G1",
    level: "A2",
    teacher: "Laura Schneider",
    size: 15,
    schedule: "Mon & Wed · 19:30",
    room: "Room 4",
  },
  {
    id: "A2-G2",
    level: "A2",
    teacher: LEAD_TEACHER,
    size: 15,
    schedule: "Tue & Thu · 18:00",
    room: "Online",
  },
  {
    id: "B1-G1",
    level: "B1",
    teacher: LEAD_TEACHER,
    size: 13,
    schedule: "Wed & Fri · 19:00",
    room: "Room 3",
  },
  {
    id: "B2-G1",
    level: "B2",
    teacher: "Jonas Fischer",
    size: 12,
    schedule: "Sat · 09:00",
    room: "Online",
  },
];

export const lessons: LessonRecord[] = [
  {
    id: "L-01",
    title: "Im Büro",
    level: "A2",
    module: "Arbeit",
    status: "PUBLISHED",
    resources: 6,
  },
  {
    id: "L-02",
    title: "Beim Arzt",
    level: "A2",
    module: "Gesundheit",
    status: "PUBLISHED",
    resources: 7,
  },
  {
    id: "L-03",
    title: "Eine Reise planen",
    level: "A2",
    module: "Reisen",
    status: "DRAFT",
    resources: 8,
  },
];

export const assignments: AssignmentRecord[] = [
  {
    id: "HW-01",
    title: "German Email Writing",
    studentId: "ST-001",
    studentName: "Ahmed Benali",
    status: "Pending",
    deadline: "Due tomorrow",
    grade: "—",
  },
  {
    id: "HW-02",
    title: "Listening Exercise",
    studentId: "ST-001",
    studentName: "Ahmed Benali",
    status: "Submitted",
    deadline: "Submitted",
    grade: "78%",
  },
  {
    id: "HW-03",
    title: "Writing Assignment",
    studentId: "ST-001",
    studentName: "Ahmed Benali",
    status: "Corrected",
    deadline: "Sep 08",
    grade: "82%",
  },
];

export const exams: ExamRecord[] = [
  { id: "EX-A1-01", title: "A1 Mock Exam 01", level: "A1", skill: "Hören", status: "PUBLISHED" },
  {
    id: "EX-A2-01",
    title: "A2 Mock Exam 01",
    level: "A2",
    skill: "Hören & Lesen",
    status: "PUBLISHED",
  },
  {
    id: "EX-A2-02",
    title: "A2 Mock Exam 02",
    level: "A2",
    skill: "Schreiben & Sprechen",
    status: "DRAFT",
  },
  { id: "EX-B1-02", title: "B1 Mock Exam 02", level: "B1", skill: "Hören", status: "PUBLISHED" },
  { id: "EX-B2-01", title: "B2 Mock Exam 01", level: "B2", skill: "Hören", status: "DRAFT" },
];

export const invoices: InvoiceRecord[] = [
  {
    id: "INV-2026-09-001",
    studentId: "ST-001",
    studentName: "Ahmed Benali",
    period: "September 2026",
    amount: 1200,
    date: "01 Sep 2026",
    status: "PAID",
  },
  {
    id: "INV-2026-08-001",
    studentId: "ST-001",
    studentName: "Ahmed Benali",
    period: "August 2026",
    amount: 1200,
    date: "01 Aug 2026",
    status: "PAID",
  },
  {
    id: "INV-2026-07-001",
    studentId: "ST-001",
    studentName: "Ahmed Benali",
    period: "July 2026",
    amount: 1200,
    date: "01 Jul 2026",
    status: "PAID",
  },
  {
    id: "INV-2026-09-004",
    studentId: "ST-004",
    studentName: "Lina Idrissi",
    period: "September 2026",
    amount: 1200,
    date: "01 Sep 2026",
    status: "OVERDUE",
  },
  {
    id: "INV-2026-09-008",
    studentId: "ST-008",
    studentName: "Inès Saidi",
    period: "September 2026",
    amount: 1200,
    date: "01 Sep 2026",
    status: "PENDING",
  },
];
