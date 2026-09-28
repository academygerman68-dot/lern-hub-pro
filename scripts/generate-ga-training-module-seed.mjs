/**
 * Generate idempotent draft seed SQL for a GA training module JSON.
 * Usage: node scripts/generate-ga-training-module-seed.mjs GA-A1-M02
 * Does NOT apply to Supabase.
 */
import fs from "fs";
import path from "path";

const code = process.argv[2];
if (!/^GA-[A-C][0-9]-M\d{2}$/.test(code ?? "")) {
  console.error("Usage: node scripts/generate-ga-training-module-seed.mjs GA-A1-M0X");
  process.exit(1);
}

const modulePath = path.resolve(`data/exams/a1-b1-series/modules/${code}.json`);
const def = JSON.parse(fs.readFileSync(modulePath, "utf8"));
if (def.module_id !== code) {
  console.error("module_id mismatch");
  process.exit(1);
}
if (def.publication_status !== "draft") {
  console.error("Refusing to seed non-draft module");
  process.exit(1);
}

const json = JSON.stringify(def).replace(/\$/g, "");
const seq = String(def.sequence).padStart(2, "0");
const uuid = `a1b10001-0001-4000-8000-0000000001${seq}`;

function dollar(tag, value) {
  return `$${tag}$${value}$${tag}$`;
}

const outName = `supabase/migrations/2026092818${seq}00_seed_${code.toLowerCase().replace(/-/g, "_")}_training_module.sql`;
const sql = `-- Seed ${code} into training_modules as draft (idempotent) — DO NOT apply without confirmation.
INSERT INTO public.training_modules (
  id, code, level_code, title, theme, estimated_minutes, status, format_profile, definition, version, published_at
) VALUES (
  '${uuid}'::uuid,
  '${code}',
  'A1',
  ${dollar("t", def.title)},
  ${dollar("th", def.theme)},
  ${Number(def.estimated_minutes)},
  'draft',
  'ga_training_module_v1',
  ${dollar("json", json)}::jsonb,
  ${dollar("v", def.provenance.version)},
  NULL
)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  theme = EXCLUDED.theme,
  estimated_minutes = EXCLUDED.estimated_minutes,
  definition = EXCLUDED.definition,
  version = EXCLUDED.version,
  format_profile = EXCLUDED.format_profile,
  status = CASE
    WHEN public.training_modules.status = 'published' THEN public.training_modules.status
    ELSE EXCLUDED.status
  END,
  published_at = CASE
    WHEN public.training_modules.status = 'published' THEN public.training_modules.published_at
    ELSE NULL
  END,
  updated_at = now();
`;

fs.writeFileSync(outName, sql);
console.log("OK wrote", outName, "bytes", sql.length, "status=draft published_at=NULL NOT applied");
