/**
 * Creates an emergency Zoom meeting for a live session (Jitsi fallback).
 * Secrets (never expose as VITE_*): ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID,
 * ZOOM_CLIENT_SECRET, ZOOM_HOST_USER_ID.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...cors, "Cache-Control": "no-store", "Content-Type": "application/json" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const defaultDurationMinutes = 120;
const defaultTimezone = "Europe/Berlin";

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function clientMessage(code: string) {
  if (code === "ZOOM_ACCOUNT_LIMIT") {
    return "Le compte Zoom configuré ne permet pas actuellement de créer cette réunion.";
  }
  return "Impossible de créer la réunion Zoom d’urgence. Veuillez réessayer dans quelques instants.";
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readSecret(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function formatZoomStart(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}`;
}

function durationMinutes(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + defaultDurationMinutes * 60_000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return defaultDurationMinutes;
  }
  return Math.max(1, Math.min(24 * 60, Math.round((end - start) / 60_000)));
}

function parseTimezone(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim().replace(/^"|"$/g, "");
  return defaultTimezone;
}

async function zoomAccessToken(accountId: string, clientId: string, clientSecret: string) {
  const basic = btoa(`${clientId}:${clientSecret}`);
  const url = new URL("https://zoom.us/oauth/token");
  url.searchParams.set("grant_type", "account_credentials");
  url.searchParams.set("account_id", accountId);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    reason?: string;
  };
  if (!response.ok || !payload.access_token) {
    console.error("Zoom OAuth failed", response.status, payload.error ?? payload.reason ?? "unknown");
    throw new Error(response.status === 429 ? "ZOOM_ACCOUNT_LIMIT" : "ZOOM_OAUTH_FAILED");
  }
  return payload.access_token;
}

type ZoomMeeting = {
  id?: number | string;
  join_url?: string;
  start_url?: string;
  password?: string;
  code?: number;
  message?: string;
};

async function createZoomMeeting(
  token: string,
  hostUserId: string,
  input: {
    topic: string;
    startTime: string;
    duration: number;
    timezone: string;
  },
) {
  const response = await fetch(
    `https://api.zoom.us/v2/users/${encodeURIComponent(hostUserId)}/meetings`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: input.topic,
        type: 2,
        start_time: input.startTime,
        duration: input.duration,
        timezone: input.timezone,
        settings: {
          join_before_host: false,
          waiting_room: true,
          mute_upon_entry: true,
        },
      }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as ZoomMeeting;
  if (!response.ok || !payload.id || !payload.join_url || !payload.start_url) {
    console.error(
      "Zoom meeting create failed",
      response.status,
      payload.code ?? payload.message ?? "unknown",
    );
    if (response.status === 404) throw new Error("ZOOM_HOST_MISSING");
    if (response.status === 429 || payload.code === 300) throw new Error("ZOOM_ACCOUNT_LIMIT");
    if (response.status === 403) throw new Error("ZOOM_ACCOUNT_LIMIT");
    throw new Error("ZOOM_CREATE_FAILED");
  }
  return {
    id: String(payload.id),
    joinUrl: payload.join_url,
    startUrl: payload.start_url,
    password: asString(payload.password) || null,
  };
}

async function waitForReady(
  userClient: ReturnType<typeof createClient>,
  sessionId: string,
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const { data, error } = await userClient.rpc("live_session_join_target", {
      p_session_id: sessionId,
    });
    if (!error && data && typeof data === "object" && !Array.isArray(data) && data.provider === "zoom") {
      return true;
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond(405, { error: "METHOD_NOT_ALLOWED" });

  const accountId = readSecret("ZOOM_ACCOUNT_ID");
  const clientId = readSecret("ZOOM_CLIENT_ID");
  const clientSecret = readSecret("ZOOM_CLIENT_SECRET");
  const hostUserId = readSecret("ZOOM_HOST_USER_ID");
  if (!accountId || !clientId || !clientSecret || !hostUserId) {
    console.error("Zoom Edge Function secrets are incomplete");
    return respond(503, { error: "ZOOM_NOT_CONFIGURED", message: clientMessage("ZOOM_NOT_CONFIGURED") });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return respond(503, { error: "SUPABASE_NOT_CONFIGURED", message: clientMessage("SUPABASE_NOT_CONFIGURED") });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond(401, { error: "UNAUTHORIZED" });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return respond(401, { error: "UNAUTHORIZED" });

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role,status")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.status !== "active") {
    return respond(403, { error: "FORBIDDEN" });
  }
  if (profile.role !== "admin" && profile.role !== "teacher") {
    return respond(403, { error: "FORBIDDEN" });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = asString(body.sessionId);
  if (!uuidPattern.test(sessionId)) return respond(400, { error: "INVALID_SESSION_ID" });

  const { data: session, error: sessionError } = await userClient
    .from("live_sessions")
    .select("id,class_id,title,starts_at,ends_at,status,video_provider")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) return respond(500, { error: "SESSION_LOOKUP_FAILED", message: clientMessage("SESSION_LOOKUP_FAILED") });
  if (!session) return respond(403, { error: "FORBIDDEN" });

  if (profile.role === "teacher") {
    const { data: ownsClass, error: ownsError } = await userClient.rpc("is_teacher_of_class", {
      p_class_id: session.class_id,
    });
    if (ownsError || ownsClass !== true) return respond(403, { error: "FORBIDDEN" });
  }

  const { data: claim, error: claimError } = await userClient.rpc("claim_emergency_zoom", {
    p_session_id: sessionId,
  });
  if (claimError) {
    const text = claimError.message ?? "";
    if (text.includes("SESSION_ACCESS_DENIED")) return respond(403, { error: "FORBIDDEN" });
    if (text.includes("SESSION_CLOSED")) return respond(409, { error: "SESSION_CLOSED" });
    console.error("claim_emergency_zoom failed", text);
    return respond(500, { error: "CLAIM_FAILED", message: clientMessage("CLAIM_FAILED") });
  }

  const status = claim && typeof claim === "object" && !Array.isArray(claim) ? asString(claim.status) : "";
  if (status === "ready") {
    return respond(200, { ok: true, reused: true, provider: "zoom" });
  }
  if (status === "creating") {
    const ready = await waitForReady(userClient, sessionId);
    if (!ready) {
      return respond(409, { error: "ZOOM_IN_PROGRESS", message: clientMessage("ZOOM_IN_PROGRESS") });
    }
    return respond(200, { ok: true, reused: true, provider: "zoom" });
  }
  if (status !== "create") {
    return respond(500, { error: "CLAIM_FAILED", message: clientMessage("CLAIM_FAILED") });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: classRow } = await admin
      .from("classes")
      .select("name, level:levels!classes_level_id_fkey(code)")
      .eq("id", session.class_id)
      .maybeSingle();
    const level = Array.isArray(classRow?.level)
      ? classRow?.level[0]?.code
      : (classRow?.level as { code?: string } | null)?.code;
    const topic = `Lern Hub — ${level || "Cours"} — ${classRow?.name || session.title || "Groupe"}`;

    const { data: tzRow } = await admin.from("app_settings").select("value").eq("key", "timezone").maybeSingle();
    const timezone = parseTimezone(tzRow?.value);
    const startTime = formatZoomStart(session.starts_at, timezone);
    if (!startTime) throw new Error("ZOOM_CREATE_FAILED");

    const token = await zoomAccessToken(accountId, clientId, clientSecret);
    const meeting = await createZoomMeeting(token, hostUserId, {
      topic,
      startTime,
      duration: durationMinutes(session.starts_at, session.ends_at),
      timezone,
    });

    const { error: saveError } = await admin
      .from("live_sessions")
      .update({
        video_provider: "zoom",
        zoom_meeting_id: meeting.id,
        zoom_join_url: meeting.joinUrl,
        zoom_start_url: meeting.startUrl,
        zoom_password: meeting.password,
        zoom_url: meeting.joinUrl,
        zoom_created_at: new Date().toISOString(),
        zoom_creating_at: null,
      })
      .eq("id", sessionId);
    if (saveError) {
      console.error("Failed to persist Zoom meeting", saveError.message);
      throw new Error("ZOOM_SAVE_FAILED");
    }

    console.log("Emergency Zoom meeting created", meeting.id);
    return respond(200, { ok: true, reused: false, provider: "zoom" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ZOOM_CREATE_FAILED";
    await userClient.rpc("release_emergency_zoom_lock", { p_session_id: sessionId });
    return respond(502, { error: code, message: clientMessage(code) });
  }
});
