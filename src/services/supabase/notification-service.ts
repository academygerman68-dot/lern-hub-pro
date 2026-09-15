import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];
type NotificationStatus = Database["public"]["Enums"]["notification_status"];

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

/**
 * In-app notifications. Email/WhatsApp providers are optional adapters —
 * when not configured, only in-app rows are created.
 */
export const SupabaseNotificationService = {
  async listMine(limit = 40): Promise<Notification[]> {
    const { data, error } = await requireClient()
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async unreadCount(): Promise<number> {
    const { count, error } = await requireClient()
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("status", "unread");
    if (error) throw error;
    return count ?? 0;
  },

  async markRead(id: string) {
    const { data, error } = await requireClient()
      .from("notifications")
      .update({ status: "read" as NotificationStatus, read_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async markAllRead() {
    const { data: auth } = await requireClient().auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return true;
    const { error } = await requireClient()
      .from("notifications")
      .update({ status: "read" as NotificationStatus, read_at: new Date().toISOString() })
      .eq("recipient_id", uid)
      .eq("status", "unread");
    if (error) throw error;
    return true;
  },

  async create(input: {
    recipientId: string;
    title: string;
    message: string;
    category?: string;
    linkPage?: string | null;
    linkId?: string | null;
  }) {
    const args: {
      p_recipient_id: string;
      p_title: string;
      p_message: string;
      p_category?: string;
      p_link_page?: string;
      p_link_id?: string;
    } = {
      p_recipient_id: input.recipientId,
      p_title: input.title,
      p_message: input.message,
      p_category: input.category ?? "general",
    };
    if (input.linkPage) args.p_link_page = input.linkPage;
    if (input.linkId) args.p_link_id = input.linkId;
    const { data, error } = await requireClient().rpc("create_in_app_notification", args);
    if (error) throw error;
    return data as Notification;
  },
};

/** Stub adapters — wire real providers later without touching UI. */
export const EmailProvider = {
  configured: false,
  async send(_input: { to: string; subject: string; body: string }) {
    return { status: "failed" as const, reason: "Provider non configuré" };
  },
};

export const WhatsAppProvider = {
  configured: false,
  async send(_input: { to: string; message: string }) {
    return { status: "failed" as const, reason: "Provider non configuré" };
  },
};
