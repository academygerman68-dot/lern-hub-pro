import { createContext } from "react";
import type { Profile } from "@/lib/roles";
import type { PersistedSession } from "@/services/academy-store";
import type {
  AcademyPage,
  ExamScore,
  Locale,
  NavigateOptions,
  Role,
  SessionUser,
  SubscriptionStatus,
} from "@/types/academy";

export type AcademyState = {
  ready: boolean;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  user: SessionUser | null;
  profile: Profile | null;
  role: Role | null;
  /** Logout when role is null. Role switching is disabled with Supabase Auth. */
  setRole: (role: Role | null) => void;
  signIn: (user: SessionUser) => void;
  signOut: () => Promise<void>;
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
  l: (fr: string, ar: string) => string;
  lastScore: ExamScore | null;
  setLastScore: (score: ExamScore | null) => void;
  session: PersistedSession | null;
  replaceSession: (next: PersistedSession | null) => void;
};

export const AcademyContext = createContext<AcademyState | null>(null);
