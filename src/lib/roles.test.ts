import { describe, expect, it } from "vitest";
import { appRoleToUiRole, uiRoleToAppRole } from "./roles";

describe("role mapping", () => {
  it("maps admin <-> director", () => {
    expect(appRoleToUiRole("admin")).toBe("director");
    expect(uiRoleToAppRole("director")).toBe("admin");
  });

  it("keeps teacher and student", () => {
    expect(appRoleToUiRole("teacher")).toBe("teacher");
    expect(appRoleToUiRole("student")).toBe("student");
    expect(uiRoleToAppRole("teacher")).toBe("teacher");
    expect(uiRoleToAppRole("student")).toBe("student");
  });
});
