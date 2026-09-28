// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

function resolveGitSha(): string {
  const fromEnv =
    process.env["VITE_APP_GIT_SHA"] ||
    process.env["VERCEL_GIT_COMMIT_SHA"] ||
    process.env["CF_PAGES_COMMIT_SHA"] ||
    process.env["GITHUB_SHA"];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const gitShaFull = resolveGitSha();
const gitShaShort = gitShaFull === "unknown" ? "unknown" : gitShaFull.slice(0, 7);
const builtAt = new Date().toISOString();

function emitBuildInfoPlugin(): Plugin {
  const payload = {
    app: "lern-hub-pro",
    gitSha: gitShaShort,
    gitShaFull,
    builtAt,
  };
  const json = `${JSON.stringify(payload, null, 2)}\n`;

  return {
    name: "emit-build-info",
    buildStart() {
      mkdirSync("public", { recursive: true });
      writeFileSync("public/build-info.json", json);
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_APP_GIT_SHA": JSON.stringify(gitShaFull),
      "import.meta.env.VITE_APP_BUILT_AT": JSON.stringify(builtAt),
    },
    plugins: [emitBuildInfoPlugin()],
  },
});
