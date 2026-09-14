import {
  PremiumExams,
  PremiumLearning,
  PremiumLesson,
  PremiumPayments,
  PremiumProfile,
} from "./premium-screens";
import { PremiumStudentDashboard } from "./dashboards";
import { Assignments, CalendarPage, Live, Materials, Messages, Progress } from "./student-extra";
import { useAcademy } from "./academy-context";
import type { AcademyPage } from "@/types/academy";

export function StudentPages({ page: pageProp }: { page?: AcademyPage } = {}) {
  const { page: contextPage } = useAcademy();
  const page = pageProp ?? contextPage;
  if (page === "courses") return <PremiumLearning />;
  if (page === "lesson") return <PremiumLesson />;
  if (page === "materials") return <Materials />;
  if (page === "live" || page === "meeting") return <Live meeting={page === "meeting"} />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "assignments" || page === "assignment-detail")
    return <Assignments detail={page === "assignment-detail"} />;
  if (page === "exams" || page === "mock-exam" || page === "exam-result")
    return <PremiumExams mode={page} />;
  if (page === "progress") return <Progress />;
  if (page === "payments") return <PremiumPayments />;
  if (page === "messages") return <Messages />;
  if (page === "profile") return <PremiumProfile />;
  return <PremiumStudentDashboard />;
}
