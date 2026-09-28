import fs from "fs";

const def = JSON.parse(
  fs.readFileSync("data/exams/a1-b1-series/modules/GA-A1-M01.json", "utf8"),
);
const json = JSON.stringify(def).replace(/\$/g, "");

function dollar(tag, value) {
  return `$${tag}$${value}$${tag}$`;
}

const sql = `-- Seed GA-A1-M01 into training_modules as draft (idempotent)
INSERT INTO public.training_modules (
  id, code, level_code, title, theme, estimated_minutes, status, format_profile, definition, version
) VALUES (
  'a1b10001-0001-4000-8000-000000000101'::uuid,
  'GA-A1-M01',
  'A1',
  ${dollar("t", def.title)},
  ${dollar("th", def.theme)},
  ${Number(def.estimated_minutes)},
  'draft',
  'ga_training_module_v1',
  ${dollar("json", json)}::jsonb,
  ${dollar("v", def.provenance.version)}
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
  updated_at = now();
`;

fs.writeFileSync(
  "supabase/migrations/20260928171000_seed_ga_a1_m01_training_module.sql",
  sql,
);
console.log("OK seed bytes", sql.length);
