import { createContext, useContext, useState, type ReactNode } from "react";
import type { Role, SubscriptionStatus } from "@/types/academy";

type AcademyState = {
  role: Role | null;
  setRole: (role: Role | null) => void;
  page: string;
  navigate: (page: string) => void;
  subscription: SubscriptionStatus;
  setSubscription: (status: SubscriptionStatus) => void;
  examPublished: boolean;
  setExamPublished: (value: boolean) => void;
};

const AcademyContext = createContext<AcademyState | null>(null);

export function AcademyProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [page, setPage] = useState("dashboard");
  const [subscription, setSubscription] = useState<SubscriptionStatus>("ACTIVE");
  const [examPublished, setExamPublished] = useState(false);
  const setRole = (next: Role | null) => { setRoleState(next); setPage("dashboard"); };
  const navigate = (next: string) => { setPage(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return <AcademyContext.Provider value={{ role, setRole, page, navigate, subscription, setSubscription, examPublished, setExamPublished }}>{children}</AcademyContext.Provider>;
}

export function useAcademy() {
  const value = useContext(AcademyContext);
  if (!value) throw new Error("AcademyProvider is missing");
  return value;
}