export type VideoProvider = "jitsi" | "zoom";

export type LiveJoinTargetLike = {
  provider: VideoProvider | string;
  url: string | null;
  room: string | null;
  start_url: string | null;
};

export function isZoomActive(provider: string | null | undefined) {
  return provider === "zoom";
}

export function zoomMeetingDurationMinutes(startsAt: string, endsAt?: string | null) {
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + 120 * 60_000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 120;
  return Math.max(1, Math.min(24 * 60, Math.round((end - start) / 60_000)));
}

export function emergencyZoomTopic(
  level: string | null | undefined,
  group: string | null | undefined,
) {
  return `Lern Hub — ${level?.trim() || "Cours"} — ${group?.trim() || "Groupe"}`;
}

export function videoProviderLabel(provider: string | null | undefined, emergency = false) {
  if (provider === "zoom") {
    return emergency ? "Zoom — mode d’urgence" : "Zoom — réunion d’urgence";
  }
  return "Jitsi";
}

export function liveStatusLabel(status: string) {
  if (status === "live") return "En direct";
  if (status === "scheduled") return "Planifiée";
  if (status === "completed") return "Terminée";
  if (status === "cancelled") return "Annulée";
  return status;
}

export function formatLiveTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function formatLiveDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function isValidZoomMeetingUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    const zoomHost =
      host === "zoom.us" ||
      host.endsWith(".zoom.us") ||
      host === "zoom.com.cn" ||
      host.endsWith(".zoom.com.cn");
    if (!zoomHost) return false;
    return /\/(j|my|w|wc|meeting|start)\b/i.test(url.pathname + url.hash);
  } catch {
    return false;
  }
}

export function openExternalMeeting(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/** True when the session window is over (status or end time + grace). */
export function isLiveSessionExpired(
  session: {
    status: string;
    starts_at: string;
    ends_at?: string | null;
  },
  now = Date.now(),
  graceMs = 15 * 60_000,
) {
  if (session.status === "completed" || session.status === "cancelled") return true;
  const start = new Date(session.starts_at).getTime();
  const end = session.ends_at
    ? new Date(session.ends_at).getTime()
    : start + 2 * 3600_000;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
  return now > end + graceMs;
}

/** Resolve Zoom start/join URL for the current viewer. */
export function zoomHrefForViewer(target: LiveJoinTargetLike, isStaff: boolean) {
  return isStaff ? target.start_url || target.url : target.url;
}

/**
 * Join a live session via the joinTarget RPC first.
 * Zoom opens externally; Jitsi delegates to onJitsi. Never mounts Jitsi for Zoom.
 */
export async function joinLiveSession(
  sessionId: string,
  options: {
    isStaff: boolean;
    onJitsi: (id: string) => void;
    resolveTarget: (id: string) => Promise<LiveJoinTargetLike>;
  },
): Promise<"zoom" | "jitsi"> {
  const target = await options.resolveTarget(sessionId);
  if (target.provider === "zoom") {
    const href = zoomHrefForViewer(target, options.isStaff);
    if (!href) throw new Error("La réunion Zoom n’est pas encore prête.");
    openExternalMeeting(href);
    return "zoom";
  }
  options.onJitsi(sessionId);
  return "jitsi";
}
