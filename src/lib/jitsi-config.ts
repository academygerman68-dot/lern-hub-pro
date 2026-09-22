/**
 * Central Jitsi / JaaS configuration.
 * JaaS (8x8.vc): set VITE_JAAS_APP_ID (public app id, not a secret).
 * Every JaaS participant must receive a signed JWT from the Edge Function.
 * Fallback without app id: public meet.jit.si.
 */

/** Public 8x8 JaaS app id from the academy VPaaS project (safe in client bundles). */
export const PUBLIC_JAAS_APP_ID = "vpaas-magic-cookie-b3c2cc44fe26435e96e8b71deecb6556";

export type JitsiProviderKind = "jitsi" | "jaas" | "none";

export type JitsiRuntimeConfig = {
  configured: boolean;
  provider: JitsiProviderKind;
  domain: string;
  /** JaaS requires one server-signed JWT for every participant. */
  requiresJwt: boolean;
  reasonIfUnavailable: string | null;
  /** Public JaaS app id (not a secret). Room is prefixed `{appId}/…`. */
  jaasAppId: string | null;
};

function readEnv(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined") return "";
  return trimmed;
}

export function getJitsiConfig(): JitsiRuntimeConfig {
  const domainOverride = readEnv(import.meta.env.VITE_JITSI_DOMAIN);
  const appId =
    readEnv(import.meta.env.VITE_JAAS_APP_ID) ||
    (domainOverride === "meet.jit.si" ? "" : PUBLIC_JAAS_APP_ID);

  // Explicit public meet.jit.si opt-out when JAAS id unset and domain forced.
  if (!appId) {
    return {
      configured: true,
      provider: "jitsi",
      domain: domainOverride || "meet.jit.si",
      requiresJwt: false,
      reasonIfUnavailable: null,
      jaasAppId: null,
    };
  }

  return {
    configured: true,
    provider: "jaas",
    domain: domainOverride && domainOverride !== "meet.jit.si" ? domainOverride : "8x8.vc",
    requiresJwt: true,
    reasonIfUnavailable: null,
    jaasAppId: appId,
  };
}

/** Deterministic unique room bound to the session row (JaaS-prefixed when applicable). */
export function buildSessionRoomName(sessionId: string, jaasAppId?: string | null): string {
  const clean = sessionId.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
  const base = `academy-${clean}`;
  // Explicit null = no prefix. Undefined = use current runtime config.
  const appId = jaasAppId === undefined ? getJitsiConfig().jaasAppId : jaasAppId;
  return appId ? `${appId}/${base}` : base;
}

export function validateLiveSessionSchedule(startsAt: string, endsAt?: string | null): void {
  const start = new Date(startsAt).getTime();
  if (!Number.isFinite(start)) throw new Error("Date de début invalide.");

  if (endsAt) {
    const end = new Date(endsAt).getTime();
    if (!Number.isFinite(end)) throw new Error("Date de fin invalide.");
    if (end <= start) throw new Error("L’heure de fin doit être après l’heure de début.");
  }
}

/** Students cannot join before the créneau starts (no early window). */
export const LIVE_SESSION_EARLY_JOIN_MS = 0;
/** Staff may open a scheduled room this long before start. */
export const LIVE_SESSION_STAFF_EARLY_START_MS = 30 * 60_000;
export const LIVE_SESSION_LATE_JOIN_MS = 15 * 60_000;
export const LIVE_SESSION_DEFAULT_DURATION_MS = 2 * 60 * 60_000;

export function getLiveSessionJoinState(input: {
  startsAt: string;
  endsAt?: string | null;
  status: "scheduled" | "live" | "completed" | "cancelled" | string;
  isStaff: boolean;
  now?: number;
}): { allowed: boolean; reason: "allowed" | "too_early" | "ended" | "closed" } {
  if (input.status === "completed" || input.status === "cancelled") {
    return { allowed: false, reason: "closed" };
  }

  const start = new Date(input.startsAt).getTime();
  const end = input.endsAt
    ? new Date(input.endsAt).getTime()
    : start + LIVE_SESSION_DEFAULT_DURATION_MS;
  const now = input.now ?? Date.now();

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { allowed: false, reason: "closed" };
  }

  if (now > end + LIVE_SESSION_LATE_JOIN_MS) {
    return { allowed: false, reason: "ended" };
  }

  if (input.status === "live") {
    return { allowed: true, reason: "allowed" };
  }

  if (input.isStaff) {
    if (now < start - LIVE_SESSION_STAFF_EARLY_START_MS) {
      return { allowed: false, reason: "too_early" };
    }
    return { allowed: true, reason: "allowed" };
  }

  // Students may join only once the créneau has started (no early access).
  if (now < start + LIVE_SESSION_EARLY_JOIN_MS) {
    return { allowed: false, reason: "too_early" };
  }
  return { allowed: true, reason: "allowed" };
}
