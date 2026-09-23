/**
 * Build structured B1 exam bank from OCR page-bundle complete JSON.
 *
 * Usage:
 *   node scripts/build-b1-structured-bank.mjs
 *   node scripts/build-b1-structured-bank.mjs --out tmp/b1-exam-bank.structured.json
 *
 * Never invents confirmed answer keys. Does not publish.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadB1ExamBank } from "../src/lib/b1-exam-bank.ts";
import {
  proposeAnswerKeysFromAppendix,
  transformB1ExamBank,
} from "../src/lib/b1-structure-transform.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_IN = resolve(__dirname, "../data/exams/b1-exam-bank/b1-exam-bank.complete.json");
const DEFAULT_OUT = resolve(
  __dirname,
  "../data/exams/b1-exam-bank/b1-exam-bank.structured.json",
);
const KEYS_OUT = resolve(__dirname, "../tmp/b1-answer-keys-proposed.json");
const STATS_OUT = resolve(__dirname, "../tmp/b1-structure-stats.json");

function parseArgs(argv) {
  const args = { in: DEFAULT_IN, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") args.in = resolve(argv[++i] ?? DEFAULT_IN);
    else if (a === "--out") args.out = resolve(argv[++i] ?? DEFAULT_OUT);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const bank = loadB1ExamBank(args.in);
  const { bank: structured, stats } = transformB1ExamBank(bank);
  const keys = proposeAnswerKeysFromAppendix(bank);

  mkdirSync(dirname(args.out), { recursive: true });
  mkdirSync(dirname(KEYS_OUT), { recursive: true });
  writeFileSync(args.out, JSON.stringify(structured), "utf8");
  writeFileSync(KEYS_OUT, JSON.stringify(keys, null, 2), "utf8");
  writeFileSync(STATS_OUT, JSON.stringify(stats, null, 2), "utf8");

  const outBytes = Buffer.byteLength(JSON.stringify(structured));
  console.log("B1 structured bank build");
  console.log(`  in:  ${args.in}`);
  console.log(`  out: ${args.out} (${(outBytes / 1e6).toFixed(1)} MB compact)`);
  console.log(`  exams: ${stats.exams}`);
  console.log(`  Lesen: ${stats.lesen_total}/${stats.lesen_expected}`);
  console.log(`  Hören: ${stats.hoeren_total}/${stats.hoeren_expected}`);
  console.log(`  Schreiben: ${stats.schreiben_total}/${stats.schreiben_expected}`);
  console.log(`  Sprechen: ${stats.sprechen_total}`);
  console.log(`  transform structured: ${stats.structured}`);
  console.log(`  transform placeholder: ${stats.placeholder}`);
  console.log(`  review needs_review: ${stats.needs_review}`);
  console.log(`  review verified: ${stats.verified}`);
  console.log(`  missing_options: ${stats.missing_options}`);
  console.log(`  blockers: ${stats.blockers.length}`);
  if (stats.blockers.length) {
    for (const b of stats.blockers.slice(0, 30)) console.log(`    - ${b}`);
  }
  console.log(
    `  proposed answer-key blocks: ${keys.proposed_blocks.length} (confirmed: ${keys.confirmed_imported})`,
  );
  console.log(`  wrote ${KEYS_OUT}`);
  console.log(`  wrote ${STATS_OUT}`);

  const countsOk =
    stats.lesen_total === stats.lesen_expected &&
    stats.hoeren_total === stats.hoeren_expected &&
    stats.schreiben_total === stats.schreiben_expected;

  if (!countsOk) {
    console.error("Count targets not met — structured bank still written for review.");
    process.exitCode = 1;
  }
}

main();
