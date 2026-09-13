import type { CourseModule, Notification, Question, Resource, Student, Teacher } from "@/types/academy";

const names = ["Ahmed Benali", "Sara El Amrani", "Youssef Alaoui", "Lina Idrissi", "Omar Berrada", "Meryem Chraibi", "Hamza Tazi", "Inès Saidi", "Adam Fassi", "Salma Naciri", "Rayan Amrani", "Nora Bennani", "Mehdi Karim", "Aya Mansouri", "Ilyas Zahraoui"];
const levels = ["A2", "A1", "B1", "A2", "A1", "B2", "A2", "B1", "A1", "A2", "B1", "A1", "B2", "A2", "B1"] as const;

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
  { id: "T-01", name: "Anna Müller", subject: "Deutsch A2 · B1", classes: ["A2-G2", "B1-G1"] },
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
  { title: "A2 Vocabulary — Arbeit.pdf", level: "A2", type: "PDF", date: "10 Sep 2026", size: "1.8 MB" },
  { title: "Listening Exercise 04.mp3", level: "A2", type: "Audio", date: "08 Sep 2026", size: "8.6 MB" },
  { title: "German Conversation.mp4", level: "A2", type: "Video", date: "04 Sep 2026", size: "84 MB" },
  { title: "B1 Satzbau Training", level: "B1", type: "Exercise", date: "01 Sep 2026", size: "Interactive" },
];

export const questions: Question[] = [
  { id: 1, prompt: "Wo findet das Gespräch statt?", answers: ["Im Bahnhof", "Im Büro", "Im Restaurant", "Im Supermarkt"], correct: 1 },
  { id: 2, prompt: "Wann beginnt die Besprechung?", answers: ["Um acht Uhr", "Um neun Uhr", "Um halb zehn", "Um elf Uhr"], correct: 2 },
  { id: 3, prompt: "Was soll Herr Weber mitbringen?", answers: ["Den Bericht", "Einen Kaffee", "Den Laptop", "Die Rechnung"], correct: 0 },
  { id: 4, prompt: "Warum kommt Lena später?", answers: ["Der Bus ist spät", "Sie ist krank", "Sie telefoniert", "Sie hat Urlaub"], correct: 0 },
];

export const notifications: Notification[] = [
  { id: 1, title: "Your German class starts in 30 minutes.", time: "Now", unread: true },
  { id: 2, title: "Your payment is due in 3 days.", time: "2h", unread: true },
  { id: 3, title: "Your teacher corrected your assignment.", time: "Yesterday" },
  { id: 4, title: "A2 Mock Exam 02 is now available.", time: "2 days" },
];

export const classes = [
  ["A1-G1", "A1", "Felix Wagner", 14, "Mon & Wed · 18:00", "Room 2"],
  ["A1-G2", "A1", "Laura Schneider", 16, "Tue & Thu · 18:00", "Online"],
  ["A2-G1", "A2", "Laura Schneider", 15, "Mon & Wed · 19:30", "Room 4"],
  ["A2-G2", "A2", "Anna Müller", 15, "Tue & Thu · 18:00", "Online"],
  ["B1-G1", "B1", "Anna Müller", 13, "Wed & Fri · 19:00", "Room 3"],
  ["B2-G1", "B2", "Jonas Fischer", 12, "Sat · 09:00", "Online"],
];