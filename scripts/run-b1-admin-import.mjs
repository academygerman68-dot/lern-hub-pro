/**
 * Local admin runner: import B1 drafts + attach audios using Supabase CLI auth.
 * Never prints secrets. Never publishes. Never writes keys to frontend env files.
 *
 * Usage:
 *   node scripts/run-b1-admin-import.mjs --dry-run
 *   node scripts/run-b1-admin-import.mjs --import
 *   node scripts/run-b1-admin-import.mjs --attach "tmp/Audios-B1"
 *   node scripts/run-b1-admin-import.mjs --all "tmp/Audios-B1"
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "omxemusaqgzkogqvcdfw";
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;

function parseArgs(argv) {
  const args = { dryRun: false, doImport: false, attach: null, all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--import") args.doImport = true;
    else if (a === "--attach") args.attach = resolve(argv[++i] ?? "");
    else if (a === "--all") {
      args.all = true;
      args.doImport = true;
      args.attach = resolve(argv[++i] ?? "tmp/Audios-B1");
    }
  }
  return args;
}

function loadServiceRoleFromCli() {
  const res = spawnSync(
    "supabase",
    ["projects", "api-keys", "--project-ref", PROJECT_REF, "-o", "json"],
    { encoding: "utf8", shell: true },
  );
  if (res.status !== 0) {
    throw new Error(
      `CLI api-keys failed (exit ${res.status}). Authenticate with: supabase login`,
    );
  }
  // stdout only — ignore stderr version banners mixed by shells
  let raw = (res.stdout || "").trim();
  // Some shells merge stderr; keep from first [ or {
  const iArr = raw.indexOf("[");
  const iObj = raw.indexOf("{");
  let start = -1;
  if (iArr >= 0 && (iObj < 0 || iArr < iObj)) start = iArr;
  else if (iObj >= 0) start = iObj;
  if (start < 0) throw new Error("CLI returned no JSON for api-keys");
  raw = raw.slice(start);
  // Trim trailing non-JSON (warnings)
  const endArr = raw.lastIndexOf("]");
  const endObj = raw.lastIndexOf("}");
  const end = Math.max(endArr, endObj);
  if (end >= 0) raw = raw.slice(0, end + 1);

  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed.keys || [];
  const service =
    list.find((k) => k.id === "service_role" || k.name === "service_role") ||
    list.find(
      (k) =>
        k.type === "secret" ||
        (k.secret_jwt_template && k.secret_jwt_template.role === "service_role"),
    );
  const value = service?.api_key || service?.key;
  if (!value) throw new Error("service_role key not found via CLI");
  return value;
}

function runNode(script, scriptArgs, env) {
  const res = spawnSync(process.execPath, [script, ...scriptArgs], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    shell: false,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) {
    // redact any accidental JWT-looking tokens
    const cleaned = res.stderr.replace(/eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, "eyJ***REDACTED***");
    process.stderr.write(cleaned);
  }
  return res.status ?? 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dryRun && !args.doImport && !args.attach) {
    console.log("Usage:");
    console.log("  node scripts/run-b1-admin-import.mjs --dry-run");
    console.log("  node scripts/run-b1-admin-import.mjs --import");
    console.log('  node scripts/run-b1-admin-import.mjs --attach "tmp/Audios-B1"');
    console.log('  node scripts/run-b1-admin-import.mjs --all "tmp/Audios-B1"');
    process.exit(0);
  }

  if (args.dryRun) {
    const code = runNode("scripts/import-b1-exam-bank.mjs", ["--dry-run"], {});
    process.exit(code);
  }

  console.log(`Using project ${PROJECT_REF} via Supabase CLI (secrets not logged).`);
  let serviceRole;
  try {
    serviceRole = loadServiceRoleFromCli();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error("Stopped: cannot obtain server credentials from CLI.");
    process.exit(1);
  }

  const env = {
    SUPABASE_URL: PROJECT_URL,
    SUPABASE_SERVICE_ROLE_KEY: serviceRole,
  };

  if (args.doImport) {
    console.log("\n=== Import B1 drafts (structured + confirmed keys if coherent) ===");
    const code = runNode(
      "scripts/import-b1-exam-bank.mjs",
      ["--with-confirmed-keys", "tmp/b1-answer-keys-visual.json"],
      env,
    );
    if (code !== 0) process.exit(code);
  }

  if (args.attach) {
    if (!existsSync(args.attach)) {
      console.error(`Audio root missing: ${args.attach}`);
      process.exit(1);
    }
    console.log("\n=== Attach Hören audios from inventory ===");
    const code = runNode(
      "scripts/attach-b1-audio.mjs",
      [args.attach, "--from-inventory", "tmp/b1-audio-inventory.json"],
      env,
    );
    if (code !== 0) process.exit(code);
  }

  console.log("\nDone. No publish. No push.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
