import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { translate } from "@/lib/i18n";
import {
  clearSession,
  loadSession,
  saveSession,
  startSession,
  type PersistedSession,
} from "@/services/academy-store";
import type {
  AcademyPage,
  ExamScore,
  Locale,
  NavigateOptions,
  Role,
  SessionUser,
  SubscriptionStatus,
} from "@/types/academy";

const LOCALE_KEY = "da-locale";

type AcademyState = {
  ready: boolean;
  user: SessionUser | null;
  role: Role | null;
  setRole: (role: Role | null) => void;
  signIn: (user: SessionUser) => void;
  page: AcademyPage;
  navigate: (page: AcademyPage, extra?: NavigateOptions) => void;
  subscription: SubscriptionStatus;
  setSubscription: (status: SubscriptionStatus) => void;
  examPublished: boolean;
  setExamPublished: (value: boolean) => void;
  selectedStudentId: string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  lastScore: ExamScore | null;
  setLastScore: (score: ExamScore | null) => void;
  session: PersistedSession | null;
  replaceSession: (next: PersistedSession | null) => void;
};

const AcademyContext = createContext<AcademyState | null>(null);

function readLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LOCALE_KEY);
  return stored === "fr" || stored === "de" || stored === "en" ? stored : "en";
}

export function AcademyProvider({ children }: { children: ReactNode }) {
  const routerNavigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<PersistedSession | null>(null);
  const [lastScore, setLastScore] = useState<ExamScore | null>(null);
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = loadSession();
    setSession(stored);
    setLocaleState(stored?.locale ?? readLocale());
    setReady(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
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
        persist(null);
        void routerNavigate({ to: "/" });
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
      lastScore,
      setLastScore,
      session,
      replaceSession: persist,
    }),
    [ready, session, lastScore, locale, setRole, signIn, navigate, persist],
  );

  return <AcademyContext.Provider value={value}>{children}</AcademyContext.Provider>;
}

export function useAcademy() {
  const value = useContext(AcademyContext);
  if (!value) throw new Error("AcademyProvider is missing");
  return value;
}
