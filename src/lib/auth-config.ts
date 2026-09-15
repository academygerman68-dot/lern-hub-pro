/**
 * Centralized Auth redirect URLs.
 * Configure the same paths in Supabase Dashboard → Authentication → URL Configuration.
 */
export function getAppOrigin(): string {
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
