import { useEffect, useState, type ReactNode } from "react";
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
  Film,
  Settings,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/academy-logic";
import { localeLabels } from "@/lib/i18n";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/use-academy-data";
import type { AcademyPage, Locale } from "@/types/academy";
import { useAcademy } from "./academy-context";

type NavItem = readonly [AcademyPage, string, typeof Home];
type NavSection = { label?: string; items: NavItem[] };

const menus: Record<"student" | "teacher" | "director", NavSection[]> = {
  student: [
    {
      label: "nav.section.learning",
      items: [
        ["dashboard", "nav.home", Home],
        ["courses", "nav.courses", BookOpen],
        ["materials", "nav.materials", Library],
        ["assignments", "nav.assignments", ClipboardCheck],
        ["exams", "nav.exams", FileText],
        ["progress", "nav.progress", BarChart3],
        ["live", "nav.live", Video],
        ["calendar", "nav.calendar", CalendarDays],
        ["recordings", "nav.recordings", Film],
      ],
    },
    {
      label: "nav.section.account",
      items: [
        ["payments", "nav.payments", CreditCard],
        ["messages", "nav.messages", MessageSquare],
        ["profile", "nav.profile", UserRound],
        ["settings", "nav.settings", Settings],
      ],
    },
  ],
  teacher: [
    {
      label: "nav.section.teaching",
      items: [
        ["dashboard", "nav.home", Home],
        ["classes", "nav.classes", Users],
        ["students", "nav.students", GraduationCap],
        ["courses", "nav.courses", BookOpen],
        ["materials", "nav.materials", Library],
        ["assignments", "nav.assignments", ClipboardCheck],
        ["exams", "nav.exams", FileText],
        ["live", "nav.live", Video],
        ["recordings", "nav.recordings", Film],
      ],
    },
    {
      label: "nav.section.account",
      items: [
        ["calendar", "nav.calendar", CalendarDays],
        ["messages", "nav.messages", MessageSquare],
        ["profile", "nav.profile", UserRound],
        ["settings", "nav.settings", Settings],
      ],
    },
  ],
  director: [
    {
      label: "nav.section.academy",
      items: [
        ["dashboard", "nav.overview", Home],
        ["students", "nav.students", Users],
        ["teachers", "nav.teachers", GraduationCap],
        ["classes", "nav.groups", Layers3],
        ["courses", "nav.courses", BookOpen],
        ["materials", "nav.materials", Library],
      ],
    },
    {
      label: "nav.section.learning",
      items: [
        ["assignments", "nav.assignments", ClipboardCheck],
        ["exams", "nav.exams", FileText],
        ["live", "nav.live", Video],
        ["recordings", "nav.recordings", Film],
      ],
    },
    {
      label: "nav.section.operations",
      items: [
        ["payments", "nav.payments", CreditCard],
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
  const notificationsQuery = useNotifications();
  const unreadQuery = useUnreadNotificationCount();
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();

  useEffect(() => {
    if (!mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobile]);

  useEffect(() => {
    setMobile(false);
    setNotice(false);
  }, [page]);

  if (!role || !user) return null;
  const sections = menus[role];
  const roleLabel =
    role === "director"
      ? t("shell.admin")
      : role === "teacher"
        ? t("shell.teacher")
        : t("shell.student");
  const unread = unreadQuery.data ?? 0;
  const notificationRows = notificationsQuery.data ?? [];

  const languageSwitch = (
    <div className="flex gap-1" role="group" aria-label="Language">
      {(["fr", "ar"] as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={`min-h-9 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
            locale === code ? "bg-soft-blue text-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {localeLabels[code]}
        </button>
      ))}
    </div>
  );

  const sidebar = (
    <>
      <div className="flex h-[4.5rem] items-center justify-between gap-2 border-b border-sidebar-border px-4 pt-[env(safe-area-inset-top,0px)]">
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
      <nav className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-5">
        {sections.map((section, sectionIndex) => (
          <div key={section.label ?? sectionIndex}>
            {section.label && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {t(section.label)}
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
      <div className="border-t border-sidebar-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <div className="mb-3 flex items-center justify-between gap-2 px-1 lg:hidden">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">
            {t("shell.language")}
          </span>
          {languageSwitch}
        </div>
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-muted/70 px-3 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
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
    <div className="min-h-dvh bg-background">
      <aside className="academy-sidebar fixed inset-y-0 left-0 z-40 hidden w-[16.5rem] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        {sidebar}
      </aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
            aria-label={locale === "ar" ? "إغلاق" : "Fermer"}
            onClick={() => setMobile(false)}
          />
          <aside className="relative flex h-full w-[min(18.5rem,88vw)] flex-col bg-sidebar text-sidebar-foreground shadow-card animate-slide-in-left">
            {sidebar}
          </aside>
        </div>
      )}
      <div className="academy-content lg:pl-[16.5rem]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/80 bg-background/85 px-3 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-8 pt-[env(safe-area-inset-top,0px)]">
          <Button
            size="icon"
            variant="ghost"
            className="min-h-11 min-w-11 shrink-0 lg:hidden"
            onClick={() => setMobile(true)}
            aria-label={locale === "ar" ? "فتح القائمة" : "Ouvrir la navigation"}
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">{roleLabel}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{user.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden sm:flex">{languageSwitch}</div>
            <div className="relative">
              <Button
                size="icon"
                variant="ghost"
                className="relative min-h-11 min-w-11"
                aria-label={t("shell.notifications")}
                onClick={() => {
                  const next = !notice;
                  setNotice(next);
                  if (next && unread > 0) markAllRead.mutate();
                }}
              >
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-semibold text-alert-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Button>
              {notice && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 sm:hidden"
                    aria-label={locale === "ar" ? "إغلاق" : "Fermer"}
                    onClick={() => setNotice(false)}
                  />
                  <div className="absolute top-12 right-0 z-50 w-[min(22rem,calc(100vw-1.25rem))] max-h-[min(70dvh,28rem)] overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-card animate-scale-in">
                    <div className="px-3 py-2 text-sm font-semibold tracking-tight">
                      {t("shell.notifications")}
                    </div>
                    {notificationRows.length === 0 && (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {locale === "ar"
                          ? "لا إشعارات بعد."
                          : "Aucune notification pour le moment."}
                      </p>
                    )}
                    {notificationRows.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="flex w-full gap-3 rounded-lg px-3 py-3 text-left transition-colors duration-150 hover:bg-muted active:bg-muted"
                        onClick={() => {
                          if (item.status === "unread") markRead.mutate(item.id);
                          if (item.link_page) navigate(item.link_page as AcademyPage);
                          setNotice(false);
                        }}
                      >
                        <span
                          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                            item.status === "unread" ? "bg-primary" : "bg-border"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.message}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleString(
                              locale === "ar" ? "ar" : "fr-FR",
                            )}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-[72rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
