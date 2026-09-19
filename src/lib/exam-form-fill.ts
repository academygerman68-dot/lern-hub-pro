/** Pure helpers for A1 form_fill auto-grading and answer normalization. */

export function normalizeFormFillValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function formFillValuesEqual(student: unknown, expected: unknown): boolean {
  return normalizeFormFillValue(student) === normalizeFormFillValue(expected);
}

export type FormFillField = { key: string; points: number };

export function scoreFormFillAnswer(input: {
  fields: FormFillField[];
  sourceData: Record<string, string>;
  answer: Record<string, unknown> | null | undefined;
}): { awarded: number; max: number; fieldResults: Record<string, boolean> } {
  const fieldResults: Record<string, boolean> = {};
  let awarded = 0;
  let max = 0;
  for (const field of input.fields) {
    max += field.points;
    const ok = formFillValuesEqual(input.answer?.[field.key], input.sourceData[field.key]);
    fieldResults[field.key] = ok;
    if (ok) awarded += field.points;
  }
  return { awarded, max, fieldResults };
}

/** Strip keys that must never reach students mid-attempt. */
export function sanitizeQuestionMetadataForStudent(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object") return null;
  const {
    audio_script: _audioScript,
    sample_answer: _sample,
    source_data: _source,
    correct_answer: _correct,
    explanation: _explanation,
    teacher_payload: _teacher,
    ...safe
  } = metadata;
  return safe;
}
