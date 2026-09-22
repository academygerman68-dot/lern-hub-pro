export type BillingPlan = "monthly" | "quarterly";
export type BillingCurrency = "MAD" | "EUR";

/** Fixed reporting FX: 1 EUR = 10 MAD (chiffre d'affaires). */
export const EUR_TO_MAD_RATE = 10;

/** Fallback when settings are unavailable — catalogue commercial courant. */
export const BILLING_PLAN_AMOUNT_FALLBACKS: Record<BillingPlan, Record<BillingCurrency, number>> = {
  monthly: { MAD: 1000, EUR: 100 },
  quarterly: { MAD: 2400, EUR: 240 },
};

/** @deprecated Use resolvePlanAmount / settings; kept as alias of fallbacks for older imports. */
export const BILLING_PLAN_AMOUNTS = BILLING_PLAN_AMOUNT_FALLBACKS;

export type BillingTariffMap = Partial<
  Record<BillingPlan, Partial<Record<BillingCurrency, number>>>
>;

export function isBillingPlan(value: string | null | undefined): value is BillingPlan {
  return value === "monthly" || value === "quarterly";
}

export function isBillingCurrency(value: string | null | undefined): value is BillingCurrency {
  return value === "MAD" || value === "EUR";
}

export function planAmount(plan: BillingPlan, currency: BillingCurrency): number {
  return BILLING_PLAN_AMOUNT_FALLBACKS[plan][currency];
}

export function resolvePlanAmount(
  plan: BillingPlan,
  currency: BillingCurrency,
  tariffs?: BillingTariffMap | null,
): number {
  const configured = tariffs?.[plan]?.[currency];
  if (typeof configured === "number" && Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return planAmount(plan, currency);
}

/** Convert any payment amount to MAD for CA / turnover aggregation. */
export function amountToMad(
  amount: number,
  currency: string | null | undefined,
  eurToMadRate: number = EUR_TO_MAD_RATE,
): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const code = (currency ?? "MAD").trim().toUpperCase();
  if (code === "EUR") {
    const rate = Number.isFinite(eurToMadRate) && eurToMadRate > 0 ? eurToMadRate : EUR_TO_MAD_RATE;
    return Math.round(n * rate * 100) / 100;
  }
  return n;
}

/** Normalize public settings from listPublic (rows) or getMap (Record) — never throw. */
export function normalizeAppSettingRows(
  rows:
    | Array<{ key: string; value: unknown }>
    | Record<string, unknown>
    | null
    | undefined,
): Array<{ key: string; value: unknown }> {
  if (rows == null) return [];
  if (Array.isArray(rows)) return rows;
  if (typeof rows === "object") {
    return Object.entries(rows).map(([key, value]) => ({ key, value }));
  }
  return [];
}

export function parseBillingTariffSettings(
  rows:
    | Array<{ key: string; value: unknown }>
    | Record<string, unknown>
    | null
    | undefined,
): BillingTariffMap {
  const out: BillingTariffMap = {};
  for (const row of normalizeAppSettingRows(rows)) {
    const match = /^billing_tariff_(monthly|quarterly)_(MAD|EUR)$/.exec(row.key);
    if (!match) continue;
    const plan = match[1] as BillingPlan;
    const currency = match[2] as BillingCurrency;
    let amount: number | null = null;
    const raw = row.value;
    if (typeof raw === "number") amount = raw;
    else if (typeof raw === "string") amount = Number(raw);
    else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      // jsonb number sometimes stored as plain JSON number already handled above;
      // object shapes are ignored (no silent invented amount from {}.value).
      const nested = (raw as { amount?: unknown; value?: unknown }).amount
        ?? (raw as { value?: unknown }).value;
      amount = typeof nested === "number" || typeof nested === "string" ? Number(nested) : null;
    }
    if (amount == null || !Number.isFinite(amount) || amount <= 0) continue;
    out[plan] = { ...(out[plan] ?? {}), [currency]: amount };
  }
  return out;
}

export function parseEurToMadRate(
  rows:
    | Array<{ key: string; value: unknown }>
    | Record<string, unknown>
    | null
    | undefined,
): number {
  const list = normalizeAppSettingRows(rows);
  const row = list.find((r) => r.key === "billing_fx_eur_to_mad");
  if (!row) return EUR_TO_MAD_RATE;
  const raw = row.value;
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : Number(raw as never);
  return Number.isFinite(n) && n > 0 ? n : EUR_TO_MAD_RATE;
}

/** Expand stored billing_period into calendar months YYYY-MM. */
export function billingPeriodMonths(period: string | null | undefined): string[] {
  if (!period?.trim()) return [];
  if (/^\d{4}-\d{2}$/.test(period)) return [period];
  const range = /^(\d{4}-\d{2})\/(\d{4}-\d{2})$/.exec(period);
  if (range) {
    const [sy, sm] = range[1]!.split("-").map(Number);
    const [ey, em] = range[2]!.split("-").map(Number);
    const months: string[] = [];
    let y = sy!;
    let m = sm!;
    while (y < ey! || (y === ey && m <= em!)) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return months;
  }
  const quarter = /^(\d{4})-Q([1-4])$/i.exec(period);
  if (quarter) {
    const year = Number(quarter[1]);
    const q = Number(quarter[2]);
    const start = (q - 1) * 3 + 1;
    return [0, 1, 2].map((i) => `${year}-${String(start + i).padStart(2, "0")}`);
  }
  return [];
}

/** Months covered by an independent plan choice (not cumulative pack). */
export function billingPlanCoveredMonths(plan: BillingPlan, startMonth: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(startMonth)) return [];
  if (plan === "monthly") return [startMonth];
  const [y, m] = startMonth.split("-").map(Number);
  const months: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const d = new Date(y!, m! - 1 + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function listCandidateStartMonths(count = 12, from = new Date()): string[] {
  const months: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export type BillingDeclarationQuote = {
  plan: BillingPlan;
  currency: BillingCurrency;
  startMonth: string;
  coveredMonths: string[];
  billingPeriod: string;
  expectedAmount: number;
  monthlyTariff: number;
  quarterlyTariff: number;
  available: boolean;
  conflictMonths: string[];
  firstEligibleStart: string | null;
};

/** Client-side preview — server quote_billing_declaration is authoritative. */
export function quoteBillingDeclaration(input: {
  plan: BillingPlan;
  currency: BillingCurrency;
  startMonth: string;
  tariffs?: BillingTariffMap | null;
  occupiedMonths?: string[] | null;
}): BillingDeclarationQuote {
  const coveredMonths = billingPlanCoveredMonths(input.plan, input.startMonth);
  const occupied = new Set(input.occupiedMonths ?? []);
  const conflictMonths = coveredMonths.filter((m) => occupied.has(m));
  const expectedAmount = resolvePlanAmount(input.plan, input.currency, input.tariffs);
  const billingPeriod =
    input.plan === "monthly"
      ? input.startMonth
      : `${coveredMonths[0]}/${coveredMonths[coveredMonths.length - 1]}`;

  let firstEligibleStart: string | null = null;
  const [y, m] = input.startMonth.split("-").map(Number);
  for (let i = 0; i < 18; i += 1) {
    const d = new Date(y!, m! - 1 + i, 1);
    const probe = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cover = billingPlanCoveredMonths(input.plan, probe);
    if (cover.every((month) => !occupied.has(month))) {
      firstEligibleStart = probe;
      break;
    }
  }

  return {
    plan: input.plan,
    currency: input.currency,
    startMonth: input.startMonth,
    coveredMonths,
    billingPeriod,
    expectedAmount,
    monthlyTariff: resolvePlanAmount("monthly", input.currency, input.tariffs),
    quarterlyTariff: resolvePlanAmount("quarterly", input.currency, input.tariffs),
    available: conflictMonths.length === 0,
    conflictMonths,
    firstEligibleStart,
  };
}

/** @deprecated Cumulative pack removed — use quoteBillingDeclaration. */
export function quoteFlexibleBillingPack(input: {
  currency: BillingCurrency;
  currentMonth: string;
  includeFuturePack: boolean;
  tariffs?: BillingTariffMap | null;
  acquiredCurrentAmount?: number | null;
}) {
  const quote = quoteBillingDeclaration({
    plan: "monthly",
    currency: input.currency,
    startMonth: input.currentMonth,
    ...(input.tariffs !== undefined ? { tariffs: input.tariffs } : {}),
  });
  return {
    currency: quote.currency,
    currentMonth: input.currentMonth,
    currentAmount: quote.expectedAmount,
    futureMonths: [] as string[],
    futurePackAmount: 0,
    totalAmount: quote.expectedAmount,
    monthlyTariff: quote.monthlyTariff,
    quarterlyTariff: quote.quarterlyTariff,
    currentIsAcquired: false,
  };
}

export function billingPlanLabel(plan: string | null | undefined): string {
  if (plan === "monthly") return "Mensuelle";
  if (plan === "quarterly") return "Trimestrielle";
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
  const range = /^(\d{4}-\d{2})\/(\d{4}-\d{2})$/.exec(period);
  if (range) {
    const start = billingPeriodLabel(range[1], "monthly");
    const end = billingPeriodLabel(range[2], "monthly");
    return `${start} → ${end}`;
  }
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

/** First upcoming (or current) period for a plan. */
export function currentBillingPeriod(plan: BillingPlan, from = new Date()): string {
  return listBillingPeriods(plan, 1, from)[0]!;
}

/** Next period after the current one (for deferred plan changes). */
export function nextBillingPeriod(plan: BillingPlan, from = new Date()): string {
  return listBillingPeriods(plan, 2, from)[1]!;
}

export function periodSortKey(period: string): string {
  const quarter = /^(\d{4})-Q([1-4])$/i.exec(period);
  if (quarter) {
    const month = (Number(quarter[2]) - 1) * 3 + 1;
    return `${quarter[1]}-${String(month).padStart(2, "0")}`;
  }
  return period;
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

export function resolveSubscriptionBilling(input: {
  billing_plan?: string | null;
  billing_currency?: string | null;
  pending_billing_plan?: string | null;
  pending_billing_currency?: string | null;
  plan_change_effective_period?: string | null;
  /** When resolving for a specific échéance period, apply pending if due. */
  forPeriod?: string | null;
}): { plan: BillingPlan; currency: BillingCurrency; pendingEffectivePeriod: string | null } {
  let plan: BillingPlan = isBillingPlan(input.billing_plan) ? input.billing_plan : "monthly";
  let currency: BillingCurrency = isBillingCurrency(input.billing_currency)
    ? input.billing_currency
    : "MAD";
  const pendingPlan = isBillingPlan(input.pending_billing_plan) ? input.pending_billing_plan : null;
  const pendingCurrency = isBillingCurrency(input.pending_billing_currency)
    ? input.pending_billing_currency
    : null;
  const effective = input.plan_change_effective_period?.trim() || null;

  if (
    input.forPeriod &&
    pendingPlan &&
    effective &&
    periodSortKey(input.forPeriod) >= periodSortKey(effective)
  ) {
    plan = pendingPlan;
    currency = pendingCurrency ?? currency;
  }

  return { plan, currency, pendingEffectivePeriod: pendingPlan && effective ? effective : null };
}
