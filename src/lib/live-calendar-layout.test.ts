import { describe, expect, it } from "vitest";
import {
  calendarEventLayout,
  calendarMonthChipLabel,
  calendarNowLinePct,
  calendarPeriodLabel,
} from "./live-calendar-layout";

function localIso(year: number, monthIndex: number, day: number, hour: number, minute = 0) {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).toISOString();
}

describe("calendar week event layout", () => {
  it("positions a 19:00–21:00 session inside an 8–22 grid", () => {
    const layout = calendarEventLayout(localIso(2026, 8, 18, 19), localIso(2026, 8, 18, 21));
    expect(layout.topPct).toBeCloseTo(((19 - 8) / 14) * 100, 1);
    expect(layout.heightPct).toBeCloseTo((2 / 14) * 100, 1);
    expect(layout.clipped).toBe(false);
  });

  it("defaults duration when ends_at is missing", () => {
    const layout = calendarEventLayout(localIso(2026, 8, 18, 10), null);
    expect(layout.heightPct).toBeCloseTo((2 / 14) * 100, 1);
  });
});

describe("calendar now line", () => {
  it("returns null outside the visible hours", () => {
    expect(calendarNowLinePct(new Date(2026, 8, 18, 6, 0, 0))).toBeNull();
  });

  it("returns a percentage inside the grid", () => {
    const pct = calendarNowLinePct(new Date(2026, 8, 18, 15, 0, 0));
    expect(pct).not.toBeNull();
    expect(pct!).toBeCloseTo(((15 - 8) / 14) * 100, 1);
  });
});

describe("calendar month chip", () => {
  it("shows time and title", () => {
    const label = calendarMonthChipLabel(localIso(2026, 8, 18, 21), "Cours A1");
    expect(label).toContain("Cours A1");
    expect(label).toMatch(/\d{2}:\d{2}/);
  });
});

describe("calendar period label", () => {
  it("formats month view in French", () => {
    const label = calendarPeriodLabel(new Date(2026, 8, 15), "month");
    expect(label.toLowerCase()).toContain("septembre");
    expect(label).toContain("2026");
  });
});
