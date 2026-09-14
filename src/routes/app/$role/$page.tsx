import { useEffect } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAcademy } from "@/components/academy/academy-context";
import { StudentPages } from "@/components/academy/student-pages";
import { DirectorPages, TeacherPages } from "@/components/academy/staff-pages";
import { defaultPageForRole, isPageForRole, isRole } from "@/lib/academy-logic";
import type { AcademyPage } from "@/types/academy";

export const Route = createFileRoute("/app/$role/$page")({
  validateSearch: (search: Record<string, unknown>) => {
    const studentId = typeof search["studentId"] === "string" ? search["studentId"] : undefined;
    return studentId ? { studentId } : {};
  },
  component: AcademyPageRoute,
});

function AcademyPageRoute() {
  const { role, page } = Route.useParams();
  const search = Route.useSearch();
  const academy = useAcademy();

  useEffect(() => {
    if (!academy.ready || !academy.session || !isRole(role) || !isPageForRole(role, page)) return;
    const nextPage = page as AcademyPage;
    const nextStudent =
      "studentId" in search ? search.studentId : academy.session.selectedStudentId;
    if (academy.session.page === nextPage && academy.session.selectedStudentId === nextStudent)
      return;
    academy.replaceSession({
      ...academy.session,
      page: nextPage,
      selectedStudentId: nextStudent ?? academy.session.selectedStudentId,
    });
  }, [academy, page, role, search]);

  if (!academy.ready) return <div className="min-h-screen bg-background" />;
  if (!academy.role) return <Navigate to="/" />;
  if (!isRole(role) || academy.role !== role) {
    return <Navigate to="/app/$role/$page" params={{ role: academy.role, page: academy.page }} />;
  }
  if (!isPageForRole(role, page)) {
    return <Navigate to="/app/$role/$page" params={{ role, page: defaultPageForRole(role) }} />;
  }

  if (role === "student") return <StudentPages page={page} />;
  if (role === "teacher") return <TeacherPages page={page} />;
  return <DirectorPages page={page} />;
}
