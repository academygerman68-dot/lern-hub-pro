import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getAuthRedirects } from "@/lib/auth-config";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { profileToSessionUser, type Profile } from "@/lib/roles";
import type { SessionUser } from "@/types/academy";

export type AuthSessionPayload = {
  user: User;
  session: Session;
  profile: Profile;
  sessionUser: SessionUser;
};

export class AuthError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "AuthError";
    this.code = code;
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProfile(userId: string): Promise<Profile> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error || !data) {
    throw new AuthError("PROFILE_NOT_FOUND", error?.message ?? "PROFILE_NOT_FOUND");
  }
  return data;
}

/** Profile trigger can lag a moment after signup/OAuth — retry briefly. */
async function fetchProfileWithRetry(userId: string, attempts = 6): Promise<Profile> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchProfile(userId);
    } catch (error) {
      lastError = error;
      await sleep(200 + i * 150);
    }
  }
  throw lastError instanceof Error ? lastError : new AuthError("PROFILE_NOT_FOUND");
}

function assertActiveProfile(profile: Profile) {
  if (profile.status === "suspended" || profile.status === "archived") {
    throw new AuthError("ACCOUNT_INACTIVE", "ACCOUNT_INACTIVE");
  }
}

function mapAuthApiError(error: { message?: string; code?: string } | null | undefined): AuthError {
  const message = (error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "").toLowerCase();
  if (message.includes("email not confirmed") || code.includes("email_not_confirmed")) {
    return new AuthError("EMAIL_NOT_CONFIRMED", "EMAIL_NOT_CONFIRMED");
  }
  if (message.includes("invalid login") || message.includes("invalid credentials")) {
    return new AuthError("INVALID_CREDENTIALS", "INVALID_CREDENTIALS");
  }
  if (message.includes("user already registered") || code.includes("user_already_exists")) {
    return new AuthError("EMAIL_TAKEN", "EMAIL_TAKEN");
  }
  if (
    message.includes("rate limit") ||
    message.includes("for security purposes") ||
    message.includes("only request this after") ||
    code.includes("over_email_send_rate_limit")
  ) {
    return new AuthError("EMAIL_RATE_LIMIT", "EMAIL_RATE_LIMIT");
  }
  return new AuthError("AUTH_FAILED", error?.message ?? "AUTH_FAILED");
}

export const SupabaseAuthService = {
  isConfigured: isSupabaseConfigured,

  /**
   * Verifies identity with getUser() (server-validated) then attaches local session + profile.
   */
  async getSession(): Promise<AuthSessionPayload | null> {
    if (!isSupabaseConfigured) return null;
    const supabase = getSupabase();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) return null;

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) return null;

    const profile = await fetchProfileWithRetry(user.id);
    assertActiveProfile(profile);
    return {
      user,
      session,
      profile,
      sessionUser: profileToSessionUser(profile),
    };
  },

  async login(email: string, password: string): Promise<AuthSessionPayload> {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.session || !data.user) {
      throw mapAuthApiError(
        error ? { message: error.message, code: String(error.code ?? "") } : null,
      );
    }
    const profile = await fetchProfileWithRetry(data.user.id);
    try {
      assertActiveProfile(profile);
    } catch (err) {
      await supabase.auth.signOut();
      throw err;
    }
    return {
      user: data.user,
      session: data.session,
      profile,
      sessionUser: profileToSessionUser(profile),
    };
  },

  /**
   * Public signup — always creates a student account (pending until admin validation).
   * Role is applied by DB trigger `handle_new_user` from user metadata.
   */
  async signUp(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    language?: "en" | "fr" | "de";
    phone?: string;
  }): Promise<AuthSessionPayload | { needsEmailConfirmation: true; email: string }> {
    const supabase = getSupabase();
    const redirects = getAuthRedirects();
    const phone = input.phone?.trim() || undefined;
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        emailRedirectTo: redirects.callback,
        data: {
          role: "student",
          first_name: input.firstName.trim(),
          last_name: input.lastName.trim(),
          language: input.language ?? "fr",
          ...(phone ? { phone } : {}),
        },
      },
    });
    if (error || !data.user) {
      throw mapAuthApiError(
        error ? { message: error.message, code: String(error.code ?? "") } : null,
      );
    }
    // Supabase may return a user with empty identities when the email is already registered
    // (anti-enumeration). Treat as already taken instead of "check your email".
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new AuthError("EMAIL_TAKEN", "EMAIL_TAKEN");
    }
    if (!data.session) {
      return { needsEmailConfirmation: true, email: input.email.trim().toLowerCase() };
    }
    const profile = await fetchProfileWithRetry(data.user.id);
    return {
      user: data.user,
      session: data.session,
      profile,
      sessionUser: profileToSessionUser(profile),
    };
  },

  /** @deprecated Prefer signUp() — public signup is always student. */
  async signUpStudent(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    language?: "en" | "fr" | "de";
    phone?: string;
  }) {
    return this.signUp(input);
  },

  async signInWithGoogle(): Promise<void> {
    const supabase = getSupabase();
    const redirects = getAuthRedirects();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirects.callback,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) throw mapAuthApiError({ message: error.message, code: String(error.code ?? "") });
  },

  async logout(): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  },

  async requestPasswordReset(email: string): Promise<{ sent: boolean }> {
    const supabase = getSupabase();
    const redirects = getAuthRedirects();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: redirects.passwordReset,
    });
    if (error) throw mapAuthApiError({ message: error.message, code: String(error.code ?? "") });
    return { sent: true };
  },

  async updatePassword(newPassword: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw mapAuthApiError({ message: error.message, code: String(error.code ?? "") });
  },

  async resendSignupConfirmation(email: string): Promise<void> {
    const supabase = getSupabase();
    const redirects = getAuthRedirects();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirects.callback },
    });
    if (error) throw mapAuthApiError({ message: error.message, code: String(error.code ?? "") });
  },

  onAuthStateChange(
    callback: (payload: AuthSessionPayload | null, event: AuthChangeEvent) => void,
  ) {
    if (!isSupabaseConfigured) return () => undefined;
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        callback(null, event);
        return;
      }
      try {
        const profile = await fetchProfileWithRetry(session.user.id);
        if (profile.status === "suspended" || profile.status === "archived") {
          await supabase.auth.signOut();
          callback(null, "SIGNED_OUT");
          return;
        }
        callback(
          {
            user: session.user,
            session,
            profile,
            sessionUser: profileToSessionUser(profile),
          },
          event,
        );
      } catch {
        callback(null, event);
      }
    });
    return () => data.subscription.unsubscribe();
  },
};
