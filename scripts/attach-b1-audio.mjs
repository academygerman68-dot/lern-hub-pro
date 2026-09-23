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

const AUDIO_EXT = new Set([".mp3", ".mpeg", ".mpg", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".mp4"]);
const BUCKET = "course-materials";

function parseArgs(argv) {
  const args = { dryRun: false, root: null, confirmAmbiguous: false, fromInventory: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--confirm-ambiguous") args.confirmAmbiguous = true;
    else if (a === "--from-inventory") args.fromInventory = resolve(argv[++i] ?? "");
    else if (!a.startsWith("-") && !args.root) args.root = resolve(a);
  }
  return args;
}

function mimeForExt(ext) {
  switch (ext.toLowerCase()) {
    case ".mp3":
    case ".mpeg":
    case ".mpg":
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

async function findHoerenQuestionsForTeil(supabase, examCode, teil) {
  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, code, status")
    .eq("code", examCode)
    .maybeSingle();
  if (examError) throw examError;
  if (!exam) return { exam: null, questions: [], reason: "exam_not_found" };

  const { data: sections, error: secError } = await supabase
    .from("exam_sections")
    .select("id, skill, sort_order")
    .eq("exam_id", exam.id)
    .eq("skill", "hoeren")
    .order("sort_order", { ascending: true });
  if (secError) throw secError;
  const sectionIds = (sections ?? []).map((s) => s.id);
  if (!sectionIds.length) return { exam, questions: [], reason: "no_hoeren_section" };

  const { data: questions, error: qError } = await supabase
    .from("exam_questions")
    .select("id, prompt, sort_order, media_path, media_bucket, metadata")
    .in("section_id", sectionIds)
    .order("sort_order", { ascending: true });
  if (qError) throw qError;

  const list = questions ?? [];
  const bySlot = list.filter((q) => {
    const meta = q.metadata && typeof q.metadata === "object" ? q.metadata : {};
    return Number(meta.audio_slot) === Number(teil) || Number(meta.teil) === Number(teil);
  });
  if (bySlot.length) return { exam, questions: bySlot, reason: null };

  // Legacy page-bundle fallback: one page per Teil
  const byPage = list.filter((q) => {
    const meta = q.metadata && typeof q.metadata === "object" ? q.metadata : {};
    const bankId = typeof meta.bank_question_id === "string" ? meta.bank_question_id : "";
    return new RegExp(`P0?${teil}\\b|TEIL[-_]?${teil}\\b|teil[-_]?${teil}\\b`, "i").test(bankId);
  });
  if (byPage.length) return { exam, questions: byPage, reason: null };
  if (list[teil - 1]) return { exam, questions: [list[teil - 1]], reason: null };
  return { exam, questions: [], reason: "question_not_found" };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.root && !args.fromInventory) {
    console.log("# attach-b1-audio");
    console.log("");
    console.log("Usage:");
    console.log("  node scripts/inventory-b1-audio.mjs <path>");
    console.log("  node scripts/attach-b1-audio.mjs <path> [--from-inventory tmp/b1-audio-inventory.json] [--dry-run]");
    console.log("");
    console.log("Preferred storage: exams/b1/b1-mtNN/hoeren/teil-N.ext");
    process.exit(0);
  }

  let attachable = [];
  let skipped = [];
  let root = args.root;

  if (args.fromInventory) {
    const inv = JSON.parse(readFileSync(args.fromInventory, "utf8"));
    root = root || inv.root;
    const rows = inv.rows || [];
    attachable = rows
      .filter((r) => r.statut === "prêt" && r.examen && r.teil_propose && r.fichier && r.fichier !== "— MANQUANT —")
      .map((r) => ({
        folder: r.dossier,
        examId: r.examen,
        file: r.fichier,
        extension: r.extension,
        proposedTeil: r.teil_propose,
        chemin: r.chemin,
        mime: r.mime,
        sha256: r.sha256,
        duree_s: r.duree_s,
      }));
    skipped = rows.filter((r) => r.statut !== "prêt");
  } else {
    let listing = [];
    try {
      listing = buildListing(args.root);
    } catch (err) {
      console.error(`Cannot read ${args.root}: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    const rows = inventoryLocalAudiFolders(listing);
    attachable = rows
      .filter((r) => {
        if (r.status === "prêt" && r.examId && r.proposedTeil) return true;
        if (args.confirmAmbiguous && r.status === "ambigu" && r.examId && r.proposedTeil) return true;
        return false;
      })
      .map((r) => ({
        folder: r.folder,
        examId: r.examId,
        file: r.file,
        extension: r.extension,
        proposedTeil: r.proposedTeil,
        chemin: resolve(args.root, r.folder, r.file),
      }));
    skipped = rows.filter((r) => !attachable.some((a) => a.file === r.file && a.folder === r.folder));
  }

  console.log("# B1 audio attach");
  console.log(`Root: ${root}`);
  console.log(`Attachable: ${attachable.length} · Skipped: ${skipped.length}`);
  console.log(`Mode: ${args.dryRun ? "dry-run" : "upload"}`);
  console.log("");

  if (args.dryRun) {
    for (const row of attachable) {
      const ext = row.extension || extname(row.file) || ".mpeg";
      console.log(
        `- ${row.folder}/${row.file} → ${row.examId} Teil ${row.proposedTeil} → ${BUCKET}/${preferredStoragePath(row.examId, row.proposedTeil, ext)}`,
      );
    }
    console.log("\nDry-run only — no upload.");
    process.exit(0);
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — refusing upload.");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let ok = 0;
  let failed = 0;
  let questionsUpdated = 0;

  for (const row of attachable) {
    const filePath = row.chemin || resolve(root, row.folder, row.file);
    try {
      if (!statSync(filePath).isFile()) throw new Error("missing file");
    } catch {
      console.error(`SKIP missing file: ${row.folder}/${row.file}`);
      failed += 1;
      continue;
    }

    const ext = row.extension || extname(row.file) || ".mpeg";
    const storagePath = preferredStoragePath(row.examId, row.proposedTeil, ext);
    const mime = row.mime || mimeForExt(ext);
    const digest = row.sha256 || sha256File(filePath);

    try {
      const { exam, questions, reason } = await findHoerenQuestionsForTeil(
        supabase,
        row.examId,
        row.proposedTeil,
      );
      if (!exam || !questions.length) {
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

      for (const question of questions) {
        const prevMeta =
          question.metadata && typeof question.metadata === "object" && !Array.isArray(question.metadata)
            ? { ...question.metadata }
            : {};
        const metadata = {
          ...prevMeta,
          original_filename: row.file,
          mime_type: mime,
          sha256: digest,
          duration_seconds: row.duree_s ?? null,
          associated_at: new Date().toISOString(),
          audio_verification_status: "unverified",
          audio_slot: row.proposedTeil,
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
        questionsUpdated += 1;
      }

      console.log(
        `OK ${row.examId} Teil ${row.proposedTeil} → ${storagePath} (${questions.length} questions)`,
      );
      ok += 1;
    } catch (err) {
      console.error(
        `FAIL ${row.examId} Teil ${row.proposedTeil}: ${err instanceof Error ? err.message : String(err)}`,
      );
      failed += 1;
    }
  }

  console.log("");
  console.log(`Done. tracks_attached=${ok} questions_updated=${questionsUpdated} failed=${failed}`);
  console.log("audio_verification_status remains 'unverified' until staff confirms.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
