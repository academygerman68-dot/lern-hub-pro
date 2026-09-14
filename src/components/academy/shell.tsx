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
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifications } from "@/data/mock-data";
import { initials } from "@/lib/academy-logic";
import { localeLabels } from "@/lib/i18n";
import { NotificationService } from "@/services/academy-services";
import type { AcademyPage, Locale } from "@/types/academy";
import { useAcademy } from "./academy-context";

const menus = {
  student: [
    ["dashboard", "nav.home", Home],
    ["courses", "nav.learning", BookOpen],
    ["live", "nav.live", Video],
    ["assignments", "nav.assignments", ClipboardCheck],
    ["exams", "nav.exams", FileText],
    ["progress", "nav.progress", BarChart3],
    ["materials", "nav.materials", Library],
    ["calendar", "nav.calendar", CalendarDays],
    ["payments", "nav.payments", CreditCard],
    ["messages", "nav.messages", MessageSquare],
    ["profile", "nav.profile", UserRound],
  ],
  teacher: [
    ["dashboard", "nav.home", Home],
    ["classes", "nav.classes", Users],
    ["calendar", "nav.calendar", CalendarDays],
    ["lessons", "nav.lessons", BookOpen],
    ["materials", "nav.materials", Library],
    ["assignments", "nav.assignments", ClipboardCheck],
    ["exams", "nav.exams", FileText],
    ["attendance", "nav.attendance", ShieldCheck],
    ["messages", "nav.messages", MessageSquare],
    ["profile", "nav.profile", UserRound],
  ],
  director: [
    ["dashboard", "nav.overview", Home],
    ["students", "nav.students", Users],
    ["teachers", "nav.teachers", GraduationCap],
    ["classes", "nav.classes", Layers3],
    ["courses", "nav.courses", BookOpen],
    ["levels", "nav.levels", BarChart3],
    ["materials", "nav.materials", Library],
    ["assignments", "nav.assignments", ClipboardCheck],
    ["exams", "nav.exams", FileText],
    ["payments", "nav.payments", CreditCard],
    ["subscriptions", "nav.subscriptions", ShieldCheck],
    ["invoices", "nav.invoices", ReceiptText],
    ["calendar", "nav.calendar", CalendarDays],
    ["messages", "nav.messages", MessageSquare],
    ["reports", "nav.reports", BarChart3],
    ["settings", "nav.settings", Settings],
    ["audit", "nav.audit", ScrollText],
  ],
} as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { role, page, navigate, setRole, user, t, locale, setLocale } = useAcademy();
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState(false);
  if (!role || !user) return null;
  const name = user.name;
  const items = menus[role];

  const sidebar = (
    <>
      <div className="grid h-28 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-sidebar-border px-7">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-[18px] w-7 shrink-0 overflow-hidden rounded-[2px] border border-sidebar-foreground/15 shadow-soft"
            role="img"
            aria-label={locale === "ar" ? "علم ألمانيا" : "Drapeau allemand"}
          >
            <span className="bg-foreground" />
            <span className="bg-alert" />
            <span className="bg-primary" />
          </span>
          <div className="min-w-0">
            <strong className="block font-display text-lg font-normal leading-none">DEUTSCH</strong>
            <span className="mt-1 block text-[10px] font-medium tracking-[0.22em] text-sidebar-foreground/50">
              ACADEMY
            </span>
          </div>
        </div>
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
      <nav className="flex-1 overflow-y-auto px-4 py-6">
        {items.map(([id, label, Icon], index) => (
          <div key={id}>
            {((role === "student" && index === 6) ||
              (role !== "student" && [5, 9, 13].includes(index))) && (
              <div className="my-4 h-px bg-sidebar-border" />
            )}
            <button
              onClick={() => {
                navigate(id as AcademyPage);
                setMobile(false);
              }}
              className={`nav-item ${page === id ? "nav-item-active" : ""}`}
            >
              <Icon className="size-[17px]" />
              <span>{t(label)}</span>
              {id === "messages" && <span className="ml-auto size-1.5 rounded-full bg-alert" />}
            </button>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <button className="nav-item" onClick={() => setRole(null)}>
          <LogOut className="size-4" />
          {t("nav.signout")}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="academy-sidebar fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        {sidebar}
      </aside>
      {mobile && (
        <div
          className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-sm lg:hidden"
          onClick={() => setMobile(false)}
        >
          <aside
            className="flex h-full w-72 flex-col bg-sidebar shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      )}
       <div className="academy-content lg:pl-60">
        <header className="sticky top-0 z-30 grid h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-xl sm:px-8">
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setMobile(true)}
             aria-label={locale === "ar" ? "فتح القائمة" : "Ouvrir la navigation"}
          >
            <Menu className="size-5" />
          </Button>
          <div className="hidden min-w-0 text-xs text-muted-foreground sm:block">
            {role === "director"
              ? t("shell.admin")
              : role === "teacher"
                ? t("shell.teacher")
                : t("shell.student")}
          </div>
          <div className="col-start-3 flex items-center gap-2">
            <div className="hidden gap-1 sm:flex">
               {(["fr", "ar"] as Locale[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium ${locale === code ? "bg-secondary text-primary" : "text-muted-foreground"}`}
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
                <Bell />
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-alert" />
              </Button>
              {notice && (
                <div className="absolute right-0 top-12 w-[min(22rem,85vw)] rounded-xl border bg-popover p-2 shadow-card animate-scale-in">
                  <div className="px-3 py-2 text-sm font-medium">{t("shell.notifications")}</div>
                  {notifications.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-lg px-3 py-3 hover:bg-accent">
                      <span
                        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${item.unread ? "bg-primary" : "bg-border"}`}
                      />
                      <div>
                        <p className="text-sm">{item.title}</p>
                        <span className="text-xs text-muted-foreground">{item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-accent">
              <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-medium text-primary">
                {initials(name)}
              </span>
              <span className="hidden text-left md:block">
                <strong className="block text-xs font-medium">{name}</strong>
                <small className="capitalize text-muted-foreground">{t(`role.${role}`)}</small>
              </span>
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-5 sm:p-8 xl:p-12">{children}</main>
      </div>
    </div>
  );
}
