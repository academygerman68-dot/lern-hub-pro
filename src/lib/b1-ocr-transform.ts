/**
 * Heuristic OCR transforms for B1 scanned drafts.
 * Never invents answer keys, sample answers, or points.
 */

export type SchreibenTransformStatus = "structured" | "needs_review";

export type SchreibenSplitTask = {
  idSuffix: string;
  order: number;
  prompt: string;
  requirements: string[];
  recommended_words: string | null;
  needs_review: true;
  transform_status: SchreibenTransformStatus;
};

export type LesenBundleClassification = {
  suggestedType: "page_bundle" | "true_false_page" | "single_choice_page";
  needs_review: true;
  notes: string;
};

// OCR often glues markers: "Aufgabe2Arbeitszeit", "Aufgabe3Arbeitszit" — no word boundary after digit.
const AUFGABE_SPLIT_RE = /(?:^|\n)\s*Aufgabe\s*([123])(?=[A-Za-zÄÖÜäöüß\s:]|$)/gi;

function extractBulletRequirements(text: string): string[] {
  const reqs: string[] = [];
  for (const line of text.split(/\n/)) {
    const m = line.match(/^\s*-\s*(.+?)\s*$/);
    if (m?.[1]) {
      reqs.push(m[1].trim());
    }
  }
  return reqs;
}

function extractRecommendedWords(text: string): string | null {
  const m = text.match(/circa\s*(\d+)\s*W[öo]rter/i);
  if (!m) return null;
  return `circa ${m[1]} Wörter`;
}

/**
 * Split a Schreiben page bundle when Aufgabe 1/2/3 markers are present.
 * Does not invent sample answers or points.
 */
export function splitSchreibenPageBundle(
  prompt: string,
  _source?: unknown,
): SchreibenSplitTask[] {
  if (!prompt || typeof prompt !== "string") return [];

  const markers: Array<{ num: number; index: number; matchLen: number }> = [];
  const re = new RegExp(AUFGABE_SPLIT_RE.source, AUFGABE_SPLIT_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(prompt)) !== null) {
    const num = Number(match[1]);
    if (num >= 1 && num <= 3) {
      markers.push({ num, index: match.index + (match[0].startsWith("\n") ? 1 : 0), matchLen: match[0].length });
    }
  }

  if (markers.length === 0) return [];

  // Deduplicate by Aufgabe number (keep first occurrence)
  const byNum = new Map<number, (typeof markers)[0]>();
  for (const marker of markers) {
    if (!byNum.has(marker.num)) byNum.set(marker.num, marker);
  }
  const ordered = [...byNum.values()].sort((a, b) => a.index - b.index);
  if (ordered.length === 0) return [];

  const detectedNums = new Set(ordered.map((m) => m.num));
  const hasAllThree = detectedNums.has(1) && detectedNums.has(2) && detectedNums.has(3);
  const transformStatus: SchreibenTransformStatus = hasAllThree ? "structured" : "needs_review";

  const tasks: SchreibenSplitTask[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const current = ordered[i]!;
    const start = current.index;
    const end = i + 1 < ordered.length ? ordered[i + 1]!.index : prompt.length;
    const chunk = prompt.slice(start, end).trim();
    if (!chunk) continue;

    tasks.push({
      idSuffix: `A${current.num}`,
      order: current.num,
      prompt: chunk,
      requirements: extractBulletRequirements(chunk),
      recommended_words: extractRecommendedWords(chunk),
      needs_review: true,
      transform_status: transformStatus,
    });
  }

  return tasks.slice(0, 3);
}

/**
 * Detect Kandidat A/B from OCR (may be truncated: andidat, Kandida, Kandid).
 */
export function detectSprechenRole(prompt: string): "A" | "B" | null {
  if (!prompt) return null;

  if (/Kandidat\s*A\b/i.test(prompt) || /(?:^|\n)\s*andidat\s*A\b/i.test(prompt)) {
    return "A";
  }
  if (/Kandidat\s*B\b/i.test(prompt) || /(?:^|\n)\s*andidat\s*B\b/i.test(prompt)) {
    return "B";
  }

  const headerLines = prompt.split(/\n/).slice(0, 6).map((l) => l.trim());
  const header = headerLines.join("\n");

  // Explicit A/B on its own line near a Kandid* header (common OCR layout)
  const hasKandidToken = headerLines.some((l) => /^(?:k)?andid(?:at|a)?$/i.test(l));
  if (hasKandidToken && headerLines.some((l) => l === "B")) {
    return "B";
  }
  if (hasKandidToken && headerLines.some((l) => l === "A")) {
    return "A";
  }

  // Truncated patterns observed in the bank:
  // - A sheets often OCR as "andidat" (lost leading K), anywhere in header
  // - B sheets often keep "Kandid" / "Kandida" (and sometimes a following "B")
  if (headerLines.some((l) => /^andidat$/i.test(l) || /^andidat\b/i.test(l))) {
    return "A";
  }
  if (headerLines.some((l) => /^kandida$/i.test(l) || /^kandid$/i.test(l) || /^kandidat$/i.test(l))) {
    if (/\bB\b/.test(header)) return "B";
    // Leading K retained without A → treat as B sheet heuristic
    return "B";
  }

  if (/kandidat\s*a\b/i.test(prompt)) return "A";
  if (/kandidat\s*b\b/i.test(prompt)) return "B";

  return null;
}

/**
 * Staff-UI heuristic only — never invents options or answers.
 */
export function classifyLesenBundle(prompt: string): LesenBundleClassification {
  const text = prompt ?? "";
  const lower = text.toLowerCase();

  const looksTrueFalse =
    /richtig\s+oder\s+falsch/i.test(text) ||
    (/\brichtig\b/i.test(text) && /\bfalsch\b/i.test(text) && /aussagen/i.test(lower));

  if (looksTrueFalse) {
    return {
      suggestedType: "true_false_page",
      needs_review: true,
      notes: "Heuristique: indices Richtig/Falsch détectés — options/clés non inventées.",
    };
  }

  const looksSingleChoice =
    /richtige\s*l[oö]sung\s*a\s*,?\s*b\s*(oder|,)\s*c/i.test(text) ||
    /w[aä]hlen\s*sie\s*bei\s*jeder\s*aufgabe\s*die\s*richtige/i.test(text) ||
    /\ba\s*,\s*b\s*(oder|,)\s*c\b/i.test(text);

  if (looksSingleChoice) {
    return {
      suggestedType: "single_choice_page",
      needs_review: true,
      notes: "Heuristique: indices a/b/c détectés — options/clés non inventées.",
    };
  }

  return {
    suggestedType: "page_bundle",
    needs_review: true,
    notes: "Page OCR conservée en bundle — découpage interactif à confirmer.",
  };
}
