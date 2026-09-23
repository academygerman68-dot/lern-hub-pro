import { PremiumProfile } from "./premium-screens";
import { StudentLessonPage } from "./workflow-pages";
import { PremiumStudentDashboard } from "./dashboards";
import {
  Assignments,
  CalendarPage,
  Messages,
  Progress,
  RecordingsPage,
  AccountSettings,
} from "./student-extra";
import { MaterialsLibraryPage, StudentLearningPage } from "./academic-pages";
import { StudentExamsPage } from "./exam-pages";
import { B1StudentRunner } from "./b1-student-runner";
import { LiveClassesPage } from "./live-pages";
import { StudentPaymentsPage } from "./finance-pages";
import { useAcademy } from "./academy-context";
import type { AcademyPage } from "@/types/academy";
import {
  isStudentPendingAllowedPage,
  isStudentRestrictedAllowedPage,
  STUDENT_PENDING_MESSAGE,
  STUDENT_RESTRICTED_MESSAGE,
} from "@/lib/academy-logic";
import { Surface } from "./primitives";

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

function PendingAccountPage() {
  return (
    <Surface className="mx-auto max-w-xl space-y-4 p-8 text-center">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Validation
      </p>
      <h1 className="font-display text-2xl font-medium">Compte en attente de validation</h1>
      <p className="text-sm leading-6 text-muted-foreground">{STUDENT_PENDING_MESSAGE}</p>
      <p className="text-sm text-muted-foreground">
        Vous pouvez consulter votre profil. Les cours, devoirs, examens et réunions restent bloqués
        jusqu’à l’acceptation par un administrateur.
      </p>
    </Surface>
  );
}

export function StudentPages({ page: pageProp }: { page?: AcademyPage } = {}) {
  const { page: contextPage, profile } = useAcademy();
  const page = pageProp ?? contextPage;

  if (profile?.status === "pending") {
    if (!isStudentPendingAllowedPage(page) || page === "dashboard") {
      return <PendingAccountPage />;
    }
  }

  if (profile?.status === "restricted" && !isStudentRestrictedAllowedPage(page)) {
    return <RestrictedAccessNotice />;
  }
  if (page === "courses") return <StudentLearningPage />;
  if (page === "lesson") return <StudentLessonPage />;
  if (page === "materials") return <MaterialsLibraryPage />;
  if (page === "live" || page === "meeting")
    return <LiveClassesPage meeting={page === "meeting"} />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "recordings") return <RecordingsPage />;
  if (page === "assignments" || page === "assignment-detail")
    return <Assignments detail={page === "assignment-detail"} />;
  if (page === "exams" || page === "mock-exam" || page === "exam-result")
    return <StudentExamsPage mode={page} />;
  if (page === "b1-preview") return <B1StudentRunner mode="preview" />;
  if (page === "progress") return <Progress />;
  if (page === "payments") return <StudentPaymentsPage />;
  if (page === "messages") return <Messages />;
  if (page === "profile") return <PremiumProfile />;
  if (page === "settings") return <AccountSettings />;
  return <PremiumStudentDashboard />;
}
