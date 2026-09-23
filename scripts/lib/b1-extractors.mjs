/**
 * OCR extractors for B1 Lesen Teil2/Teil3 repair (plain JS, no TS import).
 * Mirrors src/lib/b1-structure-transform.ts extractSingleChoiceItems / extractMatchingItems.
 */

function cleanNoise(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ");
}

const ABC_LABELS = ["a", "b", "c"];

export function extractSingleChoiceItems(prompt, from, to) {
  const text = cleanNoise(prompt);
  const result = new Map();

  let work = text;
  const beispiel = work.search(/\n\s*Beispiel\b/i);
  if (beispiel >= 0) {
    const after = work.slice(beispiel + 1);
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
  const markers = [];
  let m;
  while ((m = markerRe.exec(work)) !== null) {
    const n = Number(m[1]);
    if (n >= from && n <= to && !markers.some((x) => x.n === n)) {
      markers.push({ n, index: m.index + (m[0].startsWith("\n") ? 1 : 0), raw: m[0] });
    }
  }
  markers.sort((a, b) => a.index - b.index);

  const parseChunk = (chunkRaw) => {
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

    let stem;
    let optionLines;
    if (lines.length >= 4) {
      optionLines = lines.slice(-3);
      stem = lines.slice(0, lines.length - 3).join(" ").trim();
    } else if (lines.length === 3) {
      if (lines[0].length > 40) {
        stem = lines[0];
        optionLines = lines.slice(1);
      } else {
        stem = "";
        optionLines = lines;
      }
    } else {
      stem = lines.join(" ");
      optionLines = [];
    }

    const options = optionLines.slice(0, 3).map((t, idx) => ({
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
    const cur = markers[i];
    const end = i + 1 < markers.length ? markers[i + 1].index : work.length;
    result.set(cur.n, parseChunk(work.slice(cur.index, end).trim()));
  }

  const isStemLine = (l) =>
    /\.\.\.\s*$|…\s*$/.test(l) ||
    /geht\s*es\s*darum/i.test(l) ||
    (/^[A-ZÄÖÜ]/.test(l.replace(/^\d+\s*/, "")) &&
      /(erkennt man|geht es|stimmen Sie|meint|sagt|w[aä]hlt)/i.test(l));

  const expandUnnumberedStems = (startN, chunkRaw) => {
    const lines = chunkRaw
      .replace(/^(?:[\[@])?\s*\d{1,2}\s*/, "")
      .split(/\n/)
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !/^(LESEN|HOREN|HÖREN|Teil\s*\d+|WahlenSie.*|LesenSie.*|auseiner|\d{1,3}$)/i.test(l) &&
          !/^Zertifikat/i.test(l),
      );
    if (lines.length < 4) return;

    const stemIdx = [];
    for (let li = 0; li < lines.length; li++) {
      if (li === 0 || isStemLine(lines[li])) stemIdx.push(li);
    }
    const starts = stemIdx.filter((v, i, a) => i === 0 || v - (a[i - 1] ?? -99) > 1);
    if (starts.length < 2) return;

    for (let si = 0; si < starts.length; si++) {
      const n = startN + si;
      if (n > to) break;
      const fromL = starts[si];
      const toL = si + 1 < starts.length ? starts[si + 1] : lines.length;
      const slice = lines.slice(fromL, toL);
      if (slice.length < 2) continue;
      const parsed = parseChunk(slice.join("\n"));
      if (parsed.prompt.length > 5 && parsed.options.length === 3) {
        result.set(n, { ...parsed, status: "needs_review" });
      }
    }
  };

  for (const [n] of [...result.entries()]) {
    const marker = markers.find((x) => x.n === n);
    if (!marker) continue;
    const next = markers.find((x) => x.n > n);
    const end = next?.index ?? work.length;
    expandUnnumberedStems(n, work.slice(marker.index, end));
  }

  if (markers.length > 0) {
    const first = markers[0];
    const lastMarker = markers[markers.length - 1];
    const spanEnd = markers.length === 1 ? work.length : lastMarker.index + 800;
    expandUnnumberedStems(first.n, work.slice(first.index, Math.min(work.length, spanEnd)));
  }

  const expected = [];
  for (let n = from; n <= to; n++) expected.push(n);
  const missing = expected.filter((n) => !result.has(n) || result.get(n).options.length < 3);
  if (missing.length > 0) {
    const inDiesem = work.match(
      /((?:^|\n)In\s*diesem[\s\S]*?)(?=\n\s*(?:[\[@])?\s*(?:[89]|1[0-2]|2[7-9]|30)\s*[A-Za-zÄÖÜ]|$)/i,
    );
    if (inDiesem && missing.includes(from) && !result.has(from)) {
      result.set(from, parseChunk(inDiesem[1].trim()));
    }
  }

  return result;
}

export function extractMatchingItems(prompt, from, to) {
  const text = cleanNoise(prompt);
  const result = new Map();

  const markerRe = /(?:^|\n)\s*([1-9][0-9]?)\s*(?=[A-ZÄÖÜa-zäöü])/g;
  const markers = [];
  let m;
  while ((m = markerRe.exec(text)) !== null) {
    let n = Number(m[1]);
    if (n < from && n >= 5 && n <= 9 && from <= 10 + n && 10 + n <= to) {
      n = 10 + n;
    }
    if (n >= from && n <= to && !markers.some((x) => x.n === n)) {
      markers.push({ n, index: m.index + (m[0].startsWith("\n") ? 1 : 0) });
    }
  }
  markers.sort((a, b) => a.index - b.index);

  const adOptions = [];
  const adMatches = text.matchAll(/(?:^|\n)\s*([a-jA-J])\s*[).:\-–]?\s*([^\n]{10,})/g);
  for (const am of adMatches) {
    const label = am[1].toLowerCase();
    if (adOptions.some((o) => o.label === label)) continue;
    adOptions.push({ id: label, label, text: am[2].trim() });
  }
  if (/keine\s*passende|schreibenSie\s*0|\b0\b/i.test(text) && !adOptions.some((o) => o.id === "0")) {
    adOptions.push({ id: "0", label: "0", text: "keine passende Anzeige" });
  }

  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i];
    const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
    let chunk = text.slice(cur.index, end).trim();
    chunk = chunk.replace(/^\d{1,2}\s*/, "").trim();
    const adBreak = chunk.search(/\n(?:Dringend|Anzeige|Eselfohlen|[a-j]\s)/i);
    if (adBreak > 20) chunk = chunk.slice(0, adBreak).trim();
    result.set(cur.n, {
      prompt: chunk,
      options: adOptions.length > 0 ? adOptions : [],
      status: chunk.length > 10 ? (adOptions.length >= 3 ? "structured" : "needs_review") : "needs_review",
    });
  }

  const missing = [];
  for (let n = from; n <= to; n++) if (!result.has(n)) missing.push(n);
  if (missing.length > 0 && markers.length >= 2) {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const unnumbered = [];
    for (const line of lines) {
      if (/^\d{1,2}\s*[A-Za-zÄÖÜäöüß]/.test(line)) continue;
      if (!/^[A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ]{2,}/.test(line)) continue;
      if (/^(LESEN|Teil|Anzeige|Beispiel|Urlaub|Romantisches|Chalet|MOSS|Lust|Kontakt)/i.test(line))
        continue;
      if (line.length < 20) continue;
      if (
        !/\b(und|ist|hat|möchte|mochte|will|suchen|verbringt|reisen|Urlaub)\b/i.test(line) &&
        line.length < 40
      )
        continue;
      const absIndex = text.indexOf(line);
      if (absIndex < 0) continue;
      const first = markers[0].index;
      const last = markers[markers.length - 1].index;
      if (absIndex <= first || absIndex >= last) continue;
      if (markers.some((mk) => Math.abs(mk.index - absIndex) < 3)) continue;
      unnumbered.push({ index: absIndex, text: line });
    }
    unnumbered.sort((a, b) => a.index - b.index);
    for (let ui = 0; ui < unnumbered.length && ui < missing.length; ui++) {
      const n = missing[ui];
      if (result.has(n)) continue;
      result.set(n, {
        prompt: unnumbered[ui].text,
        options: adOptions.length > 0 ? adOptions : [],
        status: "needs_review",
      });
    }
  }

  return result;
}
