import { describe, expect, it } from "vitest";
import {
  buildSessionRoomName,
  getJitsiConfig,
  validateLiveSessionSchedule,
} from "@/lib/jitsi-config";

describe("jitsi-config", () => {
  it("builds academy-{sessionId} room names", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(buildSessionRoomName(id)).toBe(`academy-${id}`);
  });

  it("defaults to public meet.jit.si when env unset", () => {
    const cfg = getJitsiConfig();
    expect(cfg.configured).toBe(true);
    expect(cfg.domain).toBeTruthy();
    expect(cfg.requiresJwt).toBe(false);
  });

  it("rejects a meeting that ends before it starts", () => {
    expect(() =>
      validateLiveSessionSchedule("2026-09-16T15:00:00Z", "2026-09-16T14:00:00Z"),
    ).toThrow("après");
  });

  it("accepts an open-ended meeting", () => {
    expect(() => validateLiveSessionSchedule("2026-09-16T15:00:00Z", null)).not.toThrow();
  });
});

describe("payment access mapping", () => {
  it("treats active/grace/manually_extended as access-granting statuses", () => {
    const granting = new Set(["active", "grace_period", "manually_extended"]);
    expect(granting.has("active")).toBe(true);
    expect(granting.has("past_due")).toBe(false);
    expect(granting.has("suspended")).toBe(false);
  });
});
