/**
 * External messaging adapters.
 * Never report success unless a real provider is configured and accepted the message.
 */

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reason: "not_configured" | "send_failed"; detail: string };

export type OutboundMessage = {
  to: string;
  templateKey: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
};

function env(name: string): string | undefined {
  // Edge/runtime secrets only — never VITE_* for provider credentials.
  if (typeof process !== "undefined" && process.env?.[name]) {
    return process.env[name];
  }
  return undefined;
}

export const EmailAdapter = {
  isConfigured(): boolean {
    return Boolean(env("RESEND_API_KEY") || (env("SMTP_HOST") && env("SMTP_USER")));
  },

  requiredEnv(): string[] {
    return ["RESEND_API_KEY (or SMTP_HOST + SMTP_USER + SMTP_PASS)", "EMAIL_FROM"];
  },

  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        reason: "not_configured",
        detail: `E-mail non configuré. Variables requises: ${this.requiredEnv().join(", ")}`,
      };
    }
    // Provider wiring belongs in an Edge Function with secrets — never fake success here.
    return {
      ok: false,
      reason: "send_failed",
      detail:
        "Adaptateur e-mail préparé; déployer l’Edge Function `dispatch-outbox` avec les secrets.",
    };
  },
};

export const WhatsAppAdapter = {
  isConfigured(): boolean {
    return Boolean(
      (env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID")) ||
      (env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN")),
    );
  },

  requiredEnv(): string[] {
    return [
      "WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID (Meta)",
      "ou TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM",
    ];
  },

  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        reason: "not_configured",
        detail: `WhatsApp non configuré. Variables requises: ${this.requiredEnv().join(", ")}`,
      };
    }
    return {
      ok: false,
      reason: "send_failed",
      detail:
        "Adaptateur WhatsApp préparé; déployer l’Edge Function `dispatch-outbox` avec les secrets.",
    };
  },
};
