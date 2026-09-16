import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { SettingsService } from "@/services/supabase/settings-service";
import type { MeetingRecording, RecordingStatus } from "@/types/phase3";

function requireClient(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase() as unknown as SupabaseClient;
}

export type RecordingProviderStatus = {
  configured: boolean;
  provider: string;
  message: string;
};

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

  async getSignedUrl(recording: MeetingRecording, expiresIn = 300) {
    if (recording.status !== "ready" || !recording.storage_path) {
      throw new Error("Enregistrement non disponible");
    }
    const { data, error } = await requireClient()
      .storage.from(recording.storage_bucket)
      .createSignedUrl(recording.storage_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async delete(id: string) {
    const { error } = await requireClient().from("meeting_recordings").delete().eq("id", id);
    if (error) throw error;
  },
};
