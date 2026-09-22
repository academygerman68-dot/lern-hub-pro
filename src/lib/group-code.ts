/** Human-readable group codes: A1-SEP26-WB-01 (level, period, teacher initials, sequence). */

const MONTH_CODES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

export function periodCodeFromDate(date: Date = new Date()): string {
  const month = MONTH_CODES[date.getMonth()] ?? "JAN";
  const year = String(date.getFullYear()).slice(-2);
  return `${month}${year}`;
}

/** Initials from teacher display name (e.g. "Warda Benali" → "WB"). */
export function teacherInitials(fullName: string | null | undefined): string {
  const parts = (fullName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s-]/g, " ")
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "XX";
  if (parts.length === 1) {
    const word = parts[0]!.toUpperCase();
    return (word.slice(0, 2) || "XX").padEnd(2, "X");
  }
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function buildGroupCodeParts(input: {
  levelCode: string;
  periodCode?: string;
  teacherName?: string | null;
  sequence: number;
}): { level: string; period: string; initials: string; sequence: string; code: string } {
  const level = (input.levelCode || "XX").trim().toUpperCase().replace(/\s+/g, "");
  const period = (input.periodCode ?? periodCodeFromDate()).toUpperCase();
  const initials = teacherInitials(input.teacherName);
  const sequence = String(Math.max(1, Math.floor(input.sequence))).padStart(2, "0");
  return {
    level,
    period,
    initials,
    sequence,
    code: `${level}-${period}-${initials}-${sequence}`,
  };
}

/**
 * Suggest next free code among existing references.
 * On collision of initials (same level+period+initials), increments the sequence.
 * Existing references are never rewritten — only used to pick the next free slot.
 */
export function suggestGroupCode(input: {
  levelCode: string;
  teacherName?: string | null;
  periodCode?: string;
  existingReferences: Array<string | null | undefined>;
  asOf?: Date;
}): string {
  const period = input.periodCode ?? periodCodeFromDate(input.asOf ?? new Date());
  const initials = teacherInitials(input.teacherName);
  const level = (input.levelCode || "XX").trim().toUpperCase().replace(/\s+/g, "");
  const prefix = `${level}-${period}-${initials}-`;
  const used = new Set(
    (input.existingReferences ?? [])
      .map((r) => (r ?? "").trim().toUpperCase())
      .filter(Boolean),
  );

  for (let seq = 1; seq <= 99; seq += 1) {
    const candidate = buildGroupCodeParts({
      levelCode: level,
      periodCode: period,
      teacherName: input.teacherName ?? null,
      sequence: seq,
    }).code;
    if (!used.has(candidate.toUpperCase())) return candidate;
  }

  // Exhausted — append a short suffix based on count of same prefix.
  const count = [...used].filter((r) => r.startsWith(prefix)).length + 1;
  return `${prefix}${String(count).padStart(2, "0")}`;
}

/** Format "CODE · Nom du professeur" when a teacher name is available. */
export function formatGroupCodeWithTeacher(
  reference: string | null | undefined,
  teacherName: string | null | undefined,
): string {
  const code = (reference ?? "").trim();
  const teacher = (teacherName ?? "").trim();
  if (code && teacher) return `${code} · ${teacher}`;
  return code || teacher || "—";
}
