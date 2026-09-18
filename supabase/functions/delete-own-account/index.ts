/**
 * Secure self-service account deletion.
 * Verifies the caller JWT, runs DB purge as the user, then deletes Storage + Auth with service role.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...cors, "Cache-Control": "no-store", "Content-Type": "application/json" };
const CONFIRMATION = "SUPPRIMER";

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function removeAvatarFolder(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const { data: entries } = await admin.storage.from("avatars").list(userId, { limit: 1000 });
  if (!entries?.length) return;
  const paths = entries
    .map((entry) => (entry.name ? `${userId}/${entry.name}` : ""))
    .filter(Boolean);
  if (paths.length) {
    await admin.storage.from("avatars").remove(paths);
  }
}

async function removeStorageRefs(
  admin: ReturnType<typeof createClient>,
  refs: string[],
): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const ref of refs) {
    const sep = ref.indexOf(":");
    if (sep <= 0) continue;
    const bucket = ref.slice(0, sep);
    const path = ref.slice(sep + 1);
    if (!path) continue;
    if (bucket === "avatars" && !path.includes("/")) {
      await removeAvatarFolder(admin, path);
      continue;
    }
    const list = byBucket.get(bucket) ?? [];
    list.push(path);
    byBucket.set(bucket, list);
  }
  for (const [bucket, paths] of byBucket) {
    if (!paths.length) continue;
    await admin.storage.from(bucket).remove(paths);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return respond(503, { error: "SERVICE_UNAVAILABLE" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond(401, { error: "UNAUTHORIZED" });

  const body = await req.json().catch(() => ({}));
  if (asString(body.confirmation) !== CONFIRMATION) {
    return respond(400, { error: "CONFIRMATION_REQUIRED" });
  }

  const caller = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return respond(401, { error: "UNAUTHORIZED" });

  const userId = userData.user.id;

  const { data: purgeResult, error: purgeError } = await caller.rpc("delete_own_account");
  if (purgeError) {
    const message = (purgeError.message ?? "").toUpperCase();
    if (message.includes("LAST_ADMIN")) return respond(403, { error: "LAST_ADMIN" });
    if (message.includes("UNAUTHORIZED")) return respond(401, { error: "UNAUTHORIZED" });
    if (message.includes("PROFILE_NOT_FOUND")) return respond(404, { error: "PROFILE_NOT_FOUND" });
    return respond(400, { error: "DELETE_FAILED" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const storageRefs = Array.isArray((purgeResult as { storage_refs?: unknown })?.storage_refs)
    ? ((purgeResult as { storage_refs: string[] }).storage_refs ?? [])
    : [];

  try {
    await removeStorageRefs(admin, storageRefs);
    await removeAvatarFolder(admin, userId);
  } catch {
    // Continue: Auth deletion still required even if a file cleanup fails.
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    return respond(500, { error: "DELETE_FAILED" });
  }

  return respond(200, { ok: true });
});
