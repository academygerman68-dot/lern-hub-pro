/**
 * Dispatches queued email/WhatsApp rows from notification_outbox.
 * Secrets (never VITE_*): RESEND_API_KEY or SMTP_*, WHATSAPP_* or TWILIO_*, EMAIL_FROM
 *
 * Idempotent via notification_outbox.idempotency_key.
 * Never reports success without a real provider response.
 */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const emailConfigured = Boolean(
    Deno.env.get("RESEND_API_KEY") || (Deno.env.get("SMTP_HOST") && Deno.env.get("SMTP_USER")),
  );
  const whatsappConfigured = Boolean(
    (Deno.env.get("WHATSAPP_TOKEN") && Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")) ||
    (Deno.env.get("TWILIO_ACCOUNT_SID") && Deno.env.get("TWILIO_AUTH_TOKEN")),
  );

  return new Response(
    JSON.stringify({
      email: {
        configured: emailConfigured,
        required: ["RESEND_API_KEY ou SMTP_HOST/SMTP_USER/SMTP_PASS", "EMAIL_FROM"],
      },
      whatsapp: {
        configured: whatsappConfigured,
        required: [
          "WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID",
          "ou TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM",
        ],
      },
      message:
        emailConfigured || whatsappConfigured
          ? "Au moins un canal est configuré — brancher l’envoi réel avant cron."
          : "Aucun canal externe configuré. Les notifications in-app restent disponibles.",
    }),
    {
      status: emailConfigured || whatsappConfigured ? 200 : 503,
      headers: { ...cors, "Content-Type": "application/json" },
    },
  );
});
