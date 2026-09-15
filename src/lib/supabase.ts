import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from "@/lib/supabase-public-config";

function readViteEnv(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  // Some hosts replace missing define keys with the literal "undefined".
  if (!trimmed || trimmed === "undefined") return "";
  return trimmed;
}

// Vite only inlines *static* `import.meta.env.VITE_*` access.
const supabaseUrl = readViteEnv(import.meta.env.VITE_SUPABASE_URL) || PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  readViteEnv(import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  readViteEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient<Database> | null = null;

/** Single shared browser client. Never put the service role key here. */
export function getSupabase(): SupabaseClient<Database> {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  if (!client) {
    client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export type { Database };
