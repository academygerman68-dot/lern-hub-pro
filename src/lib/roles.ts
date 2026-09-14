import type { Database } from "@/types/database";
import type { Role, SessionUser } from "@/types/academy";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Backend `admin` maps to frontend `director` (existing UI convention). */
export function appRoleToUiRole(role: AppRole): Role {
  if (role === "admin") return "director";
  return role;
}

export function uiRoleToAppRole(role: Role): AppRole {
  if (role === "director") return "admin";
  return role;
}

export function profileToSessionUser(profile: Profile): SessionUser {
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return {
    role: appRoleToUiRole(profile.role),
    name: name || profile.email || "User",
    email: profile.email ?? "",
  };
}
