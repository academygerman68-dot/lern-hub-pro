import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { profileToSessionUser } from "@/lib/roles";
import type { Profile } from "@/lib/roles";
import type { Role, SessionUser } from "@/types/academy";

export type AuthSessionPayload = {
  user: User;
  session: Session;
  profile: Profile;
  sessionUser: SessionUser;
};

async function fetchProfile(userId: string): Promise<Profile> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error || !data) {
    throw new Error(error?.message ?? "PROFILE_NOT_FOUND");
  }
  return data;
}

export const SupabaseAuthService = {
  isConfigured: isSupabaseConfigured,

  async getSession(): Promise<AuthSessionPayload | null> {
    if (!isSupabaseConfigured) return null;
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) return null;
    const profile = await fetchProfile(data.session.user.id);
    return {
      user: data.session.user,
      session: data.session,
      profile,
      sessionUser: profileToSessionUser(profile),
    };
  },

  async login(email: string, password: string): Promise<AuthSessionPayload> {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.session || !data.user) {
      throw new Error(error?.message ?? "INVALID_CREDENTIALS");
    }
    const profile = await fetchProfile(data.user.id);
    if (profile.status === "suspended" || profile.status === "archived") {
      await supabase.auth.signOut();
      throw new Error("ACCOUNT_INACTIVE");
    }
    return {
      user: data.user,
      session: data.session,
      profile,
      sessionUser: profileToSessionUser(profile),
    };
  },

  async signUpStudent(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    language?: "en" | "fr" | "de";
  }): Promise<AuthSessionPayload> {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          role: "student",
          first_name: input.firstName,
          last_name: input.lastName,
          language: input.language ?? "en",
        },
      },
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? "SIGNUP_FAILED");
    }
    // Email confirmation may leave session null — still create student row when session exists.
    if (!data.session) {
      throw new Error("CONFIRM_EMAIL_REQUIRED");
    }
    const profile = await fetchProfile(data.user.id);
    return {
      user: data.user,
      session: data.session,
      profile,
      sessionUser: profileToSessionUser(profile),
    };
  },

  async signInWithGoogle(): Promise<void> {
    const supabase = getSupabase();
    const redirectTo = typeof window === "undefined" ? "" : window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : {},
    });
    if (error) throw error;
  },

  async logout(): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  },

  async requestPasswordReset(email: string): Promise<{ sent: boolean }> {
    const supabase = getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) throw error;
    return { sent: true };
  },

  onAuthStateChange(callback: (payload: AuthSessionPayload | null) => void) {
    if (!isSupabaseConfigured) return () => undefined;
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        callback(null);
        return;
      }
      try {
        const profile = await fetchProfile(session.user.id);
        callback({
          user: session.user,
          session,
          profile,
          sessionUser: profileToSessionUser(profile),
        });
      } catch {
        callback(null);
      }
    });
    return () => data.subscription.unsubscribe();
  },
};

/** @deprecated Demo-only helper — never use in production identity flows. */
export function assertNotUsingDemoIdentity(role: Role) {
  if (isSupabaseConfigured) {
    throw new Error(`Demo identity for ${role} is disabled while Supabase Auth is configured.`);
  }
}
