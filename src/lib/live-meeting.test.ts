import { describe, expect, it } from "vitest";
import {
  emergencyZoomTopic,
  isValidExternalMeetingUrl,
  isValidGoogleMeetUrl,
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

  it("accepts Google Meet and combined external URLs", () => {
    expect(isValidGoogleMeetUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
    expect(isValidGoogleMeetUrl("https://meet.google.com/")).toBe(false);
    expect(isValidExternalMeetingUrl("https://zoom.us/j/123456789")).toBe(true);
    expect(isValidExternalMeetingUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
    expect(isValidExternalMeetingUrl("https://example.com/room")).toBe(false);
  });

  it("labels the active conference in French", () => {
    expect(isZoomActive("jitsi")).toBe(false);
    expect(isZoomActive("zoom")).toBe(true);
    expect(videoProviderLabel("jitsi")).toBe("Jitsi");
    expect(videoProviderLabel("zoom")).toBe("Zoom");
    expect(videoProviderLabel("external")).toBe("Lien externe (Zoom / Meet)");
  });

  it("builds the emergency Zoom topic and duration from the session", () => {
    expect(emergencyZoomTopic("A2", "A2 Group 2")).toBe("Lern Hub — A2 — A2 Group 2");
    expect(zoomMeetingDurationMinutes("2026-09-17T08:00:00.000Z", "2026-09-17T10:00:00.000Z")).toBe(
      120,
    );
    expect(zoomMeetingDurationMinutes("2026-09-17T08:00:00.000Z", null)).toBe(120);
  });
});
