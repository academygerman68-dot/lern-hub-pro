import { invoices as seedInvoices } from "@/data/mock-data";
import type {
  AcademyPage,
  InvoiceRecord,
  Locale,
  Role,
  SessionUser,
  SubscriptionStatus,
} from "@/types/academy";

const SESSION_KEY = "da-session";

export type PersistedSession = {
  user: SessionUser;
  page: AcademyPage;
  subscription: SubscriptionStatus;
  examPublished: boolean;
  selectedStudentId: string;
  locale: Locale;
  invoices: InvoiceRecord[];
  lastScore: number | null;
};

const defaultSession = (user: SessionUser): PersistedSession => ({
  user,
  page: "dashboard",
  subscription: "ACTIVE",
  examPublished: false,
  selectedStudentId: "ST-001",
  locale: "en",
  invoices: seedInvoices,
  lastScore: null,
});

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadSession(): PersistedSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed.user?.role) return null;
    return {
      ...defaultSession(parsed.user),
      ...parsed,
      invoices: parsed.invoices?.length ? parsed.invoices : seedInvoices,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: PersistedSession) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function startSession(
  user: SessionUser,
  extras?: Partial<PersistedSession>,
): PersistedSession {
  const session = { ...defaultSession(user), ...extras };
  saveSession(session);
  return session;
}

export function recordPayment(session: PersistedSession, role: Role): PersistedSession {
  const now = new Date();
  const invoice: InvoiceRecord = {
    id: `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getTime()).slice(-3)}`,
    studentId: role === "student" ? "ST-001" : session.selectedStudentId,
    studentName: session.user.name,
    period: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
    amount: 1200,
    date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    status: "PAID",
  };
  const next = {
    ...session,
    subscription: "ACTIVE" as const,
    invoices: [invoice, ...session.invoices],
  };
  saveSession(next);
  return next;
}
