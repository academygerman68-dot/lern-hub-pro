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
  Settings,
  Shield,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/academy-logic";
import { localeDateTag } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationsRealtime,
  useUnreadNotificationCount,
} from "@/hooks/use-academy-data";
import type { AcademyPage } from "@/types/academy";
import { useAcademy } from "./academy-context";
import { StudentMobileTabBar } from "./student-mobile-tabbar";
import { ThemeToggle } from "./theme-toggle";

type NavItem = readonly [AcademyPage, string, typeof Home];
type NavSection = { label?: string; items: NavItem[] };

const menus: Record<"student" | "teacher" | "director", NavSection[]> = {
  student: [
    {
      label: "nav.section.learning",
      items: [
        ["dashboard", "nav.home", Home],
        ["materials", "nav.materials", Library],
        ["assignments", "nav.assignments", ClipboardCheck],
        ["exams", "nav.exams", FileText],
        ["courses", "nav.courses", BookOpen],
        ["progress", "nav.progress", BarChart3],
        ["live", "nav.live", Video],
        ["calendar", "nav.calendar", CalendarDays],
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
        ["corrections", "nav.corrections", ClipboardCheck],
        ["live", "nav.live", Video],
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
        ["accounts", "nav.accounts", Shield],
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
        ["corrections", "nav.corrections", ClipboardCheck],
        ["live", "nav.live", Video],
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

/** Exposed for regression tests: Examens blancs must stay in every role sidebar. */
export function shellNavPageIds(role: "student" | "teacher" | "director"): AcademyPage[] {
  return menus[role].flatMap((section) => section.items.map(([id]) => id));
}

export function AppShell({ children }: { children: ReactNode }) {
  const { role, page, navigate, setRole, user, t, locale } = useAcademy();
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState(false);
  const notificationsQuery = useNotifications();
  const unreadQuery = useUnreadNotificationCount();
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();
  useNotificationsRealtime();

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

  const languageSwitch = <LanguageSwitcher compact />;

  const sidebar = (
    <>
      <div className="flex h-[4.5rem] items-center justify-between gap-2 border-b border-sidebar-border px-4 pt-[env(safe-area-inset-top,0px)]">
        <BrandLogo
          variant="compact"
          inverted
          showWordmark
          className="min-w-0"
          imgClassName="size-10 rounded-full border border-gold/40 bg-white/10 p-0.5"
        />
        <Button
          size="icon"
          variant="ghost"
          className="text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
          onClick={() => setMobile(false)}
          aria-label={t("shell.closeNav")}
        >
          <X className="size-5" />
        </Button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-5">
        {sections.map((section, sectionIndex) => (
          <div key={section.label ?? sectionIndex}>
            {section.label && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-sidebar-foreground/45 uppercase">
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
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <div className="mb-3 flex flex-col gap-2 px-1">
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <span className="text-[11px] font-medium text-sidebar-foreground/50 uppercase">
              {t("shell.theme")}
            </span>
            <ThemeToggle showLabels />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-sidebar-foreground/50 uppercase">
              {t("shell.language")}
            </span>
            {languageSwitch}
          </div>
        </div>
        <div className="mb-2 flex items-center gap-3 rounded-md border border-sidebar-border bg-sidebar-accent/60 px-3 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold text-[11px] font-semibold text-primary">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/55">{user.email}</p>
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
            aria-label={t("shell.close")}
            onClick={() => setMobile(false)}
          />
          <aside className="relative flex h-full w-[min(18.5rem,88vw)] flex-col bg-sidebar text-sidebar-foreground shadow-card animate-slide-in-left">
            {sidebar}
          </aside>
        </div>
      )}
      <div className="academy-content lg:pl-[16.5rem]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/80 bg-background/90 px-3 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-8 pt-[env(safe-area-inset-top,0px)]">
          <span
            className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"
            aria-hidden="true"
          />
          <Button
            size="icon"
            variant="ghost"
            className="min-h-11 min-w-11 shrink-0 lg:hidden"
            onClick={() => setMobile(true)}
            aria-label={t("shell.openNav")}
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-medium tracking-tight sm:text-lg">
              German Academy
            </p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {roleLabel} · {user.name}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
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
                    aria-label={t("shell.close")}
                    onClick={() => setNotice(false)}
                  />
                  <div className="absolute top-12 right-0 z-50 w-[min(22rem,calc(100vw-1.25rem))] max-h-[min(70dvh,28rem)] overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-card animate-scale-in">
                    <div className="px-3 py-2 text-sm font-semibold tracking-tight">
                      {t("shell.notifications")}
                    </div>
                    {notificationRows.length === 0 && (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {t("shell.notifications.empty")}
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
                            {new Date(item.created_at).toLocaleString(localeDateTag[locale])}
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
        <main
          className={`px-3 py-5 sm:px-8 sm:py-8 ${
            role === "student"
              ? "pb-[max(5.5rem,calc(4.25rem+env(safe-area-inset-bottom,0px)))] lg:pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]"
              : "pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]"
          }`}
        >
          <div className="mx-auto w-full max-w-[72rem] animate-fade-in">{children}</div>
        </main>
        {role === "student" ? <StudentMobileTabBar /> : null}
      </div>
    </div>
  );
}
