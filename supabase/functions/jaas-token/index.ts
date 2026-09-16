/**
 * Issues short-lived, room-bound JaaS JWTs for authorized live-session members.
 * Required Edge Function secrets (never expose these as VITE_* variables):
 *   JAAS_APP_ID, JAAS_KEY_ID, JAAS_PRIVATE_KEY
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...cors, "Cache-Control": "no-store", "Content-Type": "application/json" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const earlyJoinSeconds = 15 * 60;
const lateJoinSeconds = 15 * 60;
const defaultDurationSeconds = 2 * 60 * 60;

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function encodeLength(length: number): Uint8Array {
  if (length < 128) return new Uint8Array([length]);
  const bytes: number[] = [];
  for (let value = length; value > 0; value >>>= 8) bytes.unshift(value & 0xff);
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function der(tag: number, content: Uint8Array): Uint8Array {
  const length = encodeLength(content.length);
  const result = new Uint8Array(1 + length.length + content.length);
  result[0] = tag;
  result.set(length, 1);
  result.set(content, 1 + length.length);
  return result;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/** WebCrypto imports PKCS#8; JaaS-generated keys may be PKCS#1 (RSA PRIVATE KEY). */
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const rsaAlgorithmIdentifier = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ]);
  return der(0x30, concat(version, rsaAlgorithmIdentifier, der(0x04, pkcs1)));
}

function decodePrivateKey(value: string): Uint8Array {
  const pem = value.replace(/\\n/g, "\n").trim();
  const isPkcs1 = pem.includes("-----BEGIN RSA PRIVATE KEY-----");
  const encoded = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  if (!encoded) throw new Error("JAAS_PRIVATE_KEY_INVALID");
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    throw new Error("JAAS_PRIVATE_KEY_INVALID");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return isPkcs1 ? pkcs1ToPkcs8(bytes) : bytes;
}

async function signJwt(
  privateKeyPem: string,
  keyId: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodePrivateKey(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const encoder = new TextEncoder();
  const header = base64Url(
    encoder.encode(JSON.stringify({ alg: "RS256", kid: keyId, typ: "JWT" })),
  );
  const body = base64Url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signingInput),
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond(405, { error: "METHOD_NOT_ALLOWED" });

  const appId = Deno.env.get("JAAS_APP_ID")?.trim();
  const rawKeyId = Deno.env.get("JAAS_KEY_ID")?.trim();
  const privateKey = Deno.env.get("JAAS_PRIVATE_KEY")?.trim();
  if (!appId || !rawKeyId || !privateKey) {
    return respond(503, {
      error: "JAAS_NOT_CONFIGURED",
      message: "Les secrets JaaS de la fonction Supabase sont incomplets.",
    });
  }
  if (
    rawKeyId.length > 200 ||
    /[\r\n]/.test(rawKeyId) ||
    rawKeyId.includes("BEGIN PUBLIC KEY") ||
    rawKeyId.startsWith("ssh-rsa") ||
    rawKeyId.startsWith("MIIB")
  ) {
    return respond(503, {
      error: "JAAS_KEY_ID_INVALID",
      message:
        "JAAS_KEY_ID doit contenir l’identifiant de la clé affiché par JaaS, pas la clé publique.",
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond(401, { error: "UNAUTHORIZED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return respond(503, { error: "SUPABASE_NOT_CONFIGURED" });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return respond(401, { error: "UNAUTHORIZED" });

  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!uuidPattern.test(sessionId)) return respond(400, { error: "INVALID_SESSION_ID" });

  // RLS is intentional: only admins, the assigned teacher, and actively enrolled
  // students can read this row and therefore receive a room token.
  const { data: session, error: sessionError } = await supabase
    .from("live_sessions")
    .select("id,status,starts_at,ends_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) return respond(500, { error: "SESSION_LOOKUP_FAILED" });
  if (!session) return respond(403, { error: "SESSION_ACCESS_DENIED" });
  if (session.status === "completed" || session.status === "cancelled") {
    return respond(403, { error: "SESSION_CLOSED" });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,status,first_name,last_name,email,avatar_url")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profile || profile.status !== "active") {
    return respond(403, { error: "PROFILE_INACTIVE" });
  }

  if (profile.role === "student") {
    const { data: studentId, error: studentError } = await supabase.rpc("current_student_id");
    if (studentError || !studentId) return respond(403, { error: "STUDENT_RECORD_MISSING" });
    const { data: hasAcademicAccess, error: accessError } = await supabase.rpc(
      "has_academic_access",
      { p_student_id: studentId },
    );
    if (accessError || !hasAcademicAccess) {
      return respond(403, { error: "SUBSCRIPTION_REQUIRED" });
    }
  }

  const isModerator = profile.role === "admin" || profile.role === "teacher";
  const now = Math.floor(Date.now() / 1000);
  const startsAt = Math.floor(new Date(session.starts_at).getTime() / 1000);
  const endsAt = session.ends_at
    ? Math.floor(new Date(session.ends_at).getTime() / 1000)
    : startsAt + defaultDurationSeconds;
  if (!isModerator && now < startsAt - earlyJoinSeconds) {
    return respond(403, { error: "SESSION_TOO_EARLY" });
  }
  if (!isModerator && now > endsAt + lateJoinSeconds) {
    return respond(403, { error: "SESSION_ENDED" });
  }

  const roomAlias = `academy-${session.id.toLowerCase()}`;
  const roomName = `${appId}/${roomAlias}`;
  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  const keyId = rawKeyId.startsWith(`${appId}/`) ? rawKeyId : `${appId}/${rawKeyId}`;
  const expiresAt = Math.min(now + 3 * 60 * 60, Math.max(now + 5 * 60, endsAt + lateJoinSeconds));

  try {
    const jwt = await signJwt(privateKey, keyId, {
      aud: "jitsi",
      iss: "chat",
      sub: appId,
      room: roomAlias,
      nbf: now - 10,
      exp: expiresAt,
      context: {
        room: { regex: false },
        user: {
          id: userData.user.id,
          name: fullName || userData.user.email || "Participant",
          email: profile.email || userData.user.email || "",
          avatar: profile.avatar_url || "",
          moderator: isModerator ? "true" : "false",
        },
        features: {
          livestreaming: "false",
          recording: isModerator ? "true" : "false",
          transcription: "false",
          "outbound-call": "false",
        },
      },
    });
    return respond(200, { jwt, roomName, expiresAt });
  } catch (error) {
    console.error("Unable to sign JaaS JWT", error instanceof Error ? error.message : error);
    return respond(503, {
      error: "JAAS_SIGNING_FAILED",
      message: "La clé privée JaaS est invalide ou illisible.",
    });
  }
});
