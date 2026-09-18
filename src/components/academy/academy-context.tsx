import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { isDemoAuthAllowed } from "@/lib/auth-config";
import { translate } from "@/lib/i18n";
import type { Profile } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/supabase";
import { AuthService, AccessService } from "@/services/academy-services";
import {
  clearSession,
  loadSession,
  saveSession,
  startSession,
  type PersistedSession,
} from "@/services/academy-store";
import { SupabaseAuthService } from "@/services/supabase/auth-service";
import { queryKeys } from "@/lib/query-keys";
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
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<PersistedSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
            const nextLocale = toUiLocale(auth.profile.language);
            const next = startSession(auth.sessionUser, { locale: nextLocale });
            setSession(next);
            setProfile(auth.profile);
            setLocaleState(nextLocale);
            if (auth.profile.role === "student" && auth.profile.status === "active") {
              void AccessService.recordFirstLogin()
                .then(() => {
                  void queryClient.invalidateQueries({ queryKey: queryKeys.access.me });
                  void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
                })
                .catch(() => undefined);
            }
          } else {
            clearSession();
            setSession(null);
            setProfile(null);
            setLocaleState(readLocale());
          }
        } catch {
          if (!cancelled) {
            clearSession();
            setSession(null);
            setProfile(null);
            setLocaleState(readLocale());
          }
        } finally {
          if (!cancelled) setReady(true);
        }
        return;
      }

      if (isDemoAuthAllowed(false)) {
        const stored = loadSession();
        if (!cancelled) {
          setSession(stored);
          setProfile(null);
          setLocaleState(toUiLocale(stored?.locale));
          setReady(true);
        }
        return;
      }

      if (!cancelled) {
        clearSession();
        setSession(null);
        setProfile(null);
        setLocaleState(readLocale());
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
    return SupabaseAuthService.onAuthStateChange((payload, event) => {
      if (event === "PASSWORD_RECOVERY") {
        void routerNavigate({ to: "/auth/reset-password" });
      }

      if (!payload) {
        queryClient.clear();
        setLastScore(null);
        for (const key of [
          "ga_active_exam_id",
          "ga_active_attempt_id",
          "ga_live_class_id",
          "ga_live_session_id",
        ]) {
          window.sessionStorage.removeItem(key);
        }
        clearSession();
        setSession(null);
        setProfile(null);
        if (event === "SIGNED_OUT") {
          void routerNavigate({ to: "/" });
        }
        return;
      }

      const nextLocale = toUiLocale(payload.profile.language);
      setProfile(payload.profile);
      setSession((prev) =>
        startSession(payload.sessionUser, {
          locale: nextLocale,
          ...(prev?.user.id === payload.sessionUser.id &&
          prev?.user.role === payload.sessionUser.role
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
      if (payload.profile.role === "student" && payload.profile.status === "active") {
        void AccessService.recordFirstLogin()
          .then(() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.access.me });
            void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
          })
          .catch(() => undefined);
      }
      setLocaleState(nextLocale);

      // Navigation is owned by login / OAuth callback / password-recovery handlers.
      // Avoid forcing redirects on TOKEN_REFRESHED / INITIAL_SESSION / SIGNED_IN here.
    });
  }, [routerNavigate, queryClient]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

  const persist = useCallback(
    (next: PersistedSession | null) => {
      setSession(next);
      if (next) saveSession({ ...next, lastScore: lastScore?.overall ?? null });
      else {
        clearSession();
        setProfile(null);
      }
    },
    [lastScore],
  );

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const auth = await SupabaseAuthService.getSession();
      if (!auth) return;
      const nextLocale = toUiLocale(auth.profile.language);
      setProfile(auth.profile);
      setSession((prev) =>
        startSession(auth.sessionUser, {
          locale: nextLocale,
          ...(prev?.user.id === auth.sessionUser.id && prev?.user.role === auth.sessionUser.role
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
      setLocaleState(nextLocale);
    } catch {
      /* keep current session */
    }
  }, []);

  const go = useCallback(
    (role: Role, page: AcademyPage, extra?: NavigateOptions) => {
      void routerNavigate({
        to: "/app/$role/$page",
        params: { role, page },
        search: extra ?? {},
      });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [routerNavigate],
  );

  const signIn = useCallback(
    (user: SessionUser) => {
      queryClient.clear();
      setLastScore(null);
      const next = startSession(user, { locale });
      persist(next);
      go(user.role, "dashboard");
    },
    [go, persist, locale, queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await AuthService.logout();
    } finally {
      queryClient.clear();
      setLastScore(null);
      persist(null);
      setProfile(null);
      void routerNavigate({ to: "/" });
    }
  }, [persist, routerNavigate, queryClient]);

  const setRole = useCallback(
    (role: Role | null) => {
      if (!role) {
        void signOut();
        return;
      }
      if (isSupabaseConfigured || !isDemoAuthAllowed(false)) {
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
    [signIn, signOut],
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
      isAuthenticated: Boolean(session?.user),
      isAuthLoading: !ready,
      user: session?.user ?? null,
      profile,
      role: session?.user.role ?? null,
      setRole,
      signIn,
      signOut,
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
      refreshProfile,
    }),
    [
      ready,
      session,
      profile,
      lastScore,
      locale,
      setRole,
      signIn,
      signOut,
      navigate,
      persist,
      refreshProfile,
    ],
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
