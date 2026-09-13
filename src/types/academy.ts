export type Role = "student" | "teacher" | "director";
export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "SUSPENDED";

export interface Student {
  id: string;
  name: string;
  email: string;
  level: "A1" | "A2" | "B1" | "B2";
  className: string;
  progress: number;
  attendance: number;
  average: number;
  subscription: SubscriptionStatus;
}

export interface Teacher { id: string; name: string; subject: string; classes: string[] }
export interface CourseModule { id: string; title: string; progress: number; lessons: number; exercises: number }
export interface Resource { title: string; level: string; type: "PDF" | "Audio" | "Video" | "Exercise"; date: string; size: string }
export interface Question { id: number; prompt: string; answers: string[]; correct: number }
export interface Notification { id: number; title: string; time: string; unread?: boolean }