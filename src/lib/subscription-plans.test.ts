import { describe, expect, it } from "vitest";
import {
  amountToMad,
  billingPeriodDueDate,
  billingPeriodLabel,
  billingPeriodMonths,
  billingPlanCoveredMonths,
  billingPlanLabel,
  listBillingPeriods,
  parseBillingTariffSettings,
  planAmount,
  quoteBillingDeclaration,
  resolvePlanAmount,
} from "./subscription-plans";

describe("subscription plans", () => {
  it("returns catalogue MAD/EUR fallbacks (1000/100 monthly, 2400/240 quarterly)", () => {
    expect(planAmount("monthly", "MAD")).toBe(1000);
    expect(planAmount("monthly", "EUR")).toBe(100);
    expect(planAmount("quarterly", "MAD")).toBe(2400);
    expect(planAmount("quarterly", "EUR")).toBe(240);
  });

  it("converts EUR to MAD at 1 EUR = 10 MAD for CA", () => {
    expect(amountToMad(100, "EUR")).toBe(1000);
    expect(amountToMad(240, "EUR")).toBe(2400);
    expect(amountToMad(1000, "MAD")).toBe(1000);
  });

  it("quotes independent monthly and quarterly declarations (never cumulative)", () => {
    const monthly = quoteBillingDeclaration({
      plan: "monthly",
      currency: "MAD",
      startMonth: "2026-09",
    });
    expect(monthly.expectedAmount).toBe(1000);
    expect(monthly.coveredMonths).toEqual(["2026-09"]);

    const quarterly = quoteBillingDeclaration({
      plan: "quarterly",
      currency: "MAD",
      startMonth: "2026-10",
      occupiedMonths: ["2026-09"],
    });
    expect(quarterly.expectedAmount).toBe(2400);
    expect(quarterly.coveredMonths).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(quarterly.available).toBe(true);
    expect(quarterly.billingPeriod).toBe("2026-10/2026-12");
  });

  it("rejects quarterly start when any of the three months is occupied", () => {
    const quote = quoteBillingDeclaration({
      plan: "quarterly",
      currency: "MAD",
      startMonth: "2026-09",
      occupiedMonths: ["2026-09"],
    });
    expect(quote.available).toBe(false);
    expect(quote.conflictMonths).toEqual(["2026-09"]);
    expect(quote.firstEligibleStart).toBe("2026-10");
  });

  it("covers rolling quarters starting in November across year boundary", () => {
    expect(billingPlanCoveredMonths("quarterly", "2026-11")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });

  it("expands stored period labels into months", () => {
    expect(billingPeriodMonths("2026-09")).toEqual(["2026-09"]);
    expect(billingPeriodMonths("2026-10/2026-12")).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(billingPeriodMonths("2026-Q4")).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("resolves plan amounts from app_settings tariffs when provided", () => {
    const tariffs = parseBillingTariffSettings([
      { key: "billing_tariff_monthly_MAD", value: 1000 },
      { key: "billing_tariff_quarterly_MAD", value: 2400 },
    ]);
    expect(resolvePlanAmount("monthly", "MAD", tariffs)).toBe(1000);
    expect(resolvePlanAmount("quarterly", "MAD", tariffs)).toBe(2400);
  });

  it("parses tariff map shape from branding getMap cache without throwing", () => {
    const map = {
      academy_name: "German Academy",
      billing_tariff_monthly_MAD: 1000,
      billing_tariff_quarterly_MAD: 2400,
      billing_tariff_monthly_EUR: 100,
      billing_tariff_quarterly_EUR: 240,
    };
    expect(() => parseBillingTariffSettings(map)).not.toThrow();
    const tariffs = parseBillingTariffSettings(map);
    expect(resolvePlanAmount("monthly", "MAD", tariffs)).toBe(1000);
    expect(resolvePlanAmount("quarterly", "MAD", tariffs)).toBe(2400);
    expect(resolvePlanAmount("monthly", "EUR", tariffs)).toBe(100);
  });

  it("returns empty tariffs for null, undefined, or non-iterable settings payloads", () => {
    expect(parseBillingTariffSettings(null)).toEqual({});
    expect(parseBillingTariffSettings(undefined)).toEqual({});
    expect(parseBillingTariffSettings("broken" as never)).toEqual({});
  });

  it("labels plans and periods in French", () => {
    expect(billingPlanLabel("monthly")).toBe("Mensuelle");
    expect(billingPlanLabel("quarterly")).toBe("Trimestrielle");
    expect(billingPeriodLabel("2026-09")).toMatch(/septembre/i);
    expect(billingPeriodLabel("2026-10/2026-12")).toMatch(/octobre/i);
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
