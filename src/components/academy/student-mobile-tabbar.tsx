import {
  BookOpen,
  ClipboardCheck,
  FileText,
  Home,
  Library,
  type LucideIcon,
} from "lucide-react";
import type { AcademyPage } from "@/types/academy";
import { useAcademy } from "./academy-context";

const TABS: readonly { id: AcademyPage; labelKey: string; Icon: LucideIcon; match: AcademyPage[] }[] =
  [
    { id: "dashboard", labelKey: "nav.tab.home", Icon: Home, match: ["dashboard"] },
    {
      id: "materials",
      labelKey: "nav.tab.materials",
      Icon: Library,
      match: ["materials"],
    },
    {
      id: "assignments",
      labelKey: "nav.tab.assignments",
      Icon: ClipboardCheck,
      match: ["assignments", "assignment-detail"],
    },
    {
      id: "exams",
      labelKey: "nav.tab.exams",
      Icon: FileText,
      match: ["exams", "mock-exam", "exam-result"],
    },
    {
      id: "courses",
      labelKey: "nav.tab.courses",
      Icon: BookOpen,
      match: ["courses", "lesson"],
    },
  ];

export function StudentMobileTabBar() {
  const { role, page, navigate, t } = useAcademy();
  if (role !== "student") return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label={t("nav.section.learning")}
    >
      <ul className="mx-auto flex max-w-[72rem] items-stretch justify-between px-1">
        {TABS.map(({ id, labelKey, Icon, match }) => {
          const active = match.includes(page);
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => navigate(id)}
                className={`flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={`size-5 ${active ? "opacity-100" : "opacity-70"}`} />
                <span className="truncate">{t(labelKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
