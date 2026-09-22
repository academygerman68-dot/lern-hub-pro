import {
  type BillingCurrency,
  type BillingPlan,
  amountToMad,
  billingPeriodDueDate,
  billingPeriodLabel,
  billingPlanLabel,
  currentBillingPeriod,
  formatMoneyAmount,
  isBillingCurrency,
  isBillingPlan,
  planAmount,
  resolvePlanAmount,
  type BillingTariffMap,
  resolveSubscriptionBilling,
} from "./subscription-plans";

export type InstallmentUxStatus = "due" | "pending_review" | "validated" | "rejected" | "overdue";

export type InstallmentUxFilter = "all" | "due" | "pending" | "validated";

export const PAYMENT_REJECTION_REASONS = [
  { id: "wrong_amount", label: "Montant incorrect" },
  { id: "unreadable_proof", label: "Justificatif illisible" },
  { id: "payment_not_found", label: "Paiement introuvable" },
  { id: "wrong_period", label: "Mauvaise période" },
  { id: "other", label: "Autre" },
] as const;

export type PaymentRejectionReasonId = (typeof PAYMENT_REJECTION_REASONS)[number]["id"];

export function installmentUxLabel(status: InstallmentUxStatus): string {
  if (status === "due") return "À régler";
  if (status === "pending_review") return "En attente de vérification";
  if (status === "validated") return "Validé";
  if (status === "rejected") return "Refusé";
  return "En retard";
}

export function installmentUxTone(
  status: InstallmentUxStatus,
): "green" | "amber" | "red" | "blue" | "gray" {
  if (status === "validated") return "green";
  if (status === "pending_review") return "amber";
  if (status === "due") return "blue";
  return "red";
}

type ProofLike = {
  payment_id?: string | null;
  status: string;
  created_at?: string;
  submitted_at?: string | null;
  mime_type?: string | null;
  admin_receipt_path?: string | null;
  admin_receipt_mime?: string | null;
  admin_receipt_bucket?: string | null;
};

type PaymentLike = {
  id: string;
  status: string;
  amount: number | string;
  amount_paid?: number | string | null;
  currency: string;
  due_date?: string | null;
  billing_plan?: string | null;
  billing_period?: string | null;
  payment_date?: string | null;
  created_at?: string;
  admin_receipt_path?: string | null;
};

export function latestProofForPayment<T extends ProofLike>(
  proofs: T[],
  paymentId: string,
): T | null {
  const rows = proofs
    .filter((p) => p.payment_id === paymentId)
    .sort((a, b) => {
      const aAt = a.submitted_at ?? a.created_at ?? "";
      const bAt = b.submitted_at ?? b.created_at ?? "";
      return bAt.localeCompare(aAt);
    });
  return rows[0] ?? null;
}

export function resolveInstallmentUxStatus(
  payment: PaymentLike,
  proof: ProofLike | null | undefined,
  today = new Date(),
): InstallmentUxStatus {
  if (payment.status === "paid") return "validated";
  if (proof?.status === "approved") return "validated";
  if (proof?.status === "pending" || proof?.status === "not_approved") return "pending_review";
  if (proof?.status === "rejected") return "rejected";
  if (payment.status === "overdue") return "overdue";
  if (payment.due_date) {
    const due = new Date(`${payment.due_date}T23:59:59`);
    if (!Number.isNaN(due.getTime()) && due < today && payment.status !== "paid") {
      return "overdue";
    }
  }
  return "due";
}

export function matchesInstallmentFilter(
  status: InstallmentUxStatus,
  filter: InstallmentUxFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "due") return status === "due" || status === "overdue" || status === "rejected";
  if (filter === "pending") return status === "pending_review";
  return status === "validated";
}

export function pickNextInstallment<T extends PaymentLike>(
  payments: T[],
  proofs: ProofLike[],
): { payment: T; status: InstallmentUxStatus; proof: ProofLike | null } | null {
  const ranked = payments
    .map((payment) => {
      const proof = latestProofForPayment(proofs, payment.id);
      const status = resolveInstallmentUxStatus(payment, proof);
      return { payment, proof, status };
    })
    .filter((row) => row.status !== "validated")
    .sort((a, b) => {
      const aDue = a.payment.due_date ?? a.payment.billing_period ?? "";
      const bDue = b.payment.due_date ?? b.payment.billing_period ?? "";
      return aDue.localeCompare(bDue);
    });
  return ranked[0] ?? null;
}

export function buildVirtualNextInstallment(input: {
  plan: BillingPlan;
  currency: BillingCurrency;
  period?: string;
  tariffs?: BillingTariffMap | null;
}): {
  period: string;
  amount: number;
  currency: BillingCurrency;
  plan: BillingPlan;
  dueDate: string;
  status: InstallmentUxStatus;
} {
  const period = input.period ?? currentBillingPeriod(input.plan);
  return {
    period,
    amount: resolvePlanAmount(input.plan, input.currency, input.tariffs),
    currency: input.currency,
    plan: input.plan,
    dueDate: billingPeriodDueDate(period, input.plan),
    status: "due",
  };
}

export function formatRejectionAdminNote(
  reasonId: PaymentRejectionReasonId,
  comment?: string | null,
): string {
  const reason = PAYMENT_REJECTION_REASONS.find((row) => row.id === reasonId)?.label ?? "Autre";
  const extra = comment?.trim();
  return extra ? `${reason} — ${extra}` : reason;
}

export function subscriptionAccessLabel(status: string | null | undefined): string {
  if (
    status === "active" ||
    status === "grace_period" ||
    status === "manually_extended" ||
    status === "ACTIVE"
  ) {
    return "Abonnement actif";
  }
  if (status === "past_due" || status === "PAST_DUE") return "Accès en retard";
  if (status === "suspended" || status === "SUSPENDED") return "Accès suspendu";
  if (status === "cancelled") return "Abonnement annulé";
  return "Accès à vérifier";
}

export function summarizePaymentRow(row: PaymentLike) {
  const plan = isBillingPlan(row.billing_plan) ? row.billing_plan : null;
  const currency = isBillingCurrency(row.currency) ? row.currency : row.currency || "MAD";
  return {
    planLabel: billingPlanLabel(plan),
    periodLabel: billingPeriodLabel(row.billing_period, plan),
    currency,
    expected: formatMoneyAmount(Number(row.amount ?? 0), currency),
    paid: formatMoneyAmount(Number(row.amount_paid ?? 0), currency),
  };
}

export function resolveActiveBillingFromSubscription(
  sub:
    | {
        billing_plan?: string | null;
        billing_currency?: string | null;
        pending_billing_plan?: string | null;
        pending_billing_currency?: string | null;
        plan_change_effective_period?: string | null;
        status?: string | null;
      }
    | null
    | undefined,
  tariffs?: BillingTariffMap | null,
): {
  plan: BillingPlan;
  currency: BillingCurrency;
  amount: number;
  pendingEffectivePeriod: string | null;
  pendingPlan: BillingPlan | null;
  pendingCurrency: BillingCurrency | null;
} {
  const resolved = resolveSubscriptionBilling(sub ?? {});
  return {
    plan: resolved.plan,
    currency: resolved.currency,
    amount: resolvePlanAmount(resolved.plan, resolved.currency, tariffs),
    pendingEffectivePeriod: resolved.pendingEffectivePeriod,
    pendingPlan: isBillingPlan(sub?.pending_billing_plan) ? sub!.pending_billing_plan : null,
    pendingCurrency: isBillingCurrency(sub?.pending_billing_currency)
      ? sub!.pending_billing_currency
      : null,
  };
}

export {
  amountToMad,
  billingPeriodLabel,
  billingPlanLabel,
  formatMoneyAmount,
  planAmount,
  type BillingCurrency,
  type BillingPlan,
};
