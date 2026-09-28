/**
 * Non-sensitive deploy fingerprint for staff diagnostics.
 * Never include secrets, private keys, or infrastructure credentials.
 */

export type AppBuildInfo = {
  /** Short SHA (7 chars) when known. */
  gitSha: string;
  /** Full SHA when known. */
  gitShaFull: string;
  /** ISO timestamp from the build that produced this bundle. */
  builtAt: string;
  app: "lern-hub-pro";
};

function readEnv(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getAppBuildInfo(): AppBuildInfo {
  const full =
    readEnv(import.meta.env.VITE_APP_GIT_SHA) ||
    readEnv(import.meta.env.VITE_GIT_SHA) ||
    "unknown";
  const builtAt = readEnv(import.meta.env.VITE_APP_BUILT_AT) || "unknown";
  return {
    app: "lern-hub-pro",
    gitShaFull: full,
    gitSha: full === "unknown" ? "unknown" : full.slice(0, 7),
    builtAt,
  };
}
