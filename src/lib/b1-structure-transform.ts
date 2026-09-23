/**
 * Parse B1 OCR page bundles into structured interactive questions.
 *
 * Rules:
 * - Never invent correct answers or missing options
 * - Preserve original OCR in metadata.source
 * - review_status stays needs_review unless visually verified
 * - Prefer creating needs_review questions over dropping structure
 */

import {
  detectSprechenRole,
  splitSchreibenPageBundle,
} from "./b1-ocr-transform.ts";
import type { B1DraftExam, B1DraftQuestion, B1DraftSection, B1ExamBank } from "./b1-exam-bank.ts";

export type B1ReviewStatus = "needs_review" | "verified";

export type B1StructuredQuestionType =
  | "true_false"
  | "single_choice"
  | "matching"
  | "listening"
  | "writing"
  | "speaking";

export type B1StructuredOption = {
  id: string;
  label: string;
  text: string;
};

export type B1StructuredQuestion = {
  id: string;
  order: number;
  type: B1StructuredQuestionType;
  prompt: string;
  options: B1StructuredOption[] | null;
  points: number;
  answer_key: null;
  automatic_grading: boolean;
  teil?: number;
  /** Reading/listening stimulus text when applicable (e.g. Lesen Teil1 passage). */
  passage?: string | null;
  audio_slot?: 1 | 2 | 3 | 4 | null;
  role?: "A" | "B" | null;
  review_status: B1ReviewStatus;
  transform_status: "structured" | "needs_review" | "placeholder";
  points_rubric: "provisional_needs_review" | "official_unknown";
  metadata: {
    source: unknown;
    parent_page_ids: string[];
    import_mode: "structured";
    needs_review: true;
    transcription_status: "ocr_unverified";
    ocr_raw_prompt?: string;
    expected_number?: number;
    notes?: string[];
    passage?: string | null;
    [key: string]: unknown;
  };
};

export type B1StructuredSection = {
  id: string;
  type: "lesen" | "hoeren" | "schreiben" | "sprechen";
  title: string;
  max_points: number | null;
  questions: B1StructuredQuestion[];
};

export type B1StructuredExam = Omit<B1DraftExam, "sections"> & {
  sections: B1StructuredSection[];
  structure_stats?: B1ExamStructureStats;
};

export type B1ExamStructureStats = {
  lesen: number;
  hoeren: number;
  schreiben: number;
  sprechen: number;
  needs_review: number;
  verified: number;
  structured: number;
  placeholder: number;
  missing_options: number;
  blockers: string[];
};

export type B1StructureBankStats = {
  exams: number;
  lesen_total: number;
  lesen_expected: number;
  hoeren_total: number;
  hoeren_expected: number;
  schreiben_total: number;
  schreiben_expected: number;
  sprechen_total: number;
  needs_review: number;
  verified: number;
  structured: number;
  placeholder: number;
  missing_options: number;
  blockers: string[];
  per_exam: Array<{ exam_id: string } & B1ExamStructureStats>;
};

export type B1ProposedAnswerKeyBlock = {
  modelltest: number;
  exam_id: string;
  lesen_ocr_line: string | null;
  hoeren_ocr_line: string | null;
  status: "needs_review";
  confirmed_keys: 0;
  ocr_raw: string;
  note: string;
};

const LESEN_TEIL_RANGES: Array<{ teil: number; from: number; to: number; type: B1StructuredQuestionType }> = [
  { teil: 1, from: 1, to: 6, type: "true_false" },
  { teil: 2, from: 7, to: 12, type: "single_choice" },
  { teil: 3, from: 13, to: 19, type: "matching" },
  { teil: 4, from: 20, to: 26, type: "true_false" },
  { teil: 5, from: 27, to: 30, type: "single_choice" },
];

const HOEREN_TEIL_RANGES: Array<{
  teil: 1 | 2 | 3 | 4;
  from: number;
  to: number;
  subtype: "true_false" | "single_choice" | "matching" | "mixed";
}> = [
  { teil: 1, from: 1, to: 10, subtype: "mixed" },
  { teil: 2, from: 11, to: 15, subtype: "single_choice" },
  { teil: 3, from: 16, to: 22, subtype: "true_false" },
  { teil: 4, from: 23, to: 30, subtype: "matching" },
];

const RF_OPTIONS: B1StructuredOption[] = [
  { id: "richtig", label: "a", text: "Richtig" },
  { id: "falsch", label: "b", text: "Falsch" },
];

const JA_NEIN_OPTIONS: B1StructuredOption[] = [
  { id: "ja", label: "a", text: "Ja" },
  { id: "nein", label: "b", text: "Nein" },
];

const ABC_LABELS = ["a", "b", "c"] as const;

function cleanNoise(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/Zertifikat\s*B1\s*neu/gi, "")
    .replace(/\nSeite\s*\d+/gi, "")
    .replace(/\n\d{1,3}\s*$/gm, "")
    .trim();
}

function stripStandaloneRf(text: string): string {
  return text
    .replace(/(?:^|\n)\s*Richtig\s*(?=\n|$)/gi, "\n")
    .replace(/(?:^|\n)\s*Falsch\s*(?=\n|$)/gi, "\n")
    .replace(/(?:^|\n)\s*Ja\s*(?=\n|$)/gi, "\n")
    .replace(/(?:^|\n)\s*Nein\s*(?=\n|$)/gi, "\n")
    .replace(/(?:^|\n)\s*Nen\s*(?=\n|$)/gi, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function joinPages(questions: B1DraftQuestion[]): { text: string; pageIds: string[]; sources: unknown[] } {
  const pageIds: string[] = [];
  const sources: unknown[] = [];
  const parts: string[] = [];
  for (const q of questions) {
    pageIds.push(q.id);
    sources.push(q.source);
    parts.push(q.prompt ?? "");
  }
  return { text: parts.join("\n\n"), pageIds, sources };
}

function detectTeilFromText(text: string): number | null {
  // OCR often glues: "Teil2EinThema" — no word boundary after the digit
  const m = text.match(/\bTeil\s*([1-5])(?!\d)/i);
  return m ? Number(m[1]) : null;
}

function pagesForTeil(section: B1DraftSection, teil: number): B1DraftQuestion[] {
  return section.questions.filter((q) => {
    const t = detectTeilFromText(q.prompt ?? "");
    return t === teil;
  });
}

function makeQuestion(input: {
  examId: string;
  section: "LESEN" | "HOEREN" | "SCHREIBEN" | "SPRECHEN";
  order: number;
  type: B1StructuredQuestionType;
  prompt: string;
  options: B1StructuredOption[] | null;
  teil?: number;
  passage?: string | null;
  audio_slot?: 1 | 2 | 3 | 4 | null;
  role?: "A" | "B" | null;
  pageIds: string[];
  sources: unknown[];
  transform_status: B1StructuredQuestion["transform_status"];
  points: number;
  notes?: string[];
  ocr_raw_prompt?: string;
}): B1StructuredQuestion {
  const missingOpts =
    (input.type === "single_choice" || input.type === "matching" || input.type === "true_false") &&
    (!input.options || input.options.length === 0);

  const notes = [...(input.notes ?? [])];
  if (missingOpts) notes.push("options_incomplete_from_ocr");
  if (input.transform_status === "placeholder") notes.push("placeholder_expected_slot");

  const passage = input.passage?.trim() ? input.passage.trim() : null;

  const question: B1StructuredQuestion = {
    id: `${input.examId}-${input.section}-Q${String(input.order).padStart(2, "0")}`,
    order: input.order,
    type: input.type,
    prompt: input.prompt.trim() || `[OCR incomplete — question ${input.order}]`,
    options: input.options,
    points: input.points,
    answer_key: null,
    automatic_grading: input.type === "writing" || input.type === "speaking" ? false : true,
    review_status: "needs_review",
    transform_status: input.transform_status,
    points_rubric: "provisional_needs_review",
    metadata: {
      source: {
        pages: input.sources,
        parent_page_ids: input.pageIds,
      },
      parent_page_ids: input.pageIds,
      import_mode: "structured",
      needs_review: true,
      transcription_status: "ocr_unverified",
      expected_number: input.order,
      notes,
      provisional_points: input.points,
      points_basis: "provisional_needs_review",
    },
  };
  if (input.teil != null) question.teil = input.teil;
  if (passage != null) question.passage = passage;
  if (input.audio_slot != null) question.audio_slot = input.audio_slot;
  if (input.role != null) question.role = input.role;
  if (input.ocr_raw_prompt != null) question.metadata.ocr_raw_prompt = input.ocr_raw_prompt;
  if (passage != null) question.metadata.passage = passage;
  return question;
}

/** True when page has multiple Richtig/Falsch *pairs* (statement sheet), not just instruction words. */
export function isRfStatementPage(prompt: string): boolean {
  const pairs = prompt.match(/\n\s*Richtig\s*\n\s*Falsch\s*/gi);
  return (pairs?.length ?? 0) >= 3;
}

/** Strip LESEN headers/instructions; keep passage body. */
export function extractLesenPassageBody(prompt: string): string {
  const cleaned = cleanNoise(prompt);
  const lines = cleaned.split(/\n/);
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!.trim();
    if (!l) continue;
    if (
      /^(LESEN|Teil\s*\d+|Arbeitszeit|000+)/i.test(l) ||
      /^Lesen\s*Sie/i.test(l) ||
      /^W[aä]hlen\s*Sie/i.test(l) ||
      /richtig\s+oder\s+falsch/i.test(l) ||
      /Losung\s*a/i.test(l) ||
      /Aufgaben?\s*\d+/i.test(l)
    ) {
      start = i + 1;
      continue;
    }
    if (l.length >= 8) {
      start = i;
      break;
    }
  }
  return lines.slice(start).join("\n").trim();
}

/** Press/stimulus text before Beispiel or first numbered task on Teil2/Teil5 pages. */
function extractPressPassage(prompt: string): string {
  const cleaned = cleanNoise(prompt);
  const beispielIdx = cleaned.search(/\n\s*Beispiel\b/i);
  const taskIdx = cleaned.search(/(?:^|\n)\s*(?:[\[@])?\s*(?:7|8|9|10|11|12|27|28|29|30)\s*[A-Za-zÄÖÜäöüß.]/);
  let end = cleaned.length;
  if (beispielIdx >= 0) end = Math.min(end, beispielIdx);
  if (taskIdx >= 0) end = Math.min(end, taskIdx);
  const head = cleaned.slice(0, end);
  return extractLesenPassageBody(head);
}

function sortPages(section: B1DraftSection): B1DraftQuestion[] {
  return [...section.questions].sort((a, b) => {
    const na = Number((a.id.match(/P(\d+)/i) || [])[1] || a.order || 0);
    const nb = Number((b.id.match(/P(\d+)/i) || [])[1] || b.order || 0);
    return na - nb;
  });
}

/**
 * Gold layout: 8 Lesen pages → P01 passage, P02 RF, P03–04 Teil2, P05–06 Teil3, P07 Teil4, P08 Teil5.
 */
function lesenPageLayout(section: B1DraftSection): {
  teil1Passage: B1DraftQuestion | null;
  teil1Statements: B1DraftQuestion | null;
  teil2: B1DraftQuestion[];
  teil3: B1DraftQuestion[];
  teil4: B1DraftQuestion | null;
  teil5: B1DraftQuestion | null;
} {
  const pages = sortPages(section);
  if (pages.length >= 8) {
    return {
      teil1Passage: pages[0] ?? null,
      teil1Statements: pages[1] ?? null,
      teil2: pages.slice(2, 4),
      teil3: pages.slice(4, 6),
      teil4: pages[6] ?? null,
      teil5: pages[7] ?? null,
    };
  }

  const byTeil = (t: number) => pagesForTeil(section, t);
  const t1 = byTeil(1);
  const statement =
    t1.find((p) => isRfStatementPage(p.prompt)) ??
    t1.find((p) => /Beispiel/i.test(p.prompt) && /Richtig/i.test(p.prompt)) ??
    null;
  const passage =
    t1.find((p) => p !== statement && !isRfStatementPage(p.prompt)) ?? t1[0] ?? null;

  return {
    teil1Passage: passage,
    teil1Statements: statement,
    teil2: byTeil(2).length ? byTeil(2) : pages.filter((p) => /Teil\s*2(?!\d)/i.test(p.prompt)),
    teil3: byTeil(3).length ? byTeil(3) : pages.filter((p) => /Teil\s*3(?!\d)/i.test(p.prompt)),
    teil4: byTeil(4)[0] ?? pages.find((p) => /Teil\s*4(?!\d)/i.test(p.prompt)) ?? null,
    teil5: byTeil(5)[0] ?? pages.find((p) => /Teil\s*5(?!\d)/i.test(p.prompt)) ?? null,
  };
}

/**
 * Split Richtig/Falsch statement pages into statements.
 * Merges lowercase continuations after RF side-column OCR interruptions.
 * Skips Beispiel. Prefer RF-pair split over line merge.
 */
export function extractTrueFalseStatements(
  prompt: string,
  expectedCount: number,
): { statements: string[]; transform_status: "structured" | "needs_review" } {
  const cleaned = stripStandaloneRf(cleanNoise(prompt));

  // Prefer RF-split: statement then Richtig\nFalsch
  const rfChunks = prompt
    .split(/\n\s*Richtig\s*\n\s*Falsch\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const rfStatements: string[] = [];
  for (let i = 0; i < rfChunks.length; i++) {
    let chunk = rfChunks[i]!;
    // Drop everything through Beispiel marker (keep text after Beispiel on same chunk)
    const beispielIdx = chunk.search(/\bBeispiel\b/i);
    if (beispielIdx >= 0) {
      chunk = chunk.slice(beispielIdx).replace(/^\s*Beispiel\s*/i, "").trim();
    }
    chunk = chunk
      .replace(/^(?:\d+\s*)?(?:Teil\s*\d+\s*)?(?:LESEN|HOREN|HÖREN)\s*/i, "")
      .replace(/Zertifikat\s*B1\s*neu/gi, "")
      .replace(/^(?:0?\d)\s+/, "") // leading Beispiel numbers like "01 "
      .trim();

    // Merge only leading continuation lines from next RF chunk (OCR mid-sentence split)
    while (i + 1 < rfChunks.length) {
      const nextRaw = rfChunks[i + 1]!.replace(/Zertifikat\s*B1\s*neu/gi, "").trim();
      const nextLines = nextRaw
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (nextLines.length === 0) {
        i += 1;
        continue;
      }
      const first = nextLines[0]!;
      if (!/^[a-zäöüß]/.test(first) && !/^(und|oder)\b/i.test(first)) break;
      i += 1;
      const cont: string[] = [];
      let j = 0;
      while (
        j < nextLines.length &&
        (/^[a-zäöüß]/.test(nextLines[j]!) || /^(und|oder)\b/i.test(nextLines[j]!))
      ) {
        cont.push(nextLines[j++]!);
      }
      chunk = `${chunk} ${cont.join(" ")}`.trim();
      if (j < nextLines.length) {
        rfChunks[i] = nextLines.slice(j).join("\n");
        i -= 1;
        break;
      }
    }

    if (!chunk || chunk.length < 8) continue;
    if (/^Zertifikat/i.test(chunk)) continue;
    // Skip Beispiel residue that is only the example statement when we still have enough
    rfStatements.push(chunk.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim());
  }

  // Drop leading Beispiel statement when we have expectedCount+1
  let statements = rfStatements;
  if (statements.length > expectedCount) {
    // First chunk after Beispiel split is usually the example
    statements = statements.slice(statements.length - expectedCount);
  }

  // Fallback: line merge without RF pairs
  if (statements.length < expectedCount) {
    let body = cleaned
      .replace(/^[\s\S]*?\bBeispiel\b\s*/i, "")
      .replace(/^(?:\d+\s*)?(?:Teil\s*\d+\s*)?(?:LESEN|HOREN|HÖREN)\s*/i, "")
      .trim();
    const lines = body
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^(LESEN|HOREN|HÖREN|Teil\s*\d+|Arbeitszeit.*|Beispiel)$/i.test(l));

    const merged: string[] = [];
    for (const line of lines) {
      if (
        merged.length > 0 &&
        (/^[a-zäöüß]/.test(line) || /^(und|oder|in|im|am|auf|mit|zu|von|für|fur)\b/i.test(line)) &&
        merged[merged.length - 1]!.length < 120
      ) {
        merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`.trim();
      } else {
        merged.push(line);
      }
    }
    if (merged.length >= expectedCount) {
      statements = merged.slice(0, expectedCount);
    } else if (statements.length < merged.length) {
      statements = merged;
    }
  }

  const status =
    statements.length === expectedCount && statements.every((s) => s.length > 5)
      ? ("structured" as const)
      : ("needs_review" as const);

  while (statements.length < expectedCount) {
    statements.push("");
  }

  return { statements: statements.slice(0, expectedCount), transform_status: status };
}

/**
 * Extract numbered single-choice items (stem + up to 3 option lines).
 * Fills OCR-missing numbers from sequence between neighbors (e.g. lost "7" before "8").
 * Does not invent option text.
 */
export function extractSingleChoiceItems(
  prompt: string,
  from: number,
  to: number,
): Map<number, { prompt: string; options: B1StructuredOption[]; status: "structured" | "needs_review" }> {
  const text = cleanNoise(prompt);
  const result = new Map<
    number,
    { prompt: string; options: B1StructuredOption[]; status: "structured" | "needs_review" }
  >();

  // Drop Beispiel block (example stem + 3 options) so it is not assigned as a real item
  let work = text;
  const beispiel = work.search(/\n\s*Beispiel\b/i);
  if (beispiel >= 0) {
    const after = work.slice(beispiel + 1);
    // End Beispiel at next in-range number marker or "In diesem" / clear task start
    const endBeispiel = after.search(
      /\n\s*(?:[\[@])?\s*([7-9]|1[0-2]|2[7-9]|30)\s*[A-Za-zÄÖÜäöüß.]|\nIn\s*diesem/i,
    );
    if (endBeispiel > 0) {
      work = work.slice(0, beispiel) + after.slice(endBeispiel);
    } else {
      work = work.slice(0, beispiel) + "\n" + after.replace(/^\s*Beispiel\b[^\n]*/i, "");
    }
  }

  const markerRe =
    /(?:^|\n)\s*(?:[\[@]|\b)?\s*([0-9]{1,2})(?=[A-Za-zÄÖÜäöüß.…]|\s)/g;
  const markers: Array<{ n: number; index: number; raw: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(work)) !== null) {
    const n = Number(m[1]);
    if (n >= from && n <= to && !markers.some((x) => x.n === n)) {
      markers.push({ n, index: m.index + (m[0].startsWith("\n") ? 1 : 0), raw: m[0] });
    }
  }
  markers.sort((a, b) => a.index - b.index);

  const parseChunk = (
    chunkRaw: string,
  ): { prompt: string; options: B1StructuredOption[]; status: "structured" | "needs_review" } => {
    let chunk = chunkRaw.replace(/^(?:[\[@])?\s*\d{1,2}\s*/, "").trim();
    const lines = chunk
      .split(/\n/)
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !/^(LESEN|HOREN|HÖREN|Teil\s*\d+|WahlenSie.*|LesenSie.*|auseiner)/i.test(l) &&
          !/^Zertifikat/i.test(l),
      );

    if (lines.length === 0) {
      return { prompt: "", options: [], status: "needs_review" };
    }

    let stem: string;
    let optionLines: string[];
    if (lines.length >= 4) {
      optionLines = lines.slice(-3);
      stem = lines.slice(0, lines.length - 3).join(" ").trim();
    } else if (lines.length === 3) {
      // 3 lines: likely stem missing or 3 options only — treat first as stem if long
      if (lines[0]!.length > 40) {
        stem = lines[0]!;
        optionLines = lines.slice(1);
      } else {
        stem = "";
        optionLines = lines;
      }
    } else {
      stem = lines.join(" ");
      optionLines = [];
    }

    const options: B1StructuredOption[] = optionLines.slice(0, 3).map((t, idx) => ({
      id: ABC_LABELS[idx] ?? String(idx),
      label: ABC_LABELS[idx] ?? String(idx),
      text: t.replace(/^[@•·\-]\s*/, "").trim(),
    }));

    return {
      prompt: stem,
      options,
      status: options.length === 3 && stem.length > 0 ? "structured" : "needs_review",
    };
  };

  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i]!;
    const end = i + 1 < markers.length ? markers[i + 1]!.index : work.length;
    result.set(cur.n, parseChunk(work.slice(cur.index, end).trim()));
  }

  // Fill gaps: content between consecutive known numbers assigned to missing ids in order
  const expected = [];
  for (let n = from; n <= to; n++) expected.push(n);
  const missing = expected.filter((n) => !result.has(n));
  if (missing.length > 0) {
    // Q7-style: "In diesemText..." after Beispiel, before first numbered marker
    const inDiesem = work.match(
      /((?:^|\n)In\s*diesem[\s\S]*?)(?=\n\s*(?:[\[@])?\s*(?:[89]|1[0-2]|2[7-9]|30)\s*[A-Za-zÄÖÜ]|$)/i,
    );
    if (inDiesem && missing.includes(from) && !result.has(from)) {
      result.set(from, parseChunk(inDiesem[1]!.trim()));
      missing.splice(missing.indexOf(from), 1);
    }

    // "DieWebStamp..." style missing middle number between neighbors
    for (const miss of [...missing]) {
      if (result.has(miss)) continue;
      const prevN = miss - 1;
      const nextN = miss + 1;
      if (!result.has(prevN) || !markers.some((x) => x.n === nextN)) continue;
      const prevMarker = markers.find((x) => x.n === prevN);
      const nextMarker = markers.find((x) => x.n === nextN);
      if (!prevMarker || !nextMarker) continue;
      const between = work.slice(prevMarker.index, nextMarker.index);
      const lines = between
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length >= 8) {
        const withoutNum = lines[0]!.replace(/^(?:[\[@])?\s*\d{1,2}\s*/, "");
        const rest = [withoutNum, ...lines.slice(1)];
        let splitAt = 4;
        for (let li = 3; li < rest.length - 2; li++) {
          if (/^[A-ZÄÖÜ]/.test(rest[li]!) && rest[li]!.length > 12) {
            splitAt = li;
            break;
          }
        }
        const second = rest.slice(splitAt).join("\n");
        if (second.length > 15) {
          result.set(miss, parseChunk(second));
          result.set(prevN, parseChunk(rest.slice(0, splitAt).join("\n")));
        }
      }
    }
  }

  return result;
}

/**
 * Extract matching situations (numbered) — options left empty/partial if ads OCR messy.
 */
export function extractMatchingItems(
  prompt: string,
  from: number,
  to: number,
): Map<number, { prompt: string; options: B1StructuredOption[]; status: "structured" | "needs_review" }> {
  const text = cleanNoise(prompt);
  const result = new Map<
    number,
    { prompt: string; options: B1StructuredOption[]; status: "structured" | "needs_review" }
  >();

  const markerRe = /(?:^|\n)\s*([1-9][0-9]?)\s*(?=[A-ZÄÖÜa-zäöü])/g;
  const markers: Array<{ n: number; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(text)) !== null) {
    const n = Number(m[1]);
    if (n >= from && n <= to && !markers.some((x) => x.n === n)) {
      markers.push({ n, index: m.index + (m[0].startsWith("\n") ? 1 : 0) });
    }
  }
  markers.sort((a, b) => a.index - b.index);

  // Try to collect lettered ads a–j as shared option bank
  const adOptions: B1StructuredOption[] = [];
  const adMatches = text.matchAll(/(?:^|\n)\s*([a-jA-J])\s*[).:\-–]?\s*([^\n]{10,})/g);
  for (const am of adMatches) {
    const label = am[1]!.toLowerCase();
    if (adOptions.some((o) => o.label === label)) continue;
    adOptions.push({
      id: label,
      label,
      text: am[2]!.trim(),
    });
  }
  // Always offer 0 as "keine passende Anzeige" when instruction mentions it
  if (/keine\s*passende|schreibenSie\s*0|\b0\b/i.test(text) && !adOptions.some((o) => o.id === "0")) {
    adOptions.push({ id: "0", label: "0", text: "keine passende Anzeige" });
  }

  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i]!;
    const end = i + 1 < markers.length ? markers[i + 1]!.index : text.length;
    let chunk = text.slice(cur.index, end).trim();
    chunk = chunk.replace(/^\d{1,2}\s*/, "").trim();
    // Stop at ads section
    const adBreak = chunk.search(/\n(?:Dringend|Anzeige|Eselfohlen|[a-j]\s)/i);
    if (adBreak > 20) chunk = chunk.slice(0, adBreak).trim();

    result.set(cur.n, {
      prompt: chunk,
      options: adOptions.length > 0 ? adOptions : [],
      status: chunk.length > 10 ? (adOptions.length >= 3 ? "structured" : "needs_review") : "needs_review",
    });
  }

  return result;
}

function fillRange(
  found: Map<number, { prompt: string; options: B1StructuredOption[]; status: "structured" | "needs_review" }>,
  from: number,
  to: number,
  fallbackOptions: B1StructuredOption[] | null,
): Map<number, { prompt: string; options: B1StructuredOption[]; status: "structured" | "needs_review" | "placeholder" }> {
  const out = new Map<
    number,
    { prompt: string; options: B1StructuredOption[]; status: "structured" | "needs_review" | "placeholder" }
  >();
  for (let n = from; n <= to; n++) {
    const hit = found.get(n);
    if (hit) {
      out.set(n, {
        ...hit,
        options: hit.options.length > 0 ? hit.options : fallbackOptions ?? [],
      });
    } else {
      out.set(n, {
        prompt: "",
        options: fallbackOptions ?? [],
        status: "placeholder",
      });
    }
  }
  return out;
}

/** Lesen Teil4: name roster; Ja/Nein options. Comments often two-column OCR — keep names. */
function extractLesenTeil4Items(
  prompt: string,
): Map<number, { prompt: string; status: "structured" | "needs_review" }> {
  const text = cleanNoise(prompt);
  const items = new Map<number, { prompt: string; status: "structured" | "needs_review" }>();

  const kommentareIdx = text.search(/\n\s*Kommentare\b/i);
  const roster = kommentareIdx >= 0 ? text.slice(0, kommentareIdx) : text;

  const re = /(?:^|\n)\s*(?:[\[O])?([0-9]{1,2})\s*([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ]+)/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(roster)) !== null) {
    let n = Number(mm[1]);
    const name = mm[2]!.trim();
    if (n < 20) {
      if (n === 0 && /Henriette/i.test(name)) n = 21;
      else if (n === 2 && /Nils/i.test(name)) n = 22;
      else if (n >= 0 && n <= 6) n = 20 + n;
    }
    if (n >= 20 && n <= 26 && !items.has(n)) {
      items.set(n, { prompt: name, status: "structured" });
    }
  }
  return items;
}

/** Matching options: letters a–j (+0) from OCR ads when present; never invent ad copy. */
function extractLesenAdOptions(prompt: string): B1StructuredOption[] {
  const text = cleanNoise(prompt);
  const adOptions: B1StructuredOption[] = [];
  const adMatches = text.matchAll(
    /(?:^|\n)\s*([a-jA-J])\s*[).:\-–]?\s*([^\n]{8,})/g,
  );
  for (const am of adMatches) {
    const label = am[1]!.toLowerCase();
    if (adOptions.some((o) => o.label === label)) continue;
    // Skip false positives that are situation numbers residue
    if (/^(Susanne|Thomas|Familie|Herr|Frau|Karl|Eva)\b/i.test(am[2]!)) continue;
    adOptions.push({ id: label, label, text: am[2]!.trim() });
  }
  if (/keine\s*passende|schreibenSie\s*0|\b0\b/i.test(text) && !adOptions.some((o) => o.id === "0")) {
    adOptions.push({ id: "0", label: "0", text: "keine passende Anzeige" });
  }
  return adOptions.sort((a, b) => a.label.localeCompare(b.label));
}

export function transformLesenSection(exam: B1DraftExam): B1StructuredQuestion[] {
  const section = exam.sections.find((s) => s.type === "lesen");
  if (!section) return [];

  const layout = lesenPageLayout(section);
  const out: B1StructuredQuestion[] = [];

  // ——— Teil 1: P01 passage + P02 RF statements Q1–6 ———
  {
    const statementPage =
      layout.teil1Statements && isRfStatementPage(layout.teil1Statements.prompt)
        ? layout.teil1Statements
        : sortPages(section).find((p) => isRfStatementPage(p.prompt)) ?? layout.teil1Statements;

    const passagePage = layout.teil1Passage;
    const passage = passagePage ? extractLesenPassageBody(passagePage.prompt) : null;
    const pageIds = [statementPage?.id, passagePage?.id].filter(Boolean) as string[];
    const sources = [statementPage?.source, passagePage?.source].filter((s) => s !== undefined);

    if (statementPage) {
      const { statements, transform_status } = extractTrueFalseStatements(statementPage.prompt, 6);
      statements.forEach((stmt, idx) => {
        const order = 1 + idx;
        out.push(
          makeQuestion({
            examId: exam.id,
            section: "LESEN",
            order,
            type: "true_false",
            prompt: stmt,
            options: RF_OPTIONS,
            teil: 1,
            passage,
            pageIds: pageIds.length ? pageIds : [statementPage.id],
            sources: sources.length ? sources : [statementPage.source],
            transform_status: stmt ? transform_status : "placeholder",
            points: 1,
            ocr_raw_prompt: statementPage.prompt,
            notes: passage ? ["passage_from_teil1_page"] : ["passage_missing"],
          }),
        );
      });
    } else {
      for (let n = 1; n <= 6; n++) {
        out.push(
          makeQuestion({
            examId: exam.id,
            section: "LESEN",
            order: n,
            type: "true_false",
            prompt: "",
            options: RF_OPTIONS,
            teil: 1,
            passage,
            pageIds: section.questions.map((q) => q.id),
            sources: section.questions.map((q) => q.source),
            transform_status: "placeholder",
            points: 1,
          }),
        );
      }
    }
  }

  // ——— Teil 2: P03–P04 single_choice Q7–12 ———
  {
    const pages = layout.teil2.length ? layout.teil2 : pagesForTeil(section, 2);
    const joined = joinPages(pages);
    const passage = pages.map((p) => extractPressPassage(p.prompt)).filter(Boolean).join("\n\n") || null;
    const found = extractSingleChoiceItems(joined.text, 7, 12);
    const filled = fillRange(found, 7, 12, null);
    for (const [n, item] of filled) {
      out.push(
        makeQuestion({
          examId: exam.id,
          section: "LESEN",
          order: n,
          type: "single_choice",
          prompt: item.prompt || `Frage ${n} — OCR unvollständig`,
          options: item.options.length > 0 ? item.options : null,
          teil: 2,
          passage,
          pageIds: joined.pageIds,
          sources: joined.sources,
          transform_status: item.status,
          points: 1,
          ocr_raw_prompt: joined.text.slice(0, 2500),
        }),
      );
    }
  }

  // ——— Teil 3: P05–P06 matching Q13–19 ———
  {
    const pages = layout.teil3.length ? layout.teil3 : pagesForTeil(section, 3);
    const joined = joinPages(pages);
    const adOptions = extractLesenAdOptions(joined.text);
    const found = extractMatchingItems(joined.text, 13, 19);
    const filled = fillRange(found, 13, 19, adOptions.length ? adOptions : null);
    for (const [n, item] of filled) {
      const opts = item.options.length > 0 ? item.options : adOptions;
      out.push(
        makeQuestion({
          examId: exam.id,
          section: "LESEN",
          order: n,
          type: "matching",
          prompt: item.prompt || `Situation ${n} — OCR unvollständig`,
          options: opts.length > 0 ? opts : null,
          teil: 3,
          pageIds: joined.pageIds,
          sources: joined.sources,
          transform_status:
            item.status === "placeholder"
              ? "placeholder"
              : item.prompt && opts.length >= 3
                ? "structured"
                : "needs_review",
          points: 1,
          ocr_raw_prompt: joined.text.slice(0, 2500),
          notes: opts.length < 3 ? ["missing_options", "ads_ocr_incomplete"] : [],
        }),
      );
    }
  }

  // ——— Teil 4: P07 Ja/Nein Q20–26 ———
  {
    const page = layout.teil4 ?? pagesForTeil(section, 4)[0];
    const text = page?.prompt ?? joinPages(pagesForTeil(section, 4)).text;
    const pageIds = page ? [page.id] : section.questions.map((q) => q.id);
    const sources = page ? [page.source] : section.questions.map((q) => q.source);
    const items = extractLesenTeil4Items(text);
    for (let n = 20; n <= 26; n++) {
      const hit = items.get(n);
      out.push(
        makeQuestion({
          examId: exam.id,
          section: "LESEN",
          order: n,
          type: "true_false",
          prompt: hit?.prompt || `Frage ${n} (Ja/Nein) — OCR unvollständig`,
          options: JA_NEIN_OPTIONS,
          teil: 4,
          pageIds,
          sources,
          transform_status: hit ? hit.status : "placeholder",
          points: 1,
          ocr_raw_prompt: text.slice(0, 2000),
          notes: hit ? [] : ["teil4_name_not_found"],
        }),
      );
    }
  }

  // ——— Teil 5: P08 single_choice Q27–30 ———
  {
    const page = layout.teil5 ?? pagesForTeil(section, 5)[0];
    const pages = page ? [page] : pagesForTeil(section, 5);
    const joined = joinPages(pages);
    const passage = extractPressPassage(joined.text) || extractLesenPassageBody(joined.text);
    // Passage is the museum text after questions on P08 — take block after Q30 options
    const museumIdx = joined.text.search(/\n\s*Deutsches\s*Museum\b/i);
    const passageFinal =
      museumIdx >= 0 ? cleanNoise(joined.text.slice(museumIdx)).trim() : passage;
    const found = extractSingleChoiceItems(joined.text, 27, 30);
    const filled = fillRange(found, 27, 30, null);
    for (const [n, item] of filled) {
      out.push(
        makeQuestion({
          examId: exam.id,
          section: "LESEN",
          order: n,
          type: "single_choice",
          prompt: item.prompt || `Frage ${n} — OCR unvollständig`,
          options: item.options.length > 0 ? item.options : null,
          teil: 5,
          passage: passageFinal || null,
          pageIds: joined.pageIds,
          sources: joined.sources,
          transform_status: item.status,
          points: 1,
          ocr_raw_prompt: joined.text.slice(0, 2500),
        }),
      );
    }
  }

  return out.sort((a, b) => a.order - b.order);
}

/** Parse Hören Teil1: Text1..Text5 each yield RF then MC → Q1–10. Skip Beispiel. */
function parseHoerenTeil1(
  prompt: string,
): Map<
  number,
  {
    prompt: string;
    options: B1StructuredOption[] | null;
    status: "structured" | "needs_review" | "placeholder";
    subtype: "true_false" | "single_choice";
  }
> {
  const result = new Map<
    number,
    {
      prompt: string;
      options: B1StructuredOption[] | null;
      status: "structured" | "needs_review" | "placeholder";
      subtype: "true_false" | "single_choice";
    }
  >();

  let body = cleanNoise(prompt);
  // Drop Beispiel through start of Text1
  const text1 = body.search(/\n\s*Text\s*1\b/i);
  if (text1 >= 0) body = body.slice(text1);

  const textBlocks = body.split(/\n\s*Text\s*([1-5])\b/i);
  // split yields: [before, num, content, num, content, ...]
  for (let i = 1; i + 1 < textBlocks.length; i += 2) {
    const textNum = Number(textBlocks[i]);
    if (!textNum || textNum < 1 || textNum > 5) continue;
    const chunk = textBlocks[i + 1] ?? "";
    const base = (textNum - 1) * 2 + 1; // Text1→1, Text2→3, ...

    const rfParts = chunk.split(/\n\s*Richtig\s*\n\s*Falsch\s*/i);
    let rfPrompt = "";
    let mcChunk = "";
    if (rfParts.length >= 2) {
      rfPrompt = rfParts[0]!
        .replace(/^(?:[\[@])?\s*\d{1,2}\s*/, "")
        .replace(/\n+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      mcChunk = rfParts.slice(1).join("\n").trim();
    } else {
      // No RF pair — try first line as RF, rest as MC
      const lines = chunk
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      rfPrompt = (lines[0] ?? "").replace(/^(?:[\[@])?\s*\d{1,2}\s*/, "");
      mcChunk = lines.slice(1).join("\n");
    }

    result.set(base, {
      prompt: rfPrompt,
      options: RF_OPTIONS,
      status: rfPrompt.length > 5 ? "structured" : "placeholder",
      subtype: "true_false",
    });

    // MC: strip leading number, take stem + up to 3 options
    const mcLines = mcChunk
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^Zertifikat/i.test(l) && !/^Text\s*\d/i.test(l));
    let stem = "";
    let optLines: string[] = [];
    if (mcLines.length >= 4) {
      const first = mcLines[0]!.replace(/^(?:[\[@])?\s*\d{1,2}\s*/, "");
      stem = [first, ...mcLines.slice(1, mcLines.length - 3)].join(" ").trim();
      optLines = mcLines.slice(-3);
    } else if (mcLines.length >= 1) {
      stem = mcLines[0]!.replace(/^(?:[\[@])?\s*\d{1,2}\s*/, "");
      optLines = mcLines.slice(1, 4);
    }
    const options: B1StructuredOption[] = optLines.map((t, idx) => ({
      id: ABC_LABELS[idx] ?? String(idx),
      label: ABC_LABELS[idx] ?? String(idx),
      text: t.replace(/^[@•·\-]\s*/, "").trim(),
    }));
    result.set(base + 1, {
      prompt: stem,
      options: options.length > 0 ? options : null,
      status:
        stem.length > 3 && options.length === 3
          ? "structured"
          : stem.length > 0
            ? "needs_review"
            : "placeholder",
      subtype: "single_choice",
    });
  }

  return result;
}

/**
 * Parse Hören Teil2 MC Q11–15. OCR often drops tens digit (1Wer…=11, 3Die…=13).
 * Do not treat audio-slot "1/2" headers as question numbers.
 */
function parseHoerenTeil2Mc(
  prompt: string,
): Map<number, { prompt: string; options: B1StructuredOption[]; status: "structured" | "needs_review" }> {
  let text = cleanNoise(prompt);
  // Drop HOREN/Teil2/1/2 instruction block — keep from situational stem or first task
  const cut =
    text.search(/\nSie\s*sind\s*auf/i) >= 0
      ? text.search(/\nSie\s*sind\s*auf/i)
      : text.search(/\n\s*(?:[\[@])?\s*(?:1[1-5]|1(?=[A-ZÄÖÜ])|3(?=[A-ZÄÖÜ]))/);
  if (cut >= 0) text = text.slice(cut);

  // Remap truncated OCR numbers only when clearly task stems (not "1/2")
  text = text
    .replace(/(?:^|\n)\s*(?:[\[@])?\s*1(?=[A-ZÄÖÜa-zäöü]{3,})/g, "\n11")
    .replace(/(?:^|\n)\s*(?:[\[@])?\s*3(?=[A-ZÄÖÜa-zäöü]{3,})/g, "\n13");

  return extractSingleChoiceItems(text, 11, 15);
}

/** Hören Teil3 RF Q16–22 — use RF split in order; OCR may drop tens digit. */
function parseHoerenTeil3Rf(prompt: string): string[] {
  const { statements } = extractTrueFalseStatements(prompt, 7);
  // Also strip leading Beispiel if present in statements
  return statements.map((s) =>
    s
      .replace(/^(?:[\[@])?\s*\d{1,2}\s*/, "")
      .replace(/\n+/g, " ")
      .trim(),
  );
}

/** Hören Teil4 matching Q23–30 — speakers from OCR header only. */
function parseHoerenTeil4(prompt: string): {
  items: Map<number, string>;
  options: B1StructuredOption[];
} {
  const text = cleanNoise(prompt);
  const options: B1StructuredOption[] = [];
  // Capture speaker column headers near top
  const header = text.slice(0, 800);
  const speakers: string[] = [];
  if (/Moderatorin/i.test(header)) speakers.push("Moderatorin");
  const berger = header.match(/([I1]\.?\s*Berger)/i);
  if (berger) speakers.push(berger[1]!.replace(/^1/, "I"));
  const weser = header.match(/(K\.?\s*Weser)/i);
  if (weser) speakers.push(weser[1]!);
  speakers.forEach((s, i) => {
    options.push({
      id: String(i + 1),
      label: ABC_LABELS[i] ?? String(i),
      text: s,
    });
  });

  const items = new Map<number, string>();
  // Drop Beispiel line
  let body = text.replace(/\n\s*Beispiel\b[^\n]*/i, "\n");
  const re = /(?:^|\n)\s*(?:[\[O])?([0-9]{1,2})\s*([A-ZÄÖÜa-zäöü][^\n]{3,})/g;
  let mm: RegExpExecArray | null;
  const rawHits: Array<{ n: number; text: string; index: number }> = [];
  while ((mm = re.exec(body)) !== null) {
    let n = Number(mm[1]);
    // OCR: 2Man → 27 when in 23–30 zone
    if (n < 23) {
      if (n === 2) n = 27;
      else if (n >= 3 && n <= 9) n = 20 + n;
    }
    if (n >= 23 && n <= 30) {
      rawHits.push({
        n,
        text: mm[2]!.trim(),
        index: mm.index,
      });
    }
  }
  // Merge wrapped continuations (line after without number)
  for (let i = 0; i < rawHits.length; i++) {
    const cur = rawHits[i]!;
    let promptText = cur.text;
    const nextStart = i + 1 < rawHits.length ? rawHits[i + 1]!.index : body.length;
    const between = body.slice(cur.index + String(cur.n).length + cur.text.length, nextStart);
    const extra = between
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^\d/.test(l) && !/^Zertifikat/i.test(l) && l !== "D");
    if (extra.length) promptText = `${promptText} ${extra.join(" ")}`.trim();
    if (!items.has(cur.n)) items.set(cur.n, promptText);
  }

  return { items, options };
}

function hoerenPagesByTeil(section: B1DraftSection): B1DraftQuestion[][] {
  const pages = sortPages(section);
  if (pages.length >= 4) {
    return [pages.slice(0, 1), pages.slice(1, 2), pages.slice(2, 3), pages.slice(3, 4)];
  }
  return [1, 2, 3, 4].map((t) => {
    const hit = pagesForTeil(section, t);
    return hit.length ? hit : [];
  });
}

export function transformHoerenSection(exam: B1DraftExam): B1StructuredQuestion[] {
  const section = exam.sections.find((s) => s.type === "hoeren");
  if (!section) return [];

  const out: B1StructuredQuestion[] = [];
  const byTeil = hoerenPagesByTeil(section);

  // Teil 1 — audio_slot 1 — Q1–10
  {
    const pages = byTeil[0]!.length ? byTeil[0]! : pagesForTeil(section, 1);
    const joined = joinPages(pages.length ? pages : section.questions.slice(0, 1));
    const parsed = parseHoerenTeil1(joined.text);
    for (let n = 1; n <= 10; n++) {
      const hit = parsed.get(n);
      out.push(
        makeQuestion({
          examId: exam.id,
          section: "HOEREN",
          order: n,
          type: "listening",
          prompt: hit?.prompt || `Hören Frage ${n} — OCR unvollständig`,
          options: hit?.options ?? (n % 2 === 1 ? RF_OPTIONS : null),
          teil: 1,
          audio_slot: 1,
          pageIds: joined.pageIds,
          sources: joined.sources,
          transform_status: hit?.status ?? "placeholder",
          points: 1,
          ocr_raw_prompt: joined.text.slice(0, 2500),
          notes: [
            "hoeren_objective",
            `subtype:${hit?.subtype ?? (n % 2 === 1 ? "true_false" : "single_choice")}`,
            ...(hit && (!hit.options || hit.options.length === 0) && hit.subtype === "single_choice"
              ? ["missing_options"]
              : []),
          ],
        }),
      );
    }
  }

  // Teil 2 — audio_slot 2 — Q11–15 MC
  {
    const pages = byTeil[1]!.length ? byTeil[1]! : pagesForTeil(section, 2);
    const joined = joinPages(pages.length ? pages : []);
    const found = parseHoerenTeil2Mc(joined.text);
    const filled = fillRange(found, 11, 15, null);
    for (const [n, item] of filled) {
      out.push(
        makeQuestion({
          examId: exam.id,
          section: "HOEREN",
          order: n,
          type: "listening",
          prompt: item.prompt || `Hören Frage ${n} — OCR unvollständig`,
          options: item.options.length > 0 ? item.options : null,
          teil: 2,
          audio_slot: 2,
          pageIds: joined.pageIds,
          sources: joined.sources,
          transform_status: item.status,
          points: 1,
          ocr_raw_prompt: joined.text.slice(0, 2500),
          notes: [
            "hoeren_objective",
            "subtype:single_choice",
            ...(item.options.length < 3 ? ["missing_options"] : []),
          ],
        }),
      );
    }
  }

  // Teil 3 — audio_slot 3 — Q16–22 RF
  {
    const pages = byTeil[2]!.length ? byTeil[2]! : pagesForTeil(section, 3);
    const joined = joinPages(pages.length ? pages : []);
    const statements = parseHoerenTeil3Rf(joined.text);
    for (let n = 16; n <= 22; n++) {
      const stmt = statements[n - 16] || "";
      out.push(
        makeQuestion({
          examId: exam.id,
          section: "HOEREN",
          order: n,
          type: "listening",
          prompt: stmt || `Hören Frage ${n} — OCR unvollständig`,
          options: RF_OPTIONS,
          teil: 3,
          audio_slot: 3,
          pageIds: joined.pageIds,
          sources: joined.sources,
          transform_status: stmt.length > 5 ? "structured" : "placeholder",
          points: 1,
          ocr_raw_prompt: joined.text.slice(0, 2000),
          notes: ["hoeren_objective", "subtype:true_false"],
        }),
      );
    }
  }

  // Teil 4 — audio_slot 4 — Q23–30 matching
  {
    const pages = byTeil[3]!.length ? byTeil[3]! : pagesForTeil(section, 4);
    const joined = joinPages(pages.length ? pages : []);
    const { items, options } = parseHoerenTeil4(joined.text);
    for (let n = 23; n <= 30; n++) {
      const prompt = items.get(n) || "";
      const opts = options.length > 0 ? options : null;
      out.push(
        makeQuestion({
          examId: exam.id,
          section: "HOEREN",
          order: n,
          type: "listening",
          prompt: prompt || `Aussage ${n} — OCR unvollständig`,
          options: opts,
          teil: 4,
          audio_slot: 4,
          pageIds: joined.pageIds,
          sources: joined.sources,
          transform_status: prompt
            ? opts && opts.length >= 2
              ? "structured"
              : "needs_review"
            : "placeholder",
          points: 1,
          ocr_raw_prompt: joined.text.slice(0, 2000),
          notes: [
            "hoeren_objective",
            "subtype:matching",
            ...(opts ? [] : ["missing_options"]),
          ],
        }),
      );
    }
  }

  return out.sort((a, b) => a.order - b.order);
}

export function transformSchreibenSection(exam: B1DraftExam): B1StructuredQuestion[] {
  const section = exam.sections.find((s) => s.type === "schreiben");
  if (!section) return [];

  const out: B1StructuredQuestion[] = [];
  for (const page of section.questions) {
    const split = splitSchreibenPageBundle(page.prompt, page.source);
    if (split.length > 0) {
      for (const task of split) {
        out.push(
          makeQuestion({
            examId: exam.id,
            section: "SCHREIBEN",
            order: task.order,
            type: "writing",
            prompt: task.prompt,
            options: null,
            teil: task.order,
            pageIds: [page.id],
            sources: [page.source],
            transform_status: task.transform_status,
            points: 0,
            notes: ["schreiben_split", `requirements:${task.requirements.length}`],
            ocr_raw_prompt: page.prompt,
          }),
        );
      }
    }
  }

  // Ensure 3 slots
  while (out.length < 3) {
    const order = out.length + 1;
    out.push(
      makeQuestion({
        examId: exam.id,
        section: "SCHREIBEN",
        order,
        type: "writing",
        prompt: `Schreiben Aufgabe ${order} — OCR unvollständig`,
        options: null,
        teil: order,
        pageIds: section.questions.map((q) => q.id),
        sources: section.questions.map((q) => q.source),
        transform_status: "placeholder",
        points: 0,
      }),
    );
  }

  // Deduplicate by order, keep first 3
  const byOrder = new Map<number, B1StructuredQuestion>();
  for (const q of out) {
    if (!byOrder.has(q.order)) byOrder.set(q.order, q);
  }
  return [1, 2, 3].map((n) => byOrder.get(n)!).filter(Boolean);
}

/**
 * Sprechen: Teil1, Teil2 A, Teil2 B, Teil3 (if present) — never merge A/B.
 */
export function transformSprechenSection(exam: B1DraftExam): B1StructuredQuestion[] {
  const section = exam.sections.find((s) => s.type === "sprechen");
  if (!section) return [];

  const out: B1StructuredQuestion[] = [];
  let order = 0;

  const teil1 = section.questions.find((q) => /\bTeil\s*1(?!\d)/i.test(q.prompt ?? ""));
  const teil2Pages = section.questions.filter((q) => /\bTeil\s*2(?!\d)/i.test(q.prompt ?? ""));
  const teil3Embedded = section.questions.filter((q) => /\bTeil\s*3(?!\d)/i.test(q.prompt ?? ""));

  if (teil1) {
    order += 1;
    out.push(
      makeQuestion({
        examId: exam.id,
        section: "SPRECHEN",
        order,
        type: "speaking",
        prompt: teil1.prompt,
        options: null,
        teil: 1,
        role: null,
        pageIds: [teil1.id],
        sources: [teil1.source],
        transform_status: "structured",
        points: 0,
        notes: ["sprechen_teil1"],
        ocr_raw_prompt: teil1.prompt,
      }),
    );
  }

  // Teil2 A and B — never merge
  let pageA = teil2Pages.find((q) => detectSprechenRole(q.prompt) === "A") ?? null;
  let pageB = teil2Pages.find((q) => detectSprechenRole(q.prompt) === "B") ?? null;
  const leftovers = teil2Pages.filter((q) => q !== pageA && q !== pageB);

  if (!pageA && pageB && leftovers.length >= 1) {
    pageA = leftovers.shift()!;
  } else if (pageA && !pageB && leftovers.length >= 1) {
    pageB = leftovers.shift()!;
  } else if (!pageA && !pageB && leftovers.length >= 2) {
    pageA = leftovers.shift()!;
    pageB = leftovers.shift()!;
  } else if (!pageA && leftovers.length >= 1) {
    pageA = leftovers.shift()!;
  } else if (!pageB && leftovers.length >= 1) {
    pageB = leftovers.shift()!;
  }

  const pushTeil2 = (page: B1DraftQuestion, role: "A" | "B") => {
    order += 1;
    let prompt = page.prompt;
    const teil3Idx = prompt.search(/\bTeil\s*3(?!\d)/i);
    let teil3Prompt: string | null = null;
    if (teil3Idx > 0) {
      teil3Prompt = prompt.slice(teil3Idx).trim();
      prompt = prompt.slice(0, teil3Idx).trim();
    }
    const detected = detectSprechenRole(page.prompt);
    out.push(
      makeQuestion({
        examId: exam.id,
        section: "SPRECHEN",
        order,
        type: "speaking",
        prompt,
        options: null,
        teil: 2,
        role,
        pageIds: [page.id],
        sources: [page.source],
        transform_status: detected === role ? "structured" : "needs_review",
        points: 0,
        notes: [`sprechen_teil2`, `role:${role}`, detected ? `detected:${detected}` : "role_inferred"],
        ocr_raw_prompt: page.prompt,
      }),
    );
    return teil3Prompt;
  };

  const teil3Parts: Array<{ prompt: string; page: B1DraftQuestion }> = [];

  if (pageA) {
    const t3 = pushTeil2(pageA, "A");
    if (t3) teil3Parts.push({ prompt: t3, page: pageA });
  }
  if (pageB && pageB !== pageA) {
    const t3 = pushTeil2(pageB, "B");
    if (t3) teil3Parts.push({ prompt: t3, page: pageB });
  }
  for (const page of leftovers) {
    const t3Idx = page.prompt.search(/\bTeil\s*3(?!\d)/i);
    if (t3Idx > 0) {
      teil3Parts.push({ prompt: page.prompt.slice(t3Idx).trim(), page });
    }
  }

  // Teil3 — prefer dedicated content; if both A and B pages embed Teil3, keep one combined needs_review or first
  if (teil3Parts.length > 0) {
    // Keep separate if prompts differ substantially; else one Teil3
    const unique = teil3Parts.filter(
      (p, i, arr) => arr.findIndex((x) => x.prompt.slice(0, 80) === p.prompt.slice(0, 80)) === i,
    );
    for (const part of unique.slice(0, 1)) {
      order += 1;
      out.push(
        makeQuestion({
          examId: exam.id,
          section: "SPRECHEN",
          order,
          type: "speaking",
          prompt: part.prompt,
          options: null,
          teil: 3,
          role: null,
          pageIds: [part.page.id],
          sources: [part.page.source],
          transform_status: "structured",
          points: 0,
          notes: ["sprechen_teil3_split_from_teil2_page"],
          ocr_raw_prompt: part.page.prompt,
        }),
      );
    }
  } else if (teil3Embedded.length && !teil2Pages.some((q) => teil3Embedded.includes(q))) {
    for (const page of teil3Embedded) {
      order += 1;
      out.push(
        makeQuestion({
          examId: exam.id,
          section: "SPRECHEN",
          order,
          type: "speaking",
          prompt: page.prompt,
          options: null,
          teil: 3,
          pageIds: [page.id],
          sources: [page.source],
          transform_status: "structured",
          points: 0,
          notes: ["sprechen_teil3"],
          ocr_raw_prompt: page.prompt,
        }),
      );
    }
  }

  // Ensure at least Teil1 + Teil2A + Teil2B structure placeholders
  const hasA = out.some((q) => q.teil === 2 && q.role === "A");
  const hasB = out.some((q) => q.teil === 2 && q.role === "B");
  if (!hasA) {
    order += 1;
    out.push(
      makeQuestion({
        examId: exam.id,
        section: "SPRECHEN",
        order,
        type: "speaking",
        prompt: "Sprechen Teil 2 — Kandidat A — OCR unvollständig",
        options: null,
        teil: 2,
        role: "A",
        pageIds: section.questions.map((q) => q.id),
        sources: section.questions.map((q) => q.source),
        transform_status: "placeholder",
        points: 0,
      }),
    );
  }
  if (!hasB) {
    order += 1;
    out.push(
      makeQuestion({
        examId: exam.id,
        section: "SPRECHEN",
        order,
        type: "speaking",
        prompt: "Sprechen Teil 2 — Kandidat B — OCR unvollständig",
        options: null,
        teil: 2,
        role: "B",
        pageIds: section.questions.map((q) => q.id),
        sources: section.questions.map((q) => q.source),
        transform_status: "placeholder",
        points: 0,
      }),
    );
  }

  return out;
}

function statsForExam(exam: B1StructuredExam): B1ExamStructureStats {
  const sections = Object.fromEntries(exam.sections.map((s) => [s.type, s.questions])) as Record<
    string,
    B1StructuredQuestion[]
  >;
  const all = exam.sections.flatMap((s) => s.questions);
  const blockers: string[] = [];
  const lesenQs = sections["lesen"] ?? [];
  const hoerenQs = sections["hoeren"] ?? [];
  const schreibenQs = sections["schreiben"] ?? [];
  const sprechen = sections["sprechen"] ?? [];
  if (lesenQs.length !== 30) blockers.push(`lesen_count=${lesenQs.length}`);
  if (hoerenQs.length !== 30) blockers.push(`hoeren_count=${hoerenQs.length}`);
  if (schreibenQs.length !== 3) blockers.push(`schreiben_count=${schreibenQs.length}`);
  if (!sprechen.some((q) => q.teil === 2 && q.role === "A")) blockers.push("sprechen_missing_teil2_A");
  if (!sprechen.some((q) => q.teil === 2 && q.role === "B")) blockers.push("sprechen_missing_teil2_B");
  if (all.some((q) => q.answer_key !== null)) blockers.push("answer_key_present");

  return {
    lesen: lesenQs.length,
    hoeren: hoerenQs.length,
    schreiben: schreibenQs.length,
    sprechen: sprechen.length,
    needs_review: all.filter((q) => q.review_status === "needs_review").length,
    verified: all.filter((q) => q.review_status === "verified").length,
    structured: all.filter((q) => q.transform_status === "structured").length,
    placeholder: all.filter((q) => q.transform_status === "placeholder").length,
    missing_options: all.filter(
      (q) =>
        (q.type === "single_choice" || q.type === "matching" || q.type === "true_false") &&
        (!q.options || q.options.length === 0),
    ).length,
    blockers,
  };
}

export function transformB1Exam(exam: B1DraftExam): B1StructuredExam {
  const sections: B1StructuredSection[] = [
    {
      id: `${exam.id}-LESEN`,
      type: "lesen",
      title: "Lesen",
      max_points: 30,
      questions: transformLesenSection(exam),
    },
    {
      id: `${exam.id}-HOEREN`,
      type: "hoeren",
      title: "Hören",
      max_points: 30,
      questions: transformHoerenSection(exam),
    },
    {
      id: `${exam.id}-SCHREIBEN`,
      type: "schreiben",
      title: "Schreiben",
      max_points: null,
      questions: transformSchreibenSection(exam),
    },
    {
      id: `${exam.id}-SPRECHEN`,
      type: "sprechen",
      title: "Sprechen",
      max_points: null,
      questions: transformSprechenSection(exam),
    },
  ];

  const structured: B1StructuredExam = {
    ...exam,
    total_points: null,
    automatic_points: 60,
    manual_points: null,
    publishable: false,
    status: "draft",
    integrity: {
      ...exam.integrity,
      answer_keys_included: false,
      answer_keys_invented: false,
      manual_review_required: true,
      blocking_reasons: [
        ...(exam.integrity.blocking_reasons ?? []),
        "structured_transform_needs_review",
        "provisional_points_rubric",
      ].filter((v, i, a) => a.indexOf(v) === i),
    },
    sections,
  };
  structured.structure_stats = statsForExam(structured);
  return structured;
}

export function transformB1ExamBank(bank: B1ExamBank): {
  bank: Omit<B1ExamBank, "exams"> & {
    exams: B1StructuredExam[];
    delivery_type: string;
  };
  stats: B1StructureBankStats;
} {
  const exams = bank.exams.map(transformB1Exam);
  const per_exam = exams.map((e) => ({ exam_id: e.id, ...statsForExam(e) }));
  const stats: B1StructureBankStats = {
    exams: exams.length,
    lesen_total: per_exam.reduce((s, e) => s + e.lesen, 0),
    lesen_expected: 15 * 30,
    hoeren_total: per_exam.reduce((s, e) => s + e.hoeren, 0),
    hoeren_expected: 15 * 30,
    schreiben_total: per_exam.reduce((s, e) => s + e.schreiben, 0),
    schreiben_expected: 15 * 3,
    sprechen_total: per_exam.reduce((s, e) => s + e.sprechen, 0),
    needs_review: per_exam.reduce((s, e) => s + e.needs_review, 0),
    verified: per_exam.reduce((s, e) => s + e.verified, 0),
    structured: per_exam.reduce((s, e) => s + e.structured, 0),
    placeholder: per_exam.reduce((s, e) => s + e.placeholder, 0),
    missing_options: per_exam.reduce((s, e) => s + e.missing_options, 0),
    blockers: per_exam.flatMap((e) => e.blockers.map((b) => `${e.exam_id}:${b}`)),
    per_exam,
  };

  return {
    bank: {
      ...bank,
      delivery_type: "structured-interactive-draft",
      safety: {
        ...bank.safety,
        status: "draft",
        publishable: false,
        ocr_verified: false,
        structured_answer_keys_imported: false,
        manual_review_required: true,
      },
      exams,
    },
    stats,
  };
}

/**
 * Proposed answer keys from OCR appendix only — never confirmed without visual PDF check.
 */
export function proposeAnswerKeysFromAppendix(bank: B1ExamBank): {
  generated_at: string;
  source_pdf_pages: number[];
  structured_answer_keys: null;
  manual_visual_verification_required: true;
  confirmed_imported: 0;
  proposed_blocks: B1ProposedAnswerKeyBlock[];
  warning: string;
} {
  const ak = bank.appendices?.["official_answer_keys"] as
    | {
        pages?: Array<{ ocr_text?: string }>;
        source_pdf_pages?: number[];
        structured_answer_keys?: unknown;
      }
    | undefined;

  const ocr = (ak?.pages || []).map((p) => p.ocr_text || "").join("\n");
  const indices: Array<{ n: number; i: number }> = [];
  const re = /Modelltest\s*(\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(ocr)) !== null) {
    indices.push({ n: Number(match[1]), i: match.index });
  }

  const proposed_blocks: B1ProposedAnswerKeyBlock[] = [];
  for (let i = 0; i < indices.length; i++) {
    const cur = indices[i]!;
    const end = i + 1 < indices.length ? indices[i + 1]!.i : ocr.length;
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
      ocr_raw: chunk.slice(0, 1500),
      note: "OCR solutions pages — not visually confirmed; do not import as confirmed keys",
    });
  }

  return {
    generated_at: new Date().toISOString(),
    source_pdf_pages: ak?.source_pdf_pages ?? [247, 248, 249],
    structured_answer_keys: null,
    manual_visual_verification_required: true,
    confirmed_imported: 0,
    proposed_blocks,
    warning:
      "Aucune clé confirmée. Ne pas utiliser comme corrigé officiel sans relecture visuelle PDF pages 247–249.",
  };
}
