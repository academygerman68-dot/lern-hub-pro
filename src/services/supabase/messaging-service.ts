import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

export type ConversationListItem = Conversation & {
  class?: { id: string; name: string } | null;
  members?: Array<{
    profile_id: string;
    role: string;
    profile?: {
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
    } | null;
  }>;
};

export type MessageListItem = Message & {
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

const CONVERSATION_SELECT = `
  *,
  class:classes ( id, name ),
  members:conversation_members (
    profile_id,
    role,
    profile:profiles!conversation_members_profile_id_fkey (
      id, first_name, last_name, email
    )
  )
`;

export const SupabaseMessagingService = {
  async listConversations(): Promise<ConversationListItem[]> {
    const { data, error } = await requireClient()
      .from("conversations")
      .select(CONVERSATION_SELECT)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as ConversationListItem[] | null) ?? [];
  },

  async listMembers(conversationId: string) {
    const { data, error } = await requireClient()
      .from("conversation_members")
      .select(
        `
        profile_id,
        role,
        joined_at,
        profile:profiles!conversation_members_profile_id_fkey (
          id, first_name, last_name, email
        )
      `,
      )
      .eq("conversation_id", conversationId);
    if (error) throw error;
    return data ?? [];
  },

  async listMessages(conversationId: string): Promise<MessageListItem[]> {
    const { data, error } = await requireClient()
      .from("messages")
      .select(
        `
        *,
        sender:profiles!messages_sender_id_fkey ( id, first_name, last_name )
      `,
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as MessageListItem[] | null) ?? [];
  },

  async sendMessage(input: { conversationId: string; body: string; senderId: string }) {
    const body = input.body.trim();
    if (!body) throw new Error("Le message ne peut pas être vide.");
    const { data, error } = await requireClient()
      .from("messages")
      .insert({
        conversation_id: input.conversationId,
        sender_id: input.senderId,
        body,
      })
      .select(
        `
        *,
        sender:profiles!messages_sender_id_fkey ( id, first_name, last_name )
      `,
      )
      .single();
    if (error) throw error;
    await requireClient()
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", input.conversationId);
    return data as MessageListItem;
  },

  async createClassConversation(input: {
    classId: string;
    name: string;
    includeTeacher?: boolean;
  }) {
    const name = input.name.trim();
    if (!name) throw new Error("Le nom de la conversation est obligatoire.");
    if (!input.classId) throw new Error("Le groupe est obligatoire.");
    const { data, error } = await requireClient().rpc("admin_create_class_conversation", {
      p_class_id: input.classId,
      p_name: name,
      p_include_teacher: input.includeTeacher ?? true,
    });
    if (error) throw error;
    return data as Conversation;
  },
};
