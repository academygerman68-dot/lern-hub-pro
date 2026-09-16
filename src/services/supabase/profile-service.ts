import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { AccountStatus } from "@/types/academy";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function requireClient() {
  if (!isSupabaseConfigured) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  return getSupabase();
}

export const SupabaseProfileService = {
  async setProfileStatus(profileId: string, status: AccountStatus): Promise<ProfileRow> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc("admin_set_profile_status", {
      p_profile_id: profileId,
      p_status: status,
    });
    if (error) throw error;
    return data as ProfileRow;
  },
};
