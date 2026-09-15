import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  Home,
  Layers3,
  Library,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { notifications } from "@/data/mock-data";
import { initials } from "@/lib/academy-logic";
import { localeLabels } from "@/lib/i18n";
import { NotificationService } from "@/services/academy-services";
import type { AcademyPage, Locale } from "@/types/academy";
import { useAcademy } from "./academy-context";

type NavItem = readonly [AcademyPage, string, typeof Home];
type NavSection = { label?: string; items: NavItem[] };

const menus: Record<"student" | "teacher" | "director", NavSection[]> = {
  student: [
    {
      label: "Learning",
      items: [
        ["dashboard", "nav.home", Home],
        ["courses", "nav.learning", BookOpen],
        ["assignments", "nav.assignments", ClipboardCheck],
        ["exams", "nav.exams", FileText],
        ["progress", "nav.progress", BarChart3],
        ["live", "nav.live", Video],
      ],
    },
    {
      label: "Account",
      items: [
        ["payments", "nav.payments", CreditCard],
        ["messages", "nav.messages", MessageSquare],
        ["profile", "nav.profile", UserRound],
      ],
    },
  ],
  teacher: [
    {
      label: "Teaching",
      items: [
        ["dashboard", "nav.home", Home],
        ["classes", "nav.classes", Users],
        ["students", "nav.students", GraduationCap],
        ["lessons", "nav.lessons", BookOpen],
        ["assignments", "nav.assignments", ClipboardCheck],
        ["exams", "nav.exams", FileText],
        ["attendance", "nav.attendance", ShieldCheck],
        ["live", "nav.live", Video],
      ],
    },
    {
      label: "Account",
      items: [
        ["calendar", "nav.calendar", CalendarDays],
        ["messages", "nav.messages", MessageSquare],
        ["profile", "nav.profile", UserRound],
      ],
    },
  ],
  director: [
    {
      label: "Academy",
      items: [
        ["dashboard", "nav.overview", Home],
        ["students", "nav.students", Users],
        ["teachers", "nav.teachers", GraduationCap],
        ["classes", "nav.classes", Layers3],
        ["courses", "nav.courses", BookOpen],
        ["materials", "nav.materials", Library],
      ],
    },
    {
      label: "Learning",
      items: [
        ["assignments", "nav.assignments", ClipboardCheck],
        ["exams", "nav.exams", FileText],
        ["live", "nav.live", Video],
      ],
    },
    {
      label: "Operations",
      items: [
        ["payments", "nav.payments", CreditCard],
        ["payroll", "nav.payroll", Wallet],
        ["calendar", "nav.calendar", CalendarDays],
        ["messages", "nav.messages", MessageSquare],
        ["reports", "nav.reports", BarChart3],
        ["settings", "nav.settings", Settings],
      ],
    },
  ],
};

export function AppShell({ children }: { children: ReactNode }) {
  const { role, page, navigate, setRole, user, t, locale, setLocale } = useAcademy();
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState(false);
  if (!role || !user) return null;
  const sections = menus[role];
  const roleLabel =
    role === "director"
      ? t("shell.admin")
      : role === "teacher"
        ? t("shell.teacher")
        : t("shell.student");

  const sidebar = (
    <>
      <div className="flex h-[4.5rem] items-center justify-between gap-2 border-b border-sidebar-border px-4">
        <BrandLogo variant="compact" className="min-w-0" imgClassName="size-10" />
        <Button
          size="icon"
          variant="ghost"
          className="lg:hidden"
          onClick={() => setMobile(false)}
          aria-label={locale === "ar" ? "إغلاق القائمة" : "Fermer la navigation"}
        >
          <X className="size-5" />
        </Button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {sections.map((section, sectionIndex) => (
          <div key={section.label ?? sectionIndex}>
            {section.label && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    navigate(id);
                    setMobile(false);
                  }}
                  className={`nav-item ${page === id ? "nav-item-active" : ""}`}
                >
                  <Icon className="size-4 shrink-0 opacity-80" />
                  <span className="truncate">{t(label)}</span>
                  {id === "messages" && (
                    <span className="ml-auto size-1.5 rounded-full bg-alert" aria-hidden />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-muted/70 px-3 py-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <button type="button" className="nav-item" onClick={() => setRole(null)}>
          <LogOut className="size-4" />
          {t("nav.signout")}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="academy-sidebar fixed inset-y-0 left-0 z-40 hidden w-[16.5rem] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        {sidebar}
      </aside>
      {mobile && (
        <div
          className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobile(false)}
        >
          <aside
            className="flex h-full w-[18rem] flex-col bg-sidebar shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      )}
      <div className="academy-content lg:pl-[16.5rem]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-8">
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setMobile(true)}
            aria-label={locale === "ar" ? "فتح القائمة" : "Ouvrir la navigation"}
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium tracking-tight">{roleLabel}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{user.name}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="hidden gap-1 sm:flex" role="group" aria-label="Language">
              {(["fr", "ar"] as Locale[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    locale === code
                      ? "bg-soft-blue text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {localeLabels[code]}
                </button>
              ))}
            </div>
            <div className="relative">
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("shell.notifications")}
                onClick={() => {
                  setNotice(!notice);
                  if (!notice) void NotificationService.markAllRead();
                }}
              >
                <Bell className="size-4" />
                <span className="absolute top-2 right-2 size-1.5 rounded-full bg-alert" />
              </Button>
              {notice && (
                <div className="absolute top-12 right-0 w-[min(22rem,85vw)] rounded-xl border border-border bg-popover p-2 shadow-card animate-scale-in">
                  <div className="px-3 py-2 text-sm font-medium">{t("shell.notifications")}</div>
                  {notifications.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-lg px-3 py-3 hover:bg-muted">
                      <span
                        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${item.unread ? "bg-primary" : "bg-border"}`}
                      />
                      <div>
                        <p className="text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
