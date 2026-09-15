import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { translate } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase";
import { AuthService } from "@/services/academy-services";
import {
  clearSession,
  loadSession,
  saveSession,
  startSession,
  type PersistedSession,
} from "@/services/academy-store";
import { SupabaseAuthService } from "@/services/supabase/auth-service";
import type {
  AcademyPage,
  ExamScore,
  Locale,
  NavigateOptions,
  Role,
  SessionUser,
} from "@/types/academy";
import { InterfaceLocalizer } from "./interface-localizer";
import { AcademyContext, type AcademyState } from "./academy-context-state";

const LOCALE_KEY = "da-locale";

function readLocale(): Locale {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(LOCALE_KEY);
  return stored === "fr" || stored === "ar" ? stored : "fr";
}

/** UI is FR/AR; Supabase profiles use app_locale en|fr|de. */
function toUiLocale(value?: string | null): Locale {
  if (value === "ar" || value === "fr") return value;
  return readLocale();
}

export function AcademyProvider({ children }: { children: ReactNode }) {
  const routerNavigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<PersistedSession | null>(null);
  const [lastScore, setLastScore] = useState<ExamScore | null>(null);
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (isSupabaseConfigured) {
        try {
          const auth = await SupabaseAuthService.getSession();
          if (cancelled) return;
          if (auth) {
            const locale = toUiLocale(auth.profile.language);
            const next = startSession(auth.sessionUser, { locale });
            setSession(next);
            setLocaleState(locale);
          } else {
            clearSession();
            setSession(null);
            setLocaleState(readLocale());
          }
        } catch {
          if (!cancelled) {
            clearSession();
            setSession(null);
            setLocaleState(readLocale());
          }
        } finally {
          if (!cancelled) setReady(true);
        }
        return;
      }

      const stored = loadSession();
      if (!cancelled) {
        setSession(stored);
        setLocaleState(toUiLocale(stored?.locale));
        setReady(true);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    return SupabaseAuthService.onAuthStateChange((payload) => {
      if (!payload) {
        clearSession();
        setSession(null);
        void routerNavigate({ to: "/" });
        return;
      }
      const locale = toUiLocale(payload.profile.language);
      setSession((prev) =>
        startSession(payload.sessionUser, {
          locale,
          ...(prev
            ? {
                page: prev.page,
                invoices: prev.invoices,
                subscription: prev.subscription,
                examPublished: prev.examPublished,
                selectedStudentId: prev.selectedStudentId,
              }
            : {}),
        }),
      );
      setLocaleState(locale);
    });
  }, [routerNavigate]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

  const persist = useCallback(
    (next: PersistedSession | null) => {
      setSession(next);
      if (next) saveSession({ ...next, locale, lastScore: lastScore?.overall ?? null });
      else clearSession();
    },
    [locale, lastScore],
  );

  const go = useCallback(
    (role: Role, page: AcademyPage, extra?: NavigateOptions) => {
      void routerNavigate({
        to: "/app/$role/$page",
        params: { role, page },
        search: extra?.studentId ? { studentId: extra.studentId } : {},
      });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [routerNavigate],
  );

  const signIn = useCallback(
    (user: SessionUser) => {
      const next = startSession(
        user,
        session ? { locale, invoices: session.invoices } : { locale },
      );
      persist(next);
      go(user.role, "dashboard");
    },
    [go, persist, session, locale],
  );

  const setRole = useCallback(
    (role: Role | null) => {
      if (!role) {
        void AuthService.logout().finally(() => {
          persist(null);
          void routerNavigate({ to: "/" });
        });
        return;
      }
      if (isSupabaseConfigured) {
        // Role switching without credentials is not allowed with real Auth.
        return;
      }
      const name =
        role === "student"
          ? "Ahmed Benali"
          : role === "teacher"
            ? "Anna Schneider"
            : "Samira El Mansouri";
      const email =
        role === "student"
          ? "ahmed@demo.ma"
          : role === "teacher"
            ? "anna@demo.ma"
            : "samira@demo.ma";
      signIn({ role, name, email });
    },
    [persist, routerNavigate, signIn],
  );

  const navigate = useCallback(
    (page: AcademyPage, extra?: NavigateOptions) => {
      if (!session) return;
      persist({
        ...session,
        page,
        selectedStudentId: extra?.studentId ?? session.selectedStudentId,
        locale,
      });
      go(session.user.role, page, extra);
    },
    [go, persist, session, locale],
  );

  const value = useMemo<AcademyState>(
    () => ({
      ready,
      user: session?.user ?? null,
      role: session?.user.role ?? null,
      setRole,
      signIn,
      page: session?.page ?? "dashboard",
      navigate,
      subscription: session?.subscription ?? "ACTIVE",
      setSubscription: (status) => {
        if (session) persist({ ...session, subscription: status, locale });
      },
      examPublished: session?.examPublished ?? false,
      setExamPublished: (value) => {
        if (session) persist({ ...session, examPublished: value, locale });
      },
      selectedStudentId: session?.selectedStudentId ?? "ST-001",
      locale,
      setLocale: (nextLocale) => {
        setLocaleState(nextLocale);
        if (session) persist({ ...session, locale: nextLocale });
      },
      t: (key) => translate(locale, key),
      l: (fr, ar) => (locale === "ar" ? ar : fr),
      lastScore,
      setLastScore,
      session,
      replaceSession: persist,
    }),
    [ready, session, lastScore, locale, setRole, signIn, navigate, persist],
  );

  return (
    <AcademyContext.Provider value={value}>
      <InterfaceLocalizer locale={locale} />
      {children}
    </AcademyContext.Provider>
  );
}

export function useAcademy() {
  const value = useContext(AcademyContext);
  if (!value) throw new Error("AcademyProvider is missing");
  return value;
}
