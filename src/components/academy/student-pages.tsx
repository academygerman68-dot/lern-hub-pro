import { PremiumPayments, PremiumProfile, PremiumLesson } from "./premium-screens";
import { PremiumStudentDashboard } from "./dashboards";
import { CalendarPage, Messages, Progress } from "./student-extra";
import {
  MaterialsLibraryPage,
  StudentAssignmentsPage,
  StudentLearningPage,
} from "./learning-pages";
import { StudentExamsPage } from "./exam-pages";
import { LiveClassesPage } from "./live-pages";
import { useAcademy } from "./academy-context";
import type { AcademyPage } from "@/types/academy";

export function StudentPages({ page: pageProp }: { page?: AcademyPage } = {}) {
  const { page: contextPage } = useAcademy();
  const page = pageProp ?? contextPage;
  if (page === "courses") return <StudentLearningPage />;
  if (page === "lesson") return <PremiumLesson />;
  if (page === "materials") return <MaterialsLibraryPage />;
  if (page === "live" || page === "meeting")
    return <LiveClassesPage meeting={page === "meeting"} />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "assignments" || page === "assignment-detail")
    return <StudentAssignmentsPage detail={page === "assignment-detail"} />;
  if (page === "exams" || page === "mock-exam" || page === "exam-result")
    return <StudentExamsPage mode={page} />;
  if (page === "progress") return <Progress />;
  if (page === "payments") return <PremiumPayments />;
  if (page === "messages") return <Messages />;
  if (page === "profile") return <PremiumProfile />;
  return <PremiumStudentDashboard />;
}
