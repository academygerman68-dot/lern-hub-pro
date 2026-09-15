/**
 * Publishable Supabase client credentials (safe in the browser).
 * Prefer VITE_* env vars; these fallbacks keep Lovable/CI builds working
 * because `.env.local` is gitignored and not available remotely.
 * Never put the service_role key here.
 */
export const PUBLIC_SUPABASE_URL = "https://omxemusaqgzkogqvcdfw.supabase.co";

export const PUBLIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9teGVtdXNhcWd6a29ncXZjZGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTQ0MDEsImV4cCI6MjEwNDk3MDQwMX0.xtmsedWtQ5Uen0UEP6j8KTD0aUwI86n_BvL6Lt7uT9w";
