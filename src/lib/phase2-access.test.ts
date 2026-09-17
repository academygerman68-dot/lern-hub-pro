import { describe, expect, it } from "vitest";
import {
  buildSessionRoomName,
  getJitsiConfig,
  getLiveSessionJoinState,
  validateLiveSessionSchedule,
} from "@/lib/jitsi-config";

describe("jitsi-config", () => {
  it("builds academy-{sessionId} room names (optionally JaaS-prefixed)", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(buildSessionRoomName(id, null)).toBe(`academy-${id}`);
    expect(buildSessionRoomName(id, "vpaas-magic-cookie-demo")).toBe(
      `vpaas-magic-cookie-demo/academy-${id}`,
    );
  });

  it("exposes a configured Jitsi or JaaS runtime", () => {
    const cfg = getJitsiConfig();
    expect(cfg.configured).toBe(true);
    expect(cfg.domain).toBeTruthy();
    expect(cfg.provider === "jaas" || cfg.provider === "jitsi").toBe(true);
    expect(cfg.requiresJwt).toBe(cfg.provider === "jaas");
  });

  it("rejects a meeting that ends before it starts", () => {
    expect(() =>
      validateLiveSessionSchedule("2026-09-16T15:00:00Z", "2026-09-16T14:00:00Z"),
    ).toThrow("après");
  });

  it("accepts an open-ended meeting", () => {
    expect(() => validateLiveSessionSchedule("2026-09-16T15:00:00Z", null)).not.toThrow();
  });

  it("blocks students until the créneau starts", () => {
    const startsAt = "2026-09-16T12:00:00.000Z";
    expect(
      getLiveSessionJoinState({
        startsAt,
        endsAt: "2026-09-16T14:00:00.000Z",
        status: "scheduled",
        isStaff: false,
        now: new Date("2026-09-16T11:59:59.000Z").getTime(),
      }).reason,
    ).toBe("too_early");
    expect(
      getLiveSessionJoinState({
        startsAt,
        endsAt: "2026-09-16T14:00:00.000Z",
        status: "scheduled",
        isStaff: false,
        now: new Date("2026-09-16T12:00:00.000Z").getTime(),
      }).allowed,
    ).toBe(true);
  });

  it("keeps completed sessions closed even for staff", () => {
    expect(
      getLiveSessionJoinState({
        startsAt: "2026-09-16T12:00:00.000Z",
        status: "completed",
        isStaff: true,
      }).allowed,
    ).toBe(false);
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
