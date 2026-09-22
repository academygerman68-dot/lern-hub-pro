import { describe, expect, it } from "vitest";
import {
  amountToMad,
  billingPeriodDueDate,
  billingPeriodLabel,
  billingPlanLabel,
  listBillingPeriods,
  parseBillingTariffSettings,
  planAmount,
  quoteFlexibleBillingPack,
  resolvePlanAmount,
} from "./subscription-plans";

describe("subscription plans", () => {
  it("returns catalogue MAD/EUR fallbacks (1200/100 monthly, 2400/240 quarterly)", () => {
    expect(planAmount("monthly", "MAD")).toBe(1200);
    expect(planAmount("monthly", "EUR")).toBe(100);
    expect(planAmount("quarterly", "MAD")).toBe(2400);
    expect(planAmount("quarterly", "EUR")).toBe(240);
  });

  it("converts EUR to MAD at 1 EUR = 10 MAD for CA", () => {
    expect(amountToMad(100, "EUR")).toBe(1000);
    expect(amountToMad(240, "EUR")).toBe(2400);
    expect(amountToMad(1200, "MAD")).toBe(1200);
  });

  it("quotes flexible monthly + 3 future months at quarterly pack (3600 MAD)", () => {
    const quote = quoteFlexibleBillingPack({
      currency: "MAD",
      currentMonth: "2026-09",
      includeFuturePack: true,
    });
    expect(quote.currentAmount).toBe(1200);
    expect(quote.futureMonths).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(quote.futurePackAmount).toBe(2400);
    expect(quote.totalAmount).toBe(3600);
    expect(quote.currentIsAcquired).toBe(false);
  });

  it("preserves acquired current échéance amount in the flexible quote", () => {
    const quote = quoteFlexibleBillingPack({
      currency: "MAD",
      currentMonth: "2026-09",
      includeFuturePack: true,
      acquiredCurrentAmount: 1000,
      tariffs: parseBillingTariffSettings([
        { key: "billing_tariff_monthly_MAD", value: 1200 },
        { key: "billing_tariff_quarterly_MAD", value: 2400 },
      ]),
    });
    expect(quote.currentAmount).toBe(1000);
    expect(quote.monthlyTariff).toBe(1200);
    expect(quote.futurePackAmount).toBe(2400);
    expect(quote.totalAmount).toBe(3400);
    expect(quote.currentIsAcquired).toBe(true);
  });

  it("resolves plan amounts from app_settings tariffs when provided", () => {
    const tariffs = parseBillingTariffSettings([
      { key: "billing_tariff_monthly_MAD", value: 1200 },
      { key: "billing_tariff_quarterly_MAD", value: 2400 },
    ]);
    expect(resolvePlanAmount("monthly", "MAD", tariffs)).toBe(1200);
    expect(resolvePlanAmount("quarterly", "MAD", tariffs)).toBe(2400);
  });

  it("labels plans and periods in French", () => {
    expect(billingPlanLabel("monthly")).toBe("Mensuelle");
    expect(billingPlanLabel("quarterly")).toBe("Trimestrielle");
    expect(billingPeriodLabel("2026-09")).toMatch(/septembre/i);
    expect(billingPeriodLabel("2026-Q3")).toMatch(/T3 2026/);
  });

  it("computes due dates at end of month/quarter", () => {
    expect(billingPeriodDueDate("2026-09", "monthly")).toBe("2026-09-30");
    expect(billingPeriodDueDate("2026-Q1", "quarterly")).toBe("2026-03-31");
    expect(billingPeriodDueDate("2026-Q4", "quarterly")).toBe("2026-12-31");
  });

  it("lists upcoming periods", () => {
    const months = listBillingPeriods("monthly", 3, new Date(2026, 8, 15));
    expect(months).toEqual(["2026-09", "2026-10", "2026-11"]);
    const quarters = listBillingPeriods("quarterly", 2, new Date(2026, 8, 15));
    expect(quarters).toEqual(["2026-Q3", "2026-Q4"]);
  });
});
