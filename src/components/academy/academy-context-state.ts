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
  /** Pass `profile` after Supabase auth so pending/restricted gates apply immediately. */
  signIn: (user: SessionUser, profile?: Profile | null) => void;
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
  /** Prefer `t(key)` for full i18n. Optional de/en fall back to French. */
  l: (fr: string, ar: string, de?: string, en?: string) => string;
  lastScore: ExamScore | null;
  setLastScore: (score: ExamScore | null) => void;
  session: PersistedSession | null;
  replaceSession: (next: PersistedSession | null) => void;
  /** Reload profile + session user from Supabase after self-edit. */
  refreshProfile: () => Promise<void>;
};

export const AcademyContext = createContext<AcademyState | null>(null);
