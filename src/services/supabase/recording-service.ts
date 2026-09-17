import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { SettingsService } from "@/services/supabase/settings-service";
import type { MeetingRecording, RecordingStatus } from "@/types/phase3";

function requireClient(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase() as unknown as SupabaseClient;
}

const RECORDINGS_BUCKET = "recordings";

export type RecordingProviderStatus = {
  configured: boolean;
  provider: string;
  message: string;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
}

export const SupabaseRecordingService = {
  async getProviderStatus(): Promise<RecordingProviderStatus> {
    const map = await SettingsService.getMap();
    const provider =
      typeof map["recording_provider"] === "string" ? map["recording_provider"] : "none";
    if (!provider || provider === "none") {
      return {
        configured: false,
        provider: "none",
        message: "Enregistrement non configuré",
      };
    }
    return {
      configured: true,
      provider,
      message: `Fournisseur: ${provider}`,
    };
  },

  async list(filters?: { classId?: string; status?: RecordingStatus }) {
    let query = requireClient()
      .from("meeting_recordings")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters?.classId) query = query.eq("class_id", filters.classId);
    if (filters?.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as MeetingRecording[];
  },

  async createFromExternalUrl(input: {
    title: string;
    externalUrl: string;
    liveSessionId?: string | null;
    classId?: string | null;
    teacherId?: string | null;
    createdBy?: string | null;
  }) {
    const title = input.title.trim();
    const externalUrl = input.externalUrl.trim();
    if (!title) throw new Error("Le titre est obligatoire.");
    if (!externalUrl) throw new Error("Le lien de rediffusion est obligatoire.");
    try {
      const url = new URL(externalUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("URL invalide");
      }
    } catch {
      throw new Error("URL de rediffusion invalide.");
    }

    const { data, error } = await requireClient()
      .from("meeting_recordings")
      .insert({
        title,
        external_url: externalUrl,
        storage_bucket: RECORDINGS_BUCKET,
        storage_path: null,
        live_session_id: input.liveSessionId ?? null,
        class_id: input.classId ?? null,
        teacher_id: input.teacherId ?? null,
        created_by: input.createdBy ?? null,
        status: "ready",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as MeetingRecording;
  },

  async uploadRecording(input: {
    title: string;
    file: File;
    liveSessionId?: string | null;
    classId?: string | null;
    teacherId?: string | null;
    createdBy: string;
  }) {
    const title = input.title.trim();
    if (!title) throw new Error("Le titre est obligatoire.");
    if (!input.file) throw new Error("Fichier requis.");
    const maxBytes = 500 * 1024 * 1024;
    if (input.file.size > maxBytes) throw new Error("Fichier trop volumineux (max 500 Mo).");

    const path = `${input.createdBy}/${crypto.randomUUID()}-${sanitizeFileName(input.file.name)}`;
    const client = requireClient();
    const { error: uploadError } = await client.storage
      .from(RECORDINGS_BUCKET)
      .upload(path, input.file, {
        contentType: input.file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data, error } = await client
      .from("meeting_recordings")
      .insert({
        title,
        storage_bucket: RECORDINGS_BUCKET,
        storage_path: path,
        external_url: null,
        mime_type: input.file.type || null,
        file_size: input.file.size,
        live_session_id: input.liveSessionId ?? null,
        class_id: input.classId ?? null,
        teacher_id: input.teacherId ?? null,
        created_by: input.createdBy,
        status: "ready",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as MeetingRecording;
  },

  async getPlayUrl(recording: MeetingRecording, expiresIn = 300) {
    if (recording.external_url) return recording.external_url;
    if (recording.status !== "ready" || !recording.storage_path) {
      throw new Error("Enregistrement non disponible");
    }
    const { data, error } = await requireClient()
      .storage.from(recording.storage_bucket)
      .createSignedUrl(recording.storage_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async getSignedUrl(recording: MeetingRecording, expiresIn = 300) {
    return this.getPlayUrl(recording, expiresIn);
  },

  async delete(id: string) {
    const { error } = await requireClient().from("meeting_recordings").delete().eq("id", id);
    if (error) throw error;
  },
};
