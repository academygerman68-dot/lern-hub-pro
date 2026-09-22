import { describe, expect, it } from "vitest";
import {
  billingPeriodDueDate,
  billingPeriodLabel,
  billingPlanLabel,
  listBillingPeriods,
  planAmount,
  quoteFlexibleBillingPack,
} from "./subscription-plans";

describe("subscription plans", () => {
  it("returns settings-aligned MAD/EUR fallbacks (prod monthly MAD 1200)", () => {
    expect(planAmount("monthly", "MAD")).toBe(1200);
    expect(planAmount("monthly", "EUR")).toBe(100);
    expect(planAmount("quarterly", "MAD")).toBe(2400);
    expect(planAmount("quarterly", "EUR")).toBe(240);
  });

  it("quotes flexible monthly + 3 future months at quarterly pack", () => {
    const quote = quoteFlexibleBillingPack({
      currency: "MAD",
      currentMonth: "2026-09",
      includeFuturePack: true,
    });
    expect(quote.currentAmount).toBe(1200);
    expect(quote.futureMonths).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(quote.futurePackAmount).toBe(2400);
    expect(quote.totalAmount).toBe(3600);
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
