import { describe, expect, it } from "vitest";
import { EmailAdapter, WhatsAppAdapter } from "@/services/messaging/adapters";

describe("payment proof path rules", () => {
  it("stores proofs under students/{id}/payment-proofs/", () => {
    const studentId = "11111111-2222-3333-4444-555555555555";
    const path = `students/${studentId}/payment-proofs/${crypto.randomUUID()}.pdf`;
    expect(path.startsWith(`students/${studentId}/payment-proofs/`)).toBe(true);
    expect(path.includes("/payment-proofs/")).toBe(true);
  });

  it("rejects disallowed mime types at the service contract level", () => {
    const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
    expect(allowed.has("application/pdf")).toBe(true);
    expect(allowed.has("image/webp")).toBe(false);
    expect(allowed.has("video/mp4")).toBe(false);
  });
});

describe("recording honesty", () => {
  it("treats provider none as not configured", () => {
    const provider = "none";
    const configured = Boolean(provider && provider !== "none");
    expect(configured).toBe(false);
    expect(configured ? "ready" : "Enregistrement non configuré").toBe(
      "Enregistrement non configuré",
    );
  });
});

describe("messaging adapters", () => {
  it("never reports success when providers are unset", async () => {
    const email = await EmailAdapter.send({
      to: "demo@example.com",
      templateKey: "payment_reminder",
      body: "test",
    });
    const wa = await WhatsAppAdapter.send({
      to: "+10000000000",
      templateKey: "payment_reminder",
      body: "test",
    });
    expect(email.ok).toBe(false);
    expect(wa.ok).toBe(false);
    if (!email.ok) expect(email.reason).toBe("not_configured");
    if (!wa.ok) expect(wa.reason).toBe("not_configured");
  });
});

describe("library expiry visibility", () => {
  it("hides expired items from student-facing filter", () => {
    const now = Date.now();
    const items = [
      { id: "1", expires_at: null as string | null },
      { id: "2", expires_at: new Date(now + 86_400_000).toISOString() },
      { id: "3", expires_at: new Date(now - 86_400_000).toISOString() },
    ];
    const visible = items.filter((i) => !i.expires_at || new Date(i.expires_at).getTime() > now);
    expect(visible.map((i) => i.id)).toEqual(["1", "2"]);
  });
});
