import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type AppSetting = Database["public"]["Tables"]["app_settings"]["Row"];

export const SettingsService = {
  async listPublic(): Promise<AppSetting[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await getSupabase()
      .from("app_settings")
      .select("*")
      .eq("is_public", true);
    if (error) throw error;
    return data ?? [];
  },

  async getMap(): Promise<Record<string, unknown>> {
    const rows = await this.listPublic();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  },
};
