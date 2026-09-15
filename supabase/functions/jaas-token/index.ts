/**
 * JaaS JWT issuance for German Academy live classes.
 *
 * Secrets (Supabase Function secrets — never commit):
 * - JAAS_APP_ID
 * - JAAS_KEY_ID
 * - JAAS_PRIVATE_KEY
 *
 * Auto-injected by Supabase:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 * - CORS_ALLOWED_ORIGINS (comma-separated absolute origins)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6";

const TOKEN_TTL_SECONDS = 60 * 60 * 2; // 2 hours
const NBF_SKEW_SECONDS = 10;

type AppRole = "admin" | "teacher" | "student";

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  
  role: AppRole;
  status: string;
  avatar_url: string | null;
};

type ClassRow = {
  id: string;
  name: string;
  status: string;
  teacher_id: string | null;
};

type JsonBody = {
  classId?: unknown;
  roomName?: unknown;
};

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405, cors);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "UNAUTHORIZED" }, 401, cors);
    }
    const accessToken = authHeader.slice("Bearer ".length).trim();
    if (!accessToken) {
      return json({ error: "UNAUTHORIZED" }, 401, cors);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const jaasAppId = requiredEnv("JAAS_APP_ID");
    const jaasKeyId = requiredEnv("JAAS_KEY_ID");
    const jaasPrivateKeyPem = normalizePem(requiredEnv("JAAS_PRIVATE_KEY"));

    // Authenticated client: validates the caller's JWT (no mock auth).
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(accessToken);

    if (userError || !user) {
      return json({ error: "UNAUTHORIZED" }, 401, cors);
    }

    // Service role only for authorization lookups after identity is proven.
    // Never returned to the client.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, email, first_name, last_name, role, status, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return json({ error: "PROFILE_NOT_FOUND" }, 403, cors);
    }

    const typedProfile = profile as ProfileRow;
    if (typedProfile.status !== "active") {
      return json({ error: "ACCOUNT_INACTIVE" }, 403, cors);
    }

    let body: JsonBody = {};
    try {
      body = (await req.json()) as JsonBody;
    } catch {
      return json({ error: "INVALID_JSON" }, 400, cors);
    }

    // Never trust a client-supplied room name for authorization.
    // Room is derived server-side from an authorized class id.
    if (typeof body.roomName === "string" && body.roomName.trim().length > 0) {
      // Explicitly reject attempts to inject room names.
      return json({ error: "ROOM_NAME_NOT_ALLOWED" }, 400, cors);
    }

    const classId = typeof body.classId === "string" ? body.classId.trim() : "";
    if (!isUuid(classId)) {
      return json({ error: "CLASS_ID_REQUIRED" }, 400, cors);
    }

    const { data: classRow, error: classError } = await adminClient
      .from("classes")
      .select("id, name, status, teacher_id")
      .eq("id", classId)
      .maybeSingle();

    if (classError || !classRow) {
      return json({ error: "CLASS_NOT_FOUND" }, 404, cors);
    }

    const typedClass = classRow as ClassRow;
    if (typedClass.status === "archived" || typedClass.status === "completed") {
      return json({ error: "CLASS_NOT_LIVE_ELIGIBLE" }, 403, cors);
    }

    const access = await authorizeLiveAccess(adminClient, typedProfile, typedClass);
    if (!access.allowed) {
      return json({ error: access.reason }, 403, cors);
    }

    const roomName = deriveRoomName(typedClass.id);
    const displayName = resolveDisplayName(typedProfile);
    const now = Math.floor(Date.now() / 1000);
    const isModerator = access.moderator;

    const privateKey = await importPKCS8(jaasPrivateKeyPem, "RS256");
    const token = await new SignJWT({
      aud: "jitsi",
      iss: "chat",
      sub: jaasAppId,
      room: roomName,
      context: {
        user: {
          id: typedProfile.id,
          name: displayName,
          email: typedProfile.email ?? "",
          avatar: typedProfile.avatar_url ?? "",
          moderator: isModerator ? "true" : "false",
        },
        features: {
          livestreaming: isModerator ? "true" : "false",
          recording: isModerator ? "true" : "false",
          transcription: "false",
          "outbound-call": "false",
        },
        room: {
          regex: false,
        },
      },
    })
      .setProtectedHeader({
        alg: "RS256",
        kid: jaasKeyId,
        typ: "JWT",
      })
      .setIssuedAt(now)
      .setNotBefore(now - NBF_SKEW_SECONDS)
      .setExpirationTime(now + TOKEN_TTL_SECONDS)
      .sign(privateKey);

    return json(
      {
        token,
        appId: jaasAppId,
        roomName,
        classId: typedClass.id,
        className: typedClass.name,
        role: typedProfile.role,
        moderator: isModerator,
        expiresIn: TOKEN_TTL_SECONDS,
        domain: "8x8.vc",
      },
      200,
      cors,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    // Never leak secrets; map known config errors only.
    if (message.startsWith("MISSING_SECRET:")) {
      return json({ error: "SERVER_MISCONFIGURED" }, 500, cors);
    }
    console.error("jaas-token failed", message);
    return json({ error: "INTERNAL_ERROR" }, 500, cors);
  }
});

async function authorizeLiveAccess(
  adminClient: ReturnType<typeof createClient>,
  profile: ProfileRow,
  classRow: ClassRow,
): Promise<{ allowed: true; moderator: boolean } | { allowed: false; reason: string }> {
  // DB role `admin` is the academy director in the UI.
  if (profile.role === "admin") {
    return { allowed: true, moderator: true };
  }

  if (profile.role === "teacher") {
    const { data: teacher, error } = await adminClient
      .from("teachers")
      .select("id, status")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (error || !teacher || teacher.status === "archived" || teacher.status === "suspended") {
      return { allowed: false, reason: "TEACHER_NOT_FOUND" };
    }

    if (classRow.teacher_id !== teacher.id) {
      return { allowed: false, reason: "NOT_CLASS_TEACHER" };
    }

    return { allowed: true, moderator: true };
  }

  if (profile.role === "student") {
    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, status")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (studentError || !student || student.status !== "active") {
      return { allowed: false, reason: "STUDENT_NOT_FOUND" };
    }

    const { data: enrollment, error: enrollmentError } = await adminClient
      .from("enrollments")
      .select("id")
      .eq("student_id", student.id)
      .eq("class_id", classRow.id)
      .eq("status", "active")
      .maybeSingle();

    if (enrollmentError || !enrollment) {
      return { allowed: false, reason: "NOT_ENROLLED" };
    }

    const { data: hasAccess, error: accessError } = await adminClient.rpc(
      "has_active_academic_access",
      { p_user_id: profile.id },
    );

    if (accessError) {
      return { allowed: false, reason: "ACCESS_CHECK_FAILED" };
    }
    if (!hasAccess) {
      return { allowed: false, reason: "ACADEMIC_ACCESS_DENIED" };
    }

    // Students never receive moderator privileges from this endpoint.
    return { allowed: true, moderator: false };
  }

  return { allowed: false, reason: "ROLE_NOT_ALLOWED" };
}

/** Deterministic room id — never accept client room names. */
function deriveRoomName(classId: string): string {
  return `gla-class-${classId.toLowerCase()}`;
}

function resolveDisplayName(profile: ProfileRow): string {
  const parts = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  if (parts) return parts;
  return profile.email?.split("@")[0] || "Participant";
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`MISSING_SECRET:${name}`);
  return value;
}

function normalizePem(raw: string): string {
  // Support secrets stored with literal \n sequences.
  let pem = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  pem = pem.trim();
  if (!pem.includes("BEGIN")) {
    // Allow base64-encoded PEM blobs.
    try {
      const decoded = atob(pem);
      if (decoded.includes("BEGIN")) pem = decoded.trim();
    } catch {
      // keep original; jose will fail clearly
    }
  }
  return pem;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowedOrigin = resolveAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function resolveAllowedOrigin(origin: string | null): string {
  const configured = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (origin && configured.includes(origin)) return origin;

  if (origin && isTrustedDevOrigin(origin)) return origin;

  // Non-browser / same-origin tooling: no Origin header.
  if (!origin && configured[0]) return configured[0];
  if (!origin) return "http://localhost:5173";

  // Reject unknown browser origins by not reflecting them.
  return configured[0] ?? "http://localhost:5173";
}

function isTrustedDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.hostname.endsWith(".lovable.app")) return true;
    if (url.hostname.endsWith(".lovableproject.com")) return true;
    return false;
  } catch {
    return false;
  }
}

function json(body: Record<string, unknown>, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
    },
  });
}
