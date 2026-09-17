import { describe, expect, it } from "vitest";
import {
  emergencyZoomTopic,
  isValidZoomMeetingUrl,
  isZoomActive,
  videoProviderLabel,
  zoomMeetingDurationMinutes,
} from "./live-meeting";

describe("live meeting helpers", () => {
  it("accepts official Zoom join URLs only", () => {
    expect(isValidZoomMeetingUrl("https://zoom.us/j/123456789")).toBe(true);
    expect(isValidZoomMeetingUrl("https://us06web.zoom.us/j/123?pwd=abc")).toBe(true);
    expect(isValidZoomMeetingUrl("https://zoom.us/my/classroom")).toBe(true);
    expect(isValidZoomMeetingUrl("http://zoom.us/j/123")).toBe(false);
    expect(isValidZoomMeetingUrl("https://example.com/j/123")).toBe(false);
    expect(isValidZoomMeetingUrl("not-a-url")).toBe(false);
  });

  it("labels the active conference in French", () => {
    expect(isZoomActive("jitsi")).toBe(false);
    expect(isZoomActive("zoom")).toBe(true);
    expect(videoProviderLabel("jitsi")).toBe("Jitsi");
    expect(videoProviderLabel("zoom", true)).toBe("Zoom — mode d’urgence");
  });

  it("builds the emergency Zoom topic and duration from the session", () => {
    expect(emergencyZoomTopic("A2", "A2 Group 2")).toBe("Lern Hub — A2 — A2 Group 2");
    expect(zoomMeetingDurationMinutes("2026-09-17T08:00:00.000Z", "2026-09-17T10:00:00.000Z")).toBe(
      120,
    );
    expect(zoomMeetingDurationMinutes("2026-09-17T08:00:00.000Z", null)).toBe(120);
  });
});
