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

export type AppRoleDb = Database["public"]["Enums"]["app_role"];

export type ProfileListFilters = {
  role?: AppRoleDb | "all";
  status?: AccountStatus | "all";
  search?: string;
};

function mapAdminAccountError(message: string): Error {
  if (message.includes("LAST_ADMIN")) {
    return new Error("Impossible : c’est le dernier administrateur actif.");
  }
  if (message.includes("CANNOT_SELF_DEMOTE")) {
    return new Error("Vous ne pouvez pas retirer votre propre rôle administrateur.");
  }
  if (message.includes("CANNOT_SELF_DELETE") || message.includes("CANNOT_SELF_LOCK")) {
    return new Error("Action impossible sur votre propre compte.");
  }
  if (message.includes("FORBIDDEN")) return new Error("Action non autorisée.");
  if (message.includes("PROFILE_NOT_FOUND")) return new Error("Compte introuvable.");
  if (message.includes("EMAIL_TAKEN")) return new Error("Cet e-mail est déjà utilisé.");
  if (message.includes("PASSWORD_TOO_SHORT")) {
    return new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }
  return new Error(message || "Opération impossible.");
}

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

  async listProfiles(filters?: ProfileListFilters): Promise<ProfileRow[]> {
    let query = requireClient()
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (filters?.role && filters.role !== "all") {
      query = query.eq("role", filters.role);
    }
    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    const search = filters?.search?.trim();
    if (search) {
      const escaped = search.replace(/[%_,]/g, "");
      query = query.or(
        `email.ilike.%${escaped}%,first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%`,
      );
    }

    const { data, error } = await query;
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
    if (error) throw mapAdminAccountError(error.message);
    return data as ProfileRow;
  },

  async setProfileRole(profileId: string, role: AppRoleDb): Promise<ProfileRow> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc("admin_set_profile_role", {
      p_profile_id: profileId,
      p_role: role,
    });
    if (error) throw mapAdminAccountError(error.message);
    return data as ProfileRow;
  },

  async createAccount(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: AppRoleDb;
    phone?: string;
    activate?: boolean;
  }): Promise<{ profileId: string; email: string; role: AppRoleDb }> {
    const { data, error } = await requireClient().functions.invoke<{
      profileId?: string;
      email?: string;
      role?: AppRoleDb;
      error?: string;
      message?: string;
    }>("admin-create-user", {
      body: {
        email: input.email.trim().toLowerCase(),
        password: input.password,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        role: input.role,
        phone: input.phone?.trim() || undefined,
        activate: input.activate !== false,
      },
    });
    if (error) {
      const context = (error as { context?: Response }).context;
      if (context && typeof context.clone === "function") {
        const body = (await context
          .clone()
          .json()
          .catch(() => null)) as { error?: string; message?: string } | null;
        throw mapAdminAccountError(body?.error ?? body?.message ?? error.message);
      }
      throw mapAdminAccountError(error.message);
    }
    if (!data?.profileId) {
      throw mapAdminAccountError(data?.error ?? data?.message ?? "CREATE_USER_FAILED");
    }
    return {
      profileId: data.profileId,
      email: data.email ?? input.email,
      role: data.role ?? input.role,
    };
  },

  async deleteAccount(profileId: string): Promise<void> {
    const { data, error } = await requireClient().functions.invoke<{
      ok?: boolean;
      error?: string;
      message?: string;
    }>("admin-delete-user", {
      body: { profileId, confirmation: "SUPPRIMER" },
    });
    if (error) {
      const context = (error as { context?: Response }).context;
      if (context && typeof context.clone === "function") {
        const body = (await context
          .clone()
          .json()
          .catch(() => null)) as { error?: string; message?: string } | null;
        throw mapAdminAccountError(body?.error ?? body?.message ?? error.message);
      }
      throw mapAdminAccountError(error.message);
    }
    if (!data?.ok) {
      throw mapAdminAccountError(data?.error ?? data?.message ?? "DELETE_FAILED");
    }
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
