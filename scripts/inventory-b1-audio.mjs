/**
 * Inventory local Drive audio folders for B1 Hören (no upload).
 *
 * Usage:
 *   node scripts/inventory-b1-audio.mjs <path-to-folder>
 *
 * Accepts either:
 *   - a directory containing `audi N` subfolders with audio files
 *   - a flat directory of renamed files (inventoried under folder ".")
 *
 * Always exits 0 (inventory only).
 */
import { readdirSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import {
  inventoryLocalAudiFolders,
  mapDriveAudiFolderName,
} from "../src/lib/b1-exam-bank.ts";

const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".mp4"]);

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

  // Flat renamed files (or non-audi subfolders): inventory files at root
  const files = listAudioFiles(rootPath);
  if (files.length > 0) {
    return [{ name: basename(rootPath) || ".", files }];
  }

  // Fall back: inventory every subfolder
  return subdirs.map((d) => ({
    name: d.name,
    files: listAudioFiles(resolve(rootPath, d.name)),
  }));
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.log("# B1 audio inventory");
    console.log("");
    console.log("Usage: node scripts/inventory-b1-audio.mjs <path-to-folder>");
    console.log("");
    console.log("Exit 0 always (inventory only, no upload).");
    process.exit(0);
  }

  const rootPath = resolve(input);
  let listing = [];
  try {
    listing = buildListing(rootPath);
  } catch (err) {
    console.log("# B1 audio inventory");
    console.log("");
    console.log(`Could not read \`${rootPath}\`: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(0);
  }

  const rows = inventoryLocalAudiFolders(listing);

  console.log("# B1 audio inventory — Drive → examen → Teil");
  console.log("");
  console.log(`Root: \`${rootPath}\``);
  console.log(`Folders: ${listing.length} · Rows: ${rows.length}`);
  console.log("");
  console.log("| Folder | Exam | File | Ext | Order | Teil | Confidence | Status | Notes |");
  console.log("| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |");

  for (const row of rows) {
    console.log(
      `| ${row.folder} | ${row.examId ?? "—"} | ${row.file} | ${row.extension || "—"} | ${row.naturalOrder} | ${row.proposedTeil ?? "—"} | ${row.confidence} | ${row.status} | ${row.notes} |`,
    );
  }

  if (rows.length === 0) {
    console.log("| — | — | — | — | — | — | — | — | aucun fichier audio trouvé |");
  }

  console.log("");
  console.log("Inventory only — no upload performed.");
  process.exit(0);
}

main();
