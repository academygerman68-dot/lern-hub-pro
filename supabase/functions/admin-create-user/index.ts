/**
 * Admin-only user provisioning. Uses the service role so the admin session
 * never switches to the newly created Auth user.
 *
 * Secrets are injected by Supabase (never expose the service role in the browser).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...cors, "Cache-Control": "no-store", "Content-Type": "application/json" };

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return respond(503, { error: "SUPABASE_NOT_CONFIGURED" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond(401, { error: "UNAUTHORIZED" });

  const caller = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return respond(401, { error: "UNAUTHORIZED" });

  const { data: callerProfile, error: profileError } = await caller
    .from("profiles")
    .select("role,status")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (
    profileError ||
    !callerProfile ||
    callerProfile.role !== "admin" ||
    callerProfile.status !== "active"
  ) {
    return respond(403, { error: "FORBIDDEN" });
  }

  const body = await req.json().catch(() => ({}));
  const email = asString(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = asString(body.firstName);
  const lastName = asString(body.lastName);
  const phone = asString(body.phone);
  const specialties = Array.isArray(body.specialties)
    ? body.specialties.filter(
        (item: unknown): item is string => typeof item === "string" && item.trim() !== "",
      )
    : [];
  const requestedRole = asString(body.role).toLowerCase() || "teacher";

  if (requestedRole !== "teacher") {
    return respond(400, { error: "UNSUPPORTED_ROLE" });
  }
  if (!email || !email.includes("@")) return respond(400, { error: "EMAIL_REQUIRED" });
  if (password.length < 8) return respond(400, { error: "PASSWORD_TOO_SHORT" });
  if (!firstName || !lastName) return respond(400, { error: "NAME_REQUIRED" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "teacher",
      first_name: firstName,
      last_name: lastName,
      language: "fr",
      ...(phone ? { phone } : {}),
    },
  });
  if (createError || !created.user) {
    const message = (createError?.message ?? "").toLowerCase();
    if (
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists")
    ) {
      return respond(409, { error: "EMAIL_TAKEN" });
    }
    return respond(400, {
      error: "CREATE_USER_FAILED",
      message: createError?.message ?? "CREATE_USER_FAILED",
    });
  }

  let teacher: {
    id: string;
    profile_id: string;
  } | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data } = await admin
      .from("teachers")
      .select("id, profile_id")
      .eq("profile_id", created.user.id)
      .maybeSingle();
    if (data?.id) {
      teacher = data;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 150 + attempt * 100));
  }
  if (!teacher) {
    return respond(500, { error: "TEACHER_PROFILE_PENDING" });
  }

  if (specialties.length) {
    await admin.from("teachers").update({ specialties }).eq("id", teacher.id);
  }

  return respond(200, {
    id: teacher.id,
    profileId: teacher.profile_id,
    email,
    role: "teacher",
    emailConfirmed: true,
  });
});
