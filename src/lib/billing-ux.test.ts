import { describe, expect, it } from "vitest";
import {
  buildVirtualNextInstallment,
  formatRejectionAdminNote,
  matchesInstallmentFilter,
  pickNextInstallment,
  resolveActiveBillingFromSubscription,
  resolveInstallmentUxStatus,
  subscriptionAccessLabel,
} from "./billing-ux";
import { planAmount } from "./subscription-plans";

describe("billing UX statuses", () => {
  it("maps payment + proof to installment UX states", () => {
    expect(
      resolveInstallmentUxStatus(
        {
          id: "1",
          status: "pending",
          amount: 1200,
          currency: "MAD",
          due_date: "2099-12-31",
        },
        null,
      ),
    ).toBe("due");

    expect(
      resolveInstallmentUxStatus(
        {
          id: "1",
          status: "pending",
          amount: 1200,
          currency: "MAD",
          due_date: "2020-01-01",
        },
        null,
        new Date("2026-01-01"),
      ),
    ).toBe("overdue");

    expect(
      resolveInstallmentUxStatus(
        { id: "1", status: "pending", amount: 100, currency: "EUR" },
        { payment_id: "1", status: "pending" },
      ),
    ).toBe("pending_review");

    expect(
      resolveInstallmentUxStatus(
        { id: "1", status: "pending", amount: 100, currency: "EUR" },
        { payment_id: "1", status: "rejected" },
      ),
    ).toBe("rejected");

    expect(
      resolveInstallmentUxStatus(
        { id: "1", status: "paid", amount: 2400, currency: "MAD" },
        { payment_id: "1", status: "approved" },
      ),
    ).toBe("validated");
  });

  it("filters history buckets", () => {
    expect(matchesInstallmentFilter("due", "due")).toBe(true);
    expect(matchesInstallmentFilter("overdue", "due")).toBe(true);
    expect(matchesInstallmentFilter("rejected", "due")).toBe(true);
    expect(matchesInstallmentFilter("pending_review", "pending")).toBe(true);
    expect(matchesInstallmentFilter("validated", "validated")).toBe(true);
    expect(matchesInstallmentFilter("due", "validated")).toBe(false);
  });

  it("picks the next open installment", () => {
    const next = pickNextInstallment(
      [
        {
          id: "paid",
          status: "paid",
          amount: 1200,
          currency: "MAD",
          billing_period: "2026-08",
          due_date: "2026-08-31",
        },
        {
          id: "open",
          status: "pending",
          amount: 1200,
          currency: "MAD",
          billing_period: "2026-09",
          due_date: "2026-09-30",
        },
      ],
      [],
    );
    expect(next?.payment.id).toBe("open");
    expect(next?.status).toBe("due");
  });
});

describe("subscription billing plans", () => {
  it("covers fixed commercial tariffs", () => {
    expect(planAmount("monthly", "MAD")).toBe(1000);
    expect(planAmount("monthly", "EUR")).toBe(100);
    expect(planAmount("quarterly", "MAD")).toBe(2400);
    expect(planAmount("quarterly", "EUR")).toBe(240);
  });

  it("builds a virtual next installment from subscription", () => {
    const row = buildVirtualNextInstallment({
      plan: "quarterly",
      currency: "EUR",
      period: "2026-Q4",
    });
    expect(row.amount).toBe(240);
    expect(row.dueDate).toBe("2026-12-31");
    expect(row.status).toBe("due");
  });

  it("keeps pending plan change for next period without rewriting active plan", () => {
    const active = resolveActiveBillingFromSubscription({
      billing_plan: "monthly",
      billing_currency: "MAD",
      pending_billing_plan: "quarterly",
      pending_billing_currency: "EUR",
      plan_change_effective_period: "2026-Q4",
    });
    expect(active.plan).toBe("monthly");
    expect(active.currency).toBe("MAD");
    expect(active.pendingPlan).toBe("quarterly");
    expect(active.pendingCurrency).toBe("EUR");
    expect(active.pendingEffectivePeriod).toBe("2026-Q4");
  });

  it("formats rejection notes for admin review", () => {
    expect(formatRejectionAdminNote("unreadable_proof")).toBe("Justificatif illisible");
    expect(formatRejectionAdminNote("wrong_amount", "écart 50 MAD")).toBe(
      "Montant incorrect — écart 50 MAD",
    );
  });

  it("hides finance wording for teacher access labels", () => {
    expect(subscriptionAccessLabel("active")).toBe("Abonnement actif");
    expect(subscriptionAccessLabel("ACTIVE")).toBe("Abonnement actif");
    expect(subscriptionAccessLabel("suspended")).toBe("Accès suspendu");
  });
});
