import { Toaster } from "@/components/ui/sonner";
import { useAcademy, AcademyProvider } from "./academy-context";
import { Login } from "./login";
import { AppShell } from "./shell";
import { StudentPages } from "./student-pages";
import { DirectorPages, TeacherPages } from "./staff-pages";

function AcademyContent() {
  const { role } = useAcademy();
  if (!role) return <Login />;
  return <AppShell>{role === "student" ? <StudentPages /> : role === "teacher" ? <TeacherPages /> : <DirectorPages />}</AppShell>;
}

export function AcademyApp() {
  return <AcademyProvider><AcademyContent /><Toaster richColors position="top-right" /></AcademyProvider>;
}