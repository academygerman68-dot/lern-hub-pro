/**
 * Centralized Auth redirect URLs.
 * Configure the same paths in Supabase Dashboard → Authentication → URL Configuration.
 *
 * If emailRedirectTo is NOT in the allow-list, Supabase falls back to Site URL
 * (often http://localhost:…) — that is why confirmation links open localhost.
 */
function readPublicAppUrl(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_APP_URL;
  if (typeof fromEnv === "string") {
    const trimmed = fromEnv.trim().replace(/\/$/, "");
    if (trimmed && trimmed !== "undefined") return trimmed;
  }
  return "";
}

export function getAppOrigin(): string {
  const configured = readPublicAppUrl();
  if (configured) return configured;
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function getAuthRedirects() {
  const origin = getAppOrigin();
  return {
    /** OAuth / email-confirm return */
    callback: `${origin}/auth/callback`,
    /** Password recovery link lands here with recovery session */
    passwordReset: `${origin}/auth/reset-password`,
    /** After auth, app shell */
    appHome: `${origin}/`,
  } as const;
}

/**
 * Demo auth is OFF unless ALL of:
 * - Vite DEV mode
 * - Explicit VITE_ENABLE_DEMO_AUTH=true
 * - Supabase is NOT configured
 *
 * Production builds never enable demo auth.
 */
export function isDemoAuthAllowed(isSupabaseConfigured: boolean): boolean {
  return (
    import.meta.env.DEV === true &&
    import.meta.env.VITE_ENABLE_DEMO_AUTH === "true" &&
    !isSupabaseConfigured
  );
}
