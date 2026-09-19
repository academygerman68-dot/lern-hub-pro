/** Shared calendar layout helpers (pure — safe for unit tests). */

export const CALENDAR_DAY_START_HOUR = 8;
export const CALENDAR_DAY_END_HOUR = 22;
export const CALENDAR_PX_PER_HOUR = 56;

export function calendarDayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function calendarIsSameDay(a: Date, b: Date) {
  return calendarDayKey(a) === calendarDayKey(b);
}

export function calendarStatusTone(status: string): "green" | "amber" | "gray" | "red" {
  if (status === "live") return "green";
  if (status === "scheduled") return "amber";
  if (status === "cancelled") return "red";
  return "gray";
}

export function calendarHourLabels(
  startHour = CALENDAR_DAY_START_HOUR,
  endHour = CALENDAR_DAY_END_HOUR,
) {
  const labels: number[] = [];
  for (let h = startHour; h < endHour; h += 1) labels.push(h);
  return labels;
}

export function calendarGridHeightPx(
  startHour = CALENDAR_DAY_START_HOUR,
  endHour = CALENDAR_DAY_END_HOUR,
  pxPerHour = CALENDAR_PX_PER_HOUR,
) {
  return (endHour - startHour) * pxPerHour;
}

/** Position an event inside the week time grid (percentages of the day column). */
export function calendarEventLayout(
  startsAt: string,
  endsAt: string | null | undefined,
  options?: {
    startHour?: number;
    endHour?: number;
    defaultDurationMinutes?: number;
  },
): { topPct: number; heightPct: number; clipped: boolean } {
  const startHour = options?.startHour ?? CALENDAR_DAY_START_HOUR;
  const endHour = options?.endHour ?? CALENDAR_DAY_END_HOUR;
  const defaultMinutes = options?.defaultDurationMinutes ?? 120;
  const daySpanMinutes = (endHour - startHour) * 60;

  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + defaultMinutes * 60_000);

  const startMinutes = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60;
  const endMinutes = end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60;
  const gridStart = startHour * 60;
  const gridEnd = endHour * 60;

  const clampedStart = Math.max(gridStart, Math.min(gridEnd, startMinutes));
  const clampedEnd = Math.max(clampedStart + 20, Math.min(gridEnd, endMinutes));
  const topPct = ((clampedStart - gridStart) / daySpanMinutes) * 100;
  const heightPct = ((clampedEnd - clampedStart) / daySpanMinutes) * 100;
  const clipped = startMinutes < gridStart || endMinutes > gridEnd;

  return { topPct, heightPct: Math.max(heightPct, 3.5), clipped };
}

export function calendarNowLinePct(
  now: Date,
  options?: { startHour?: number; endHour?: number },
): number | null {
  const startHour = options?.startHour ?? CALENDAR_DAY_START_HOUR;
  const endHour = options?.endHour ?? CALENDAR_DAY_END_HOUR;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const gridStart = startHour * 60;
  const gridEnd = endHour * 60;
  if (minutes < gridStart || minutes > gridEnd) return null;
  return ((minutes - gridStart) / (gridEnd - gridStart)) * 100;
}

export function calendarMonthChipLabel(startsAt: string, title: string) {
  const time = new Date(startsAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const shortTitle = title.trim().length > 22 ? `${title.trim().slice(0, 20)}…` : title.trim();
  return `${time} · ${shortTitle || "Séance"}`;
}

export function calendarFormatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function calendarPeriodLabel(anchor: Date, view: "week" | "month") {
  if (view === "month") {
    return anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }
  const day = (anchor.getDay() + 6) % 7;
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} ${start.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    })}`;
  }
  return `${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${end.toLocaleDateString(
    "fr-FR",
    { day: "numeric", month: "short", year: "numeric" },
  )}`;
}
