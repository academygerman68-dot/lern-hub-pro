/**
 * Central Jitsi / JaaS configuration.
 * Defaults to public meet.jit.si for real WebRTC meetings (no server secrets).
 * Production: set VITE_JITSI_DOMAIN; for JaaS set VITE_JAAS_APP_ID (+ JWT via Edge Function only).
 */
export type JitsiProviderKind = "jitsi" | "jaas" | "none";

export type JitsiRuntimeConfig = {
  configured: boolean;
  provider: JitsiProviderKind;
  domain: string;
  /** When true, JWT must be fetched from Edge Function before join — never in the browser. */
  requiresJwt: boolean;
  reasonIfUnavailable: string | null;
  /** Public JaaS app id (not a secret). Room is prefixed by JaaSMeeting. */
  jaasAppId: string | null;
};

export function getJitsiConfig(): JitsiRuntimeConfig {
  const domain = (import.meta.env.VITE_JITSI_DOMAIN as string | undefined)?.trim();
  const appId = (import.meta.env.VITE_JAAS_APP_ID as string | undefined)?.trim();

  if (appId) {
    return {
      configured: true,
      provider: "jaas",
      domain: domain || "8x8.vc",
      requiresJwt: true,
      reasonIfUnavailable:
        "JaaS JWT is required. Configure the generate-jaas-token Edge Function (server secrets only).",
      jaasAppId: appId,
    };
  }

  return {
    configured: true,
    provider: "jitsi",
    domain: domain || "meet.jit.si",
    requiresJwt: false,
    reasonIfUnavailable: null,
    jaasAppId: null,
  };
}

/** Deterministic unique room bound to the session row. */
export function buildSessionRoomName(sessionId: string): string {
  const clean = sessionId.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
  return `academy-${clean}`;
}
