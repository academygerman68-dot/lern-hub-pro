import {
  ClipboardCheck,
  Home,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { clearLiveSessionId } from "@/lib/live-class-session";
import type { AcademyPage } from "@/types/academy";
import { useAcademy } from "./academy-context";

const TABS: readonly {
  id: AcademyPage;
  labelKey: string;
  Icon: LucideIcon;
  match: AcademyPage[];
}[] = [
  { id: "dashboard", labelKey: "nav.tab.home", Icon: Home, match: ["dashboard"] },
  {
    id: "classes",
    labelKey: "nav.tab.classes",
    Icon: Users,
    match: ["classes", "students"],
  },
  {
    id: "live",
    labelKey: "nav.tab.live",
    Icon: Video,
    match: ["live", "meeting", "calendar"],
  },
  {
    id: "assignments",
    labelKey: "nav.tab.assignments",
    Icon: ClipboardCheck,
    match: ["assignments", "corrections"],
  },
];

export function TeacherMobileTabBar() {
  const { role, page, navigate, t } = useAcademy();
  if (role !== "teacher") return null;
  if (page === "meeting") return null;

  const go = (id: AcademyPage) => {
    if (page === "meeting") {
      const ok = window.confirm(
        "Vous êtes en réunion. Quitter la visioconférence et changer de page ?",
      );
      if (!ok) return;
      clearLiveSessionId();
    }
    navigate(id);
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label={t("nav.section.teaching")}
    >
      <ul className="mx-auto flex max-w-[72rem] items-stretch justify-between px-1">
        {TABS.map(({ id, labelKey, Icon, match }) => {
          const active = match.includes(page);
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => go(id)}
                className={`flex w-full flex-col items-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={`size-4 ${active ? "opacity-100" : "opacity-70"}`} />
                <span className="truncate">{t(labelKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
