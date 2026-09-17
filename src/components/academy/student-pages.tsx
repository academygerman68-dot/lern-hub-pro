import { PremiumProfile } from "./premium-screens";
import { StudentLessonPage, AssignmentWorkflow } from "./workflow-pages";
import { PremiumStudentDashboard } from "./dashboards";
import { CalendarPage, Messages, Progress } from "./student-extra";
import { MaterialsLibraryPage, StudentLearningPage } from "./academic-pages";
import { StudentExamsPage } from "./exam-pages";
import { LiveClassesPage } from "./live-pages";
import { StudentPaymentsPage } from "./finance-pages";
import { useAcademy } from "./academy-context";
import type { AcademyPage } from "@/types/academy";
import { isStudentRestrictedAllowedPage, STUDENT_RESTRICTED_MESSAGE } from "@/lib/academy-logic";

function RestrictedAccessNotice() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8">
      <h2 className="font-semibold">Accès restreint</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        {STUDENT_RESTRICTED_MESSAGE}
      </p>
    </div>
  );
}

export function StudentPages({ page: pageProp }: { page?: AcademyPage } = {}) {
  const { page: contextPage, profile } = useAcademy();
  const page = pageProp ?? contextPage;
  if (profile?.status === "restricted" && !isStudentRestrictedAllowedPage(page)) {
    return <RestrictedAccessNotice />;
  }
  if (page === "courses") return <StudentLearningPage />;
  if (page === "lesson") return <StudentLessonPage />;
  if (page === "materials") return <MaterialsLibraryPage />;
  if (page === "live" || page === "meeting")
    return <LiveClassesPage meeting={page === "meeting"} />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "assignments" || page === "assignment-detail")
    return <AssignmentWorkflow detail={page === "assignment-detail"} />;
  if (page === "exams" || page === "mock-exam" || page === "exam-result")
    return <StudentExamsPage mode={page} />;
  if (page === "progress") return <Progress />;
  if (page === "payments") return <StudentPaymentsPage />;
  if (page === "messages") return <Messages />;
  if (page === "profile") return <PremiumProfile />;
  return <PremiumStudentDashboard />;
}
