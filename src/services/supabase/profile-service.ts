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

function mapProfileError(message: string): Error {
  if (message.includes("INVALID_NAME")) {
    return new Error("Le prénom et le nom sont obligatoires.");
  }
  if (message.includes("NAME_TOO_LONG")) {
    return new Error("Le prénom ou le nom est trop long.");
  }
  if (message.includes("PHONE_TOO_LONG")) {
    return new Error("Le numéro de téléphone est trop long.");
  }
  if (message.includes("FORBIDDEN")) {
    return new Error("Action non autorisée.");
  }
  if (message.includes("ACCOUNT_NOT_USABLE")) {
    return new Error("Votre compte ne peut pas être modifié pour le moment.");
  }
  if (message.includes("PROFILE_NOT_FOUND")) {
    return new Error("Profil introuvable.");
  }
  return new Error(message || "Mise à jour impossible.");
}

const AVATAR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ProfilePersonalInput = {
  firstName: string;
  lastName: string;
  phone?: string | null;
};

export const SupabaseProfileService = {
  async listPendingProfiles(): Promise<ProfileRow[]> {
    const { data, error } = await requireClient()
      .from("profiles")
      .select("*")
      .eq("status", "pending")
      .eq("role", "student")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ProfileRow[];
  },

  async getById(profileId: string): Promise<ProfileRow | null> {
    const { data, error } = await requireClient()
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle();
    if (error) throw error;
    return (data as ProfileRow | null) ?? null;
  },

  async setProfileStatus(profileId: string, status: AccountStatus): Promise<ProfileRow> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc("admin_set_profile_status", {
      p_profile_id: profileId,
      p_status: status,
    });
    if (error) throw error;
    return data as ProfileRow;
  },

  /** Alias for admin queue actions. */
  async setStatus(profileId: string, status: AccountStatus): Promise<ProfileRow> {
    return this.setProfileStatus(profileId, status);
  },

  async updateMyProfile(input: ProfilePersonalInput): Promise<ProfileRow> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc("update_my_profile", {
      p_first_name: input.firstName.trim(),
      p_last_name: input.lastName.trim(),
      p_phone: input.phone?.trim() || null,
    });
    if (error) throw mapProfileError(error.message);
    return data as ProfileRow;
  },

  async adminUpdateProfile(
    profileId: string,
    input: ProfilePersonalInput & { avatarUrl?: string | null; clearAvatar?: boolean },
  ): Promise<ProfileRow> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc("admin_update_profile", {
      p_profile_id: profileId,
      p_first_name: input.firstName.trim(),
      p_last_name: input.lastName.trim(),
      p_phone: input.phone?.trim() || null,
      p_avatar_url: input.avatarUrl ?? null,
      p_clear_avatar: Boolean(input.clearAvatar),
    });
    if (error) throw mapProfileError(error.message);
    return data as ProfileRow;
  },

  async updateMyAvatarUrl(avatarUrl: string | null): Promise<ProfileRow> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc("update_my_avatar_url", {
      p_avatar_url: avatarUrl,
    });
    if (error) throw mapProfileError(error.message);
    return data as ProfileRow;
  },

  async uploadAvatar(profileId: string, file: File): Promise<ProfileRow> {
    const ext = AVATAR_MIME[file.type];
    if (!ext) {
      throw new Error("Formats acceptés : JPEG, PNG ou WebP.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("L’avatar ne doit pas dépasser 5 Mo.");
    }

    const supabase = requireClient();
    const path = `${profileId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (uploadError) throw new Error(uploadError.message || "Téléversement impossible.");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isSelf = user?.id === profileId;

    if (isSelf) {
      return this.updateMyAvatarUrl(path);
    }
    const current = await this.getById(profileId);
    if (!current) throw new Error("Profil introuvable.");
    return this.adminUpdateProfile(profileId, {
      firstName: current.first_name,
      lastName: current.last_name,
      phone: current.phone,
      avatarUrl: path,
    });
  },

  async removeAvatar(profileId: string): Promise<ProfileRow> {
    const supabase = requireClient();
    const current = await this.getById(profileId);
    if (!current) throw new Error("Profil introuvable.");

    if (current.avatar_url && !current.avatar_url.startsWith("http")) {
      await supabase.storage.from("avatars").remove([current.avatar_url]);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isSelf = user?.id === profileId;

    if (isSelf) {
      return this.updateMyAvatarUrl(null);
    }
    return this.adminUpdateProfile(profileId, {
      firstName: current.first_name,
      lastName: current.last_name,
      phone: current.phone,
      clearAvatar: true,
    });
  },

  async getAvatarSignedUrl(avatarUrl: string | null | undefined): Promise<string | null> {
    if (!avatarUrl) return null;
    if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
      return avatarUrl;
    }
    const supabase = requireClient();
    const { data, error } = await supabase.storage.from("avatars").createSignedUrl(avatarUrl, 3600);
    if (error) return null;
    return data.signedUrl;
  },
};
