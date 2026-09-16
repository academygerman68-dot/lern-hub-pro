import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { NotificationOutboxRow } from "@/types/phase3";
import { EmailAdapter, WhatsAppAdapter } from "./adapters";

function requireClient(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase() as unknown as SupabaseClient;
}

export const OutboxService = {
  async list(limit = 50): Promise<NotificationOutboxRow[]> {
    const { data, error } = await requireClient()
      .from("notification_outbox")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as NotificationOutboxRow[];
  },

  async enqueueIdempotent(input: {
    channel: "email" | "whatsapp" | "in_app";
    templateKey: string;
    recipientProfileId?: string | null;
    recipientAddress?: string | null;
    payload?: Record<string, unknown>;
    idempotencyKey: string;
  }) {
    const { data, error } = await requireClient().rpc("enqueue_notification_outbox", {
      p_channel: input.channel,
      p_template_key: input.templateKey,
      p_recipient_profile_id: input.recipientProfileId ?? null,
      p_recipient_address: input.recipientAddress ?? null,
      p_payload: input.payload ?? {},
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) throw error;
    return data as NotificationOutboxRow;
  },

  /** Client-side probe only — real dispatch runs in Edge Function. Never fakes success. */
  probeChannel(channel: "email" | "whatsapp") {
    if (channel === "email") {
      return {
        configured: EmailAdapter.isConfigured(),
        required: EmailAdapter.requiredEnv(),
        label: EmailAdapter.isConfigured() ? "E-mail prêt (Edge)" : "E-mail non configuré",
      };
    }
    return {
      configured: WhatsAppAdapter.isConfigured(),
      required: WhatsAppAdapter.requiredEnv(),
      label: WhatsAppAdapter.isConfigured() ? "WhatsApp prêt (Edge)" : "WhatsApp non configuré",
    };
  },
};
