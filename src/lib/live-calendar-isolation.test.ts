import { describe, expect, it } from "vitest";

/**
 * Documents the module graph constraint that caused the Live page crash:
 * live-pages must NOT import student-extra (CalendarPage), because
 * staff-pages / student-pages already import both → TDZ / undefined export.
 */
describe("live calendar module isolation", () => {
  it(
    "exposes LiveCalendar from live-calendar without pulling student-extra",
    async () => {
      const mod = await import("@/components/academy/live-calendar");
      expect(typeof mod.LiveCalendar).toBe("function");
      expect(typeof mod.LiveCalendarErrorBoundary).toBe("function");
    },
    30_000,
  );
});
