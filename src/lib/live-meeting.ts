export type VideoProvider = "jitsi" | "zoom";

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
