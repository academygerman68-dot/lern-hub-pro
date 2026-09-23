/**
 * Full B1 audio inventory: SHA-256, MIME, duration, natural WhatsApp sort.
 *
 * Usage:
 *   node scripts/inventory-b1-audio.mjs "path/to/Audios-B1"
 *
 * Exit 0 always (inventory only). Writes tmp/b1-audio-inventory.json
 */
import { createHash } from "node:crypto";
import { createReadStream, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mapDriveAudiFolderName } from "../src/lib/b1-exam-bank.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".mp4", ".mpeg", ".mpg", ".webm"]);

function sha256File(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function sniffMime(buf, ext) {
  if (buf.length >= 3 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (buf.length >= 3 && buf.toString("ascii", 0, 3) === "ID3") return "audio/mpeg";
  if (buf.length >= 4 && buf.toString("ascii", 0, 4) === "RIFF") return "audio/wav";
  if (buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp") return "audio/mp4";
  const map = {
    ".mp3": "audio/mpeg",
    ".mpeg": "audio/mpeg",
    ".mpg": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".mp4": "audio/mp4",
    ".webm": "audio/webm",
  };
  return map[ext] || "application/octet-stream";
}

/** WhatsApp: "… at 22.02.17.mpeg" before "… at 22.02.17 (1).mpeg"; then by time. */
function whatsappNaturalKey(name) {
  const m = name.match(
    /(\d{4}-\d{2}-\d{2})\s+at\s+(\d{1,2})\.(\d{2})\.(\d{2})(?:\s*\((\d+)\))?/i,
  );
  if (m) {
    const dup = m[5] ? Number(m[5]) : 0;
    return [
      m[1],
      String(m[2]).padStart(2, "0"),
      m[3],
      m[4],
      String(dup).padStart(4, "0"),
      name.toLowerCase(),
    ].join("|");
  }
  return name.toLowerCase();
}

function naturalCompareFiles(a, b) {
  const ka = whatsappNaturalKey(a);
  const kb = whatsappNaturalKey(b);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function readDurationSeconds(path, mime) {
  try {
    const { parseFile } = await import("music-metadata");
    const meta = await parseFile(path, { duration: true });
    const d = meta.format.duration;
    return typeof d === "number" && Number.isFinite(d) ? Math.round(d * 10) / 10 : null;
  } catch {
    return null;
  }
}

function listAudioFiles(dir) {
  return readdirSync(dir)
    .filter((name) => {
      try {
        const full = resolve(dir, name);
        return statSync(full).isFile() && AUDIO_EXT.has(extname(name).toLowerCase());
      } catch {
        return false;
      }
    })
    .sort(naturalCompareFiles);
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.log("Usage: node scripts/inventory-b1-audio.mjs <path-to-Audios-B1>");
    process.exit(0);
  }

  const rootPath = resolve(input);
  const dirs = readdirSync(rootPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => mapDriveAudiFolderName(name))
    .sort((a, b) => {
      const na = Number(String(mapDriveAudiFolderName(a)).replace(/\D/g, ""));
      const nb = Number(String(mapDriveAudiFolderName(b)).replace(/\D/g, ""));
      return na - nb;
    });

  const rows = [];
  const shaSeen = new Map();

  for (const folder of dirs) {
    const examId = mapDriveAudiFolderName(folder);
    const dirPath = resolve(rootPath, folder);
    const files = listAudioFiles(dirPath);
    const extras = files.length > 4 ? files.length - 4 : 0;
    const missing = files.length < 4 ? 4 - files.length : 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const full = resolve(dirPath, file);
      const ext = extname(file).toLowerCase();
      const buf = readFileSync(full);
      const head = buf.subarray(0, 16);
      const mime = sniffMime(head, ext);
      const sha256 = await sha256File(full);
      const duration = await readDurationSeconds(full, mime);
      const naturalOrder = i + 1;

      let proposedTeil = null;
      let method = "non assigné";
      let confidence = "à confirmer";
      let status = "ambigu";
      let notes = "";

      const teilInName = /(?:teil|part|t)[-\s_]?([1-4])\b/i.exec(file);
      if (teilInName) {
        proposedTeil = Number(teilInName[1]);
        method = "nom de fichier (Teil/Part)";
        confidence = "certaine";
        status = "prêt";
        notes = "Teil explicite dans le nom";
      } else if (files.length === 4 && naturalOrder >= 1 && naturalOrder <= 4) {
        proposedTeil = naturalOrder;
        method = "ordre naturel (exactement 4 fichiers)";
        confidence = "certaine";
        status = "prêt";
        notes =
          "WhatsApp sans libellé Teil — affectation par tri chronologique naturel (règle 4 fichiers)";
      } else {
        notes =
          files.length === 4
            ? "Impossible d'ordonner clairement"
            : `Dossier contient ${files.length} fichiers (attendu: 4)`;
        status = "ambigu";
        confidence = "à confirmer";
        method = "aucune";
      }

      if (shaSeen.has(sha256)) {
        notes += `; DOUBLON SHA-256 avec ${shaSeen.get(sha256)}`;
        status = "ambigu";
        confidence = "à confirmer";
        proposedTeil = null;
        method = "doublon — non associé";
      } else {
        shaSeen.set(sha256, `${folder}/${file}`);
      }

      if (extras > 0 && naturalOrder > 4) {
        status = "ambigu";
        confidence = "à confirmer";
        proposedTeil = null;
        method = "fichier supplémentaire";
        notes = "Fichier au-delà des 4 pistes attendues — non associé";
      }

      if (missing > 0) {
        notes += `; dossier incomplet (${files.length}/4)`;
        if (status === "prêt") {
          status = "ambigu";
          confidence = "à confirmer";
        }
      }

      rows.push({
        dossier: folder,
        examen: examId,
        fichier: file,
        chemin: full,
        extension: ext,
        mime,
        duree_s: duration,
        taille_octets: buf.length,
        sha256,
        ordre_naturel: naturalOrder,
        teil_propose: proposedTeil,
        methode: method,
        confiance: confidence,
        statut: status,
        notes,
      });
    }

    for (let t = files.length + 1; t <= 4; t++) {
      rows.push({
        dossier: folder,
        examen: examId,
        fichier: "— MANQUANT —",
        chemin: null,
        extension: null,
        mime: null,
        duree_s: null,
        taille_octets: null,
        sha256: null,
        ordre_naturel: t,
        teil_propose: t,
        methode: "slot vide",
        confiance: "à confirmer",
        statut: "bloqué",
        notes: `Teil ${t} manquant dans ${folder}`,
      });
    }
  }

  const outDir = resolve(__dirname, "../tmp");
  mkdirSync(outDir, { recursive: true });
  const outJson = resolve(outDir, "b1-audio-inventory.json");
  writeFileSync(
    outJson,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        root: rootPath,
        folders: dirs.length,
        rows,
        summary: {
          total_rows: rows.length,
          pret: rows.filter((r) => r.statut === "prêt").length,
          ambigu: rows.filter((r) => r.statut === "ambigu").length,
          bloque: rows.filter((r) => r.statut === "bloqué").length,
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("# Inventaire audio B1 — 60 pistes attendues\n");
  console.log(`Root: \`${rootPath}\``);
  console.log(`Dossiers mappés: ${dirs.length}`);
  console.log("");
  console.log(
    "| Dossier | Examen | Fichier réel | Durée | Teil proposé | Méthode de détection | Confiance | Statut |",
  );
  console.log("|---|---|---|---:|---|---|---|---|");
  for (const r of rows) {
    const dur = r.duree_s == null ? "—" : `${r.duree_s}s`;
    const teil = r.teil_propose == null ? "—" : `Teil ${r.teil_propose}`;
    const file = (r.fichier || "—").replace(/\|/g, "/");
    console.log(
      `| ${r.dossier} | ${r.examen ?? "—"} | ${file} | ${dur} | ${teil} | ${r.methode} | ${r.confiance} | ${r.statut} |`,
    );
  }
  console.log("");
  console.log(
    `Résumé: prêt=${rows.filter((r) => r.statut === "prêt").length} · ambigu=${rows.filter((r) => r.statut === "ambigu").length} · bloqué=${rows.filter((r) => r.statut === "bloqué").length}`,
  );
  console.log(`JSON: ${outJson}`);
  console.log("Aucun fichier renommé, supprimé ou téléversé.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(0);
});
