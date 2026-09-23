/**
 * Attach inventoried B1 Hören audio files to draft exam questions.
 *
 * Prefer running inventory first:
 *   node scripts/inventory-b1-audio.mjs <path-to-audi-folders>
 *   node scripts/attach-b1-audio.mjs <path-to-audi-folders> [--dry-run]
 *
 * Storage path convention:
 *   exams/b1/b1-mtNN/hoeren/teil-N.ext  (bucket: course-materials)
 *
 * Metadata written on attach:
 *   original_filename, mime_type, sha256, associated_at,
 *   audio_verification_status: 'unverified'
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for real upload.
 * Never invents answer keys. Never publishes exams.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import {
  inventoryLocalAudiFolders,
  mapDriveAudiFolderName,
} from "../src/lib/b1-exam-bank.ts";

const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".mp4"]);
const BUCKET = "course-materials";

function parseArgs(argv) {
  const args = { dryRun: false, root: null, confirmAmbiguous: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--confirm-ambiguous") args.confirmAmbiguous = true;
    else if (!a.startsWith("-") && !args.root) args.root = resolve(a);
  }
  return args;
}

function mimeForExt(ext) {
  switch (ext.toLowerCase()) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".ogg":
      return "audio/ogg";
    case ".flac":
      return "audio/flac";
    case ".aac":
      return "audio/aac";
    case ".mp4":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}

function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function listAudioFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => {
        try {
          const full = resolve(dir, name);
          return statSync(full).isFile() && AUDIO_EXT.has(extname(name).toLowerCase());
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  } catch {
    return [];
  }
}

function buildListing(rootPath) {
  const entries = readdirSync(rootPath, { withFileTypes: true });
  const subdirs = entries.filter((e) => e.isDirectory());
  const audiDirs = subdirs.filter((d) => mapDriveAudiFolderName(d.name));

  if (audiDirs.length > 0) {
    return audiDirs.map((d) => ({
      name: d.name,
      files: listAudioFiles(resolve(rootPath, d.name)),
    }));
  }

  const files = listAudioFiles(rootPath);
  if (files.length > 0) {
    return [{ name: basename(rootPath) || ".", files }];
  }

  return subdirs.map((d) => ({
    name: d.name,
    files: listAudioFiles(resolve(rootPath, d.name)),
  }));
}

function preferredStoragePath(examId, teil, ext) {
  const slug = examId.toLowerCase(); // b1-mt01
  const cleanExt = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return `exams/b1/${slug}/hoeren/teil-${teil}${cleanExt}`;
}

async function findHoerenQuestion(supabase, examCode, teil) {
  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, code, status")
    .eq("code", examCode)
    .maybeSingle();
  if (examError) throw examError;
  if (!exam) return { exam: null, question: null, reason: "exam_not_found" };

  const { data: sections, error: secError } = await supabase
    .from("exam_sections")
    .select("id, skill, sort_order")
    .eq("exam_id", exam.id)
    .eq("skill", "hoeren")
    .order("sort_order", { ascending: true });
  if (secError) throw secError;
  const sectionIds = (sections ?? []).map((s) => s.id);
  if (!sectionIds.length) return { exam, question: null, reason: "no_hoeren_section" };

  const { data: questions, error: qError } = await supabase
    .from("exam_questions")
    .select("id, prompt, sort_order, media_path, media_bucket, metadata")
    .in("section_id", sectionIds)
    .order("sort_order", { ascending: true });
  if (qError) throw qError;

  const list = questions ?? [];
  // Prefer bank_question_id / metadata part match, else nth Hören question.
  const byMeta = list.find((q) => {
    const meta = q.metadata && typeof q.metadata === "object" ? q.metadata : {};
    const bankId = typeof meta.bank_question_id === "string" ? meta.bank_question_id : "";
    return new RegExp(`P0?${teil}\\b|TEIL[-_]?${teil}\\b|teil[-_]?${teil}\\b`, "i").test(
      bankId,
    );
  });
  const question = byMeta ?? list[teil - 1] ?? null;
  if (!question) return { exam, question: null, reason: "question_not_found" };
  return { exam, question, reason: null };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.root) {
    console.log("# attach-b1-audio");
    console.log("");
    console.log("Usage:");
    console.log("  node scripts/inventory-b1-audio.mjs <path>");
    console.log("  node scripts/attach-b1-audio.mjs <path> [--dry-run] [--confirm-ambiguous]");
    console.log("");
    console.log("Preferred storage: exams/b1/b1-mtNN/hoeren/teil-N.ext");
    process.exit(0);
  }

  let listing = [];
  try {
    listing = buildListing(args.root);
  } catch (err) {
    console.error(`Cannot read ${args.root}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const rows = inventoryLocalAudiFolders(listing);
  const attachable = rows.filter((r) => {
    if (r.status === "prêt" && r.examId && r.proposedTeil) return true;
    if (args.confirmAmbiguous && r.status === "ambigu" && r.examId && r.proposedTeil) return true;
    return false;
  });
  const skipped = rows.filter((r) => !attachable.includes(r));

  console.log("# B1 audio attach");
  console.log(`Root: ${args.root}`);
  console.log(`Inventory rows: ${rows.length}`);
  console.log(`Attachable: ${attachable.length} · Skipped: ${skipped.length}`);
  console.log(`Mode: ${args.dryRun ? "dry-run" : "upload"}`);
  console.log("");

  if (skipped.length) {
    console.log("## Skipped (ambiguous / blocked)");
    for (const row of skipped.slice(0, 40)) {
      console.log(
        `- ${row.folder}/${row.file} → ${row.examId ?? "?"} teil=${row.proposedTeil ?? "?"} [${row.status}] ${row.notes}`,
      );
    }
    if (skipped.length > 40) console.log(`… +${skipped.length - 40} more`);
    console.log("");
  }

  if (args.dryRun) {
    console.log("## Planned attachments");
    for (const row of attachable) {
      const ext = row.extension || ".mp3";
      const path = preferredStoragePath(row.examId, row.proposedTeil, ext);
      console.log(
        `- ${row.folder}/${row.file} → ${row.examId} Teil ${row.proposedTeil} → ${BUCKET}/${path}`,
      );
    }
    console.log("");
    console.log("Dry-run only — no upload. Re-run without --dry-run when service role is set.");
    process.exit(0);
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — refusing upload.");
    console.error("Run with --dry-run to preview, or set the service role key.");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let ok = 0;
  let failed = 0;

  for (const row of attachable) {
    const localCandidates = [
      resolve(args.root, row.folder, row.file),
      resolve(args.root, row.file),
    ];
    const filePath = localCandidates.find((p) => {
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    });
    if (!filePath) {
      console.error(`SKIP missing file: ${row.folder}/${row.file}`);
      failed += 1;
      continue;
    }

    const ext = row.extension || extname(row.file) || ".mp3";
    const storagePath = preferredStoragePath(row.examId, row.proposedTeil, ext);
    const mime = mimeForExt(ext);
    const digest = sha256File(filePath);

    try {
      const { exam, question, reason } = await findHoerenQuestion(
        supabase,
        row.examId,
        row.proposedTeil,
      );
      if (!exam || !question) {
        console.error(`SKIP ${row.examId} Teil ${row.proposedTeil}: ${reason}`);
        failed += 1;
        continue;
      }
      if (exam.status === "published") {
        console.error(`SKIP ${row.examId}: exam is published — refusing mutate`);
        failed += 1;
        continue;
      }

      const body = readFileSync(filePath);
      const { error: upError } = await supabase.storage.from(BUCKET).upload(storagePath, body, {
        contentType: mime,
        upsert: true,
      });
      if (upError) throw upError;

      const prevMeta =
        question.metadata && typeof question.metadata === "object" && !Array.isArray(question.metadata)
          ? { ...question.metadata }
          : {};
      const metadata = {
        ...prevMeta,
        original_filename: row.file,
        mime_type: mime,
        sha256: digest,
        associated_at: new Date().toISOString(),
        audio_verification_status: "unverified",
      };

      const { error: updError } = await supabase
        .from("exam_questions")
        .update({
          media_bucket: BUCKET,
          media_path: storagePath,
          metadata,
        })
        .eq("id", question.id);
      if (updError) throw updError;

      console.log(`OK ${row.examId} Teil ${row.proposedTeil} → ${storagePath}`);
      ok += 1;
    } catch (err) {
      console.error(
        `FAIL ${row.examId} Teil ${row.proposedTeil}: ${err instanceof Error ? err.message : String(err)}`,
      );
      failed += 1;
    }
  }

  console.log("");
  console.log(`Done. attached=${ok} failed=${failed}`);
  console.log("audio_verification_status remains 'unverified' until staff confirms.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
