/**
 * Parse OCR Lösung pages into a proposed, never-confirmed report.
 * Does NOT insert into exam_answer_keys.
 *
 * Usage: node scripts/parse-b1-answer-keys-ocr.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bankPath = resolve(__dirname, "../data/exams/b1-exam-bank/b1-exam-bank.complete.json");
const outPath = resolve(__dirname, "../tmp/b1-answer-keys-proposed.json");

const bank = JSON.parse(readFileSync(bankPath, "utf8"));
const ak = bank.appendices?.official_answer_keys;
if (!ak) {
  console.error("No official_answer_keys appendix");
  process.exit(1);
}

const ocr = (ak.pages || []).map((p) => p.ocr_text || "").join("\n");
const indices = [];
const re = /Modelltest\s*(\d+)/gi;
let match;
while ((match = re.exec(ocr)) !== null) {
  indices.push({ n: Number(match[1]), i: match.index });
}

const proposed_blocks = [];
for (let i = 0; i < indices.length; i++) {
  const cur = indices[i];
  const end = i + 1 < indices.length ? indices[i + 1].i : ocr.length;
  const chunk = ocr.slice(cur.i, end);
  const lesen = (chunk.match(/Lesen\s*:[^\n]*/i) || [])[0] || null;
  const horen =
    (chunk.match(/Horen\s*:[^\n]*/i) || chunk.match(/Hör\w*\s*:[^\n]*/i) || [])[0] || null;
  proposed_blocks.push({
    modelltest: cur.n,
    exam_id: `B1-MT${String(cur.n).padStart(2, "0")}`,
    lesen_ocr_line: lesen,
    hoeren_ocr_line: horen,
    status: "needs_review",
    confirmed_keys: 0,
    note: "OCR solutions pages 247–249 — ambiguous digits/letters; not imported into exam_answer_keys",
  });
}

const report = {
  generated_at: new Date().toISOString(),
  source_pdf_pages: ak.source_pdf_pages,
  structured_answer_keys: ak.structured_answer_keys ?? null,
  manual_visual_verification_required: true,
  confirmed_imported: 0,
  proposed_blocks,
  warning:
    "Aucune clé confirmée. Ne pas utiliser comme corrigé officiel sans relecture PDF page par page.",
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log(
  `Wrote ${outPath}: ${proposed_blocks.length} Modelltests proposed, 0 confirmed, 0 imported.`,
);
