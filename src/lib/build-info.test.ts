import { describe, expect, it } from "vitest";
import { getAppBuildInfo } from "./build-info";

describe("getAppBuildInfo", () => {
  it("returns a non-secret fingerprint shape", () => {
    const info = getAppBuildInfo();
    expect(info.app).toBe("lern-hub-pro");
    expect(typeof info.gitSha).toBe("string");
    expect(typeof info.gitShaFull).toBe("string");
    expect(typeof info.builtAt).toBe("string");
    expect(JSON.stringify(info)).not.toMatch(/service_role|private[_-]?key|SECRET|TOKEN/i);
  });
});
