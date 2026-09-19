export type BillingPlan = "monthly" | "quarterly";
export type BillingCurrency = "MAD" | "EUR";

export const BILLING_PLAN_AMOUNTS: Record<BillingPlan, Record<BillingCurrency, number>> = {
  monthly: { MAD: 1000, EUR: 100 },
  quarterly: { MAD: 2400, EUR: 240 },
};

export function isBillingPlan(value: string | null | undefined): value is BillingPlan {
  return value === "monthly" || value === "quarterly";
}

export function isBillingCurrency(value: string | null | undefined): value is BillingCurrency {
  return value === "MAD" || value === "EUR";
}

export function planAmount(plan: BillingPlan, currency: BillingCurrency): number {
  return BILLING_PLAN_AMOUNTS[plan][currency];
}

export function billingPlanLabel(plan: string | null | undefined): string {
  if (plan === "monthly") return "Mensuel";
  if (plan === "quarterly") return "Trimestriel";
  return "—";
}

export function formatMoneyAmount(amount: number, currency: string): string {
  const code = isBillingCurrency(currency) ? currency : currency.trim() || "MAD";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${Number(amount).toLocaleString("fr-FR")} ${code}`;
  }
}

/** `2026-09` for monthly, `2026-Q3` for quarterly. */
export function billingPeriodLabel(
  period: string | null | undefined,
  plan?: string | null,
): string {
  if (!period) return "—";
  const quarter = /^(\d{4})-Q([1-4])$/i.exec(period);
  if (quarter) {
    const year = quarter[1];
    const q = Number(quarter[2]);
    const ranges: Array<[string, string]> = [
      ["janvier", "mars"],
      ["avril", "juin"],
      ["juillet", "septembre"],
      ["octobre", "décembre"],
    ];
    const months = ranges[q - 1] ?? ["?", "?"];
    return `T${q} ${year} (${months[0]}–${months[1]})`;
  }
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (month) {
    const date = new Date(Number(month[1]), Number(month[2]) - 1, 1);
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }
  if (plan === "quarterly") return period;
  return period;
}

export function listBillingPeriods(plan: BillingPlan, count = 6, from = new Date()): string[] {
  const periods: string[] = [];
  if (plan === "monthly") {
    for (let i = 0; i < count; i += 1) {
      const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
      periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return periods;
  }
  const startQuarter = Math.floor(from.getMonth() / 3);
  for (let i = 0; i < count; i += 1) {
    const absolute = startQuarter + i;
    const year = from.getFullYear() + Math.floor(absolute / 4);
    const q = (absolute % 4) + 1;
    periods.push(`${year}-Q${q}`);
  }
  return periods;
}

/** Last day of the billing period as ISO date (YYYY-MM-DD). */
export function billingPeriodDueDate(period: string, plan: BillingPlan): string {
  const quarter = /^(\d{4})-Q([1-4])$/i.exec(period);
  if (plan === "quarterly" || quarter) {
    if (!quarter) throw new Error("Période trimestrielle invalide.");
    const year = Number(quarter[1]);
    const q = Number(quarter[2]);
    const endMonth = q * 3; // 3,6,9,12
    const lastDay = new Date(year, endMonth, 0);
    return toIsoDate(lastDay);
  }
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (!month) throw new Error("Mois à payer invalide.");
  const year = Number(month[1]);
  const m = Number(month[2]);
  const lastDay = new Date(year, m, 0);
  return toIsoDate(lastDay);
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
