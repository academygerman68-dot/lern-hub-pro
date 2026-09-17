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

const MESSAGE_ATTACHMENT_BUCKET = "message-attachments";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
}

function validateAttachment(file: File) {
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    throw new Error("Pièce jointe non autorisée (PDF, JPG, PNG ou WebP uniquement).");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Pièce jointe trop volumineuse (max 10 Mo).");
  }
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

const MESSAGE_SELECT = `
  *,
  sender:profiles!messages_sender_id_fkey ( id, first_name, last_name )
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

  async addMember(conversationId: string, profileId: string, role = "member") {
    const { data, error } = await requireClient()
      .from("conversation_members")
      .upsert(
        {
          conversation_id: conversationId,
          profile_id: profileId,
          role,
        },
        { onConflict: "conversation_id,profile_id" },
      )
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
      .single();
    if (error) throw error;
    return data;
  },

  async removeMember(conversationId: string, profileId: string) {
    const { error } = await requireClient()
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("profile_id", profileId);
    if (error) throw error;
  },

  async listMessages(conversationId: string): Promise<MessageListItem[]> {
    const { data, error } = await requireClient()
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as MessageListItem[] | null) ?? [];
  },

  async getAttachmentSignedUrl(message: MessageListItem, expiresIn = 300) {
    if (!message.attachment_path || !message.attachment_bucket) {
      throw new Error("Aucune pièce jointe.");
    }
    const { data, error } = await requireClient()
      .storage.from(message.attachment_bucket)
      .createSignedUrl(message.attachment_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async sendMessage(input: {
    conversationId: string;
    body: string;
    senderId: string;
    file?: File | null;
  }) {
    const body = input.body.trim();
    const file = input.file ?? null;
    if (!body && !file) throw new Error("Le message ne peut pas être vide.");

    let attachment:
      | {
          attachment_bucket: string;
          attachment_path: string;
          attachment_name: string;
          attachment_mime: string;
          attachment_size: number;
        }
      | undefined;

    if (file) {
      validateAttachment(file);
      const path = `${input.senderId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const { error: uploadError } = await requireClient()
        .storage.from(MESSAGE_ATTACHMENT_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      attachment = {
        attachment_bucket: MESSAGE_ATTACHMENT_BUCKET,
        attachment_path: path,
        attachment_name: file.name,
        attachment_mime: file.type,
        attachment_size: file.size,
      };
    }

    const { data, error } = await requireClient()
      .from("messages")
      .insert({
        conversation_id: input.conversationId,
        sender_id: input.senderId,
        body: body || (file ? file.name : ""),
        ...(attachment ?? {}),
      })
      .select(MESSAGE_SELECT)
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
