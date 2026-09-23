/**
 * Isolation helpers for B1 modelltests — one exam, its sections/questions/tracks only.
 */

export function extractB1MtNumber(code: string | null | undefined): number | null {
  const m = String(code ?? "").trim().match(/^B1-MT(\d{2})$/i);
  return m ? Number(m[1]) : null;
}

export function expectedB1AudioPathPrefix(examCode: string): string | null {
  const n = extractB1MtNumber(examCode);
  if (n == null) return null;
  const slug = `b1-mt${String(n).padStart(2, "0")}`;
  return `exams/b1/${slug}/hoeren/`;
}

export function assertB1AudioPathMatchesExam(
  examCode: string,
  mediaPath: string | null | undefined,
): boolean {
  const prefix = expectedB1AudioPathPrefix(examCode);
  if (!prefix) return false;
  const path = (mediaPath ?? "").replace(/^\/+/, "");
  return path.startsWith(prefix);
}

export type IsolationIssue = string;

export function validateB1ExamIsolation(input: {
  examId: string;
  examCode: string;
  sections: Array<{
    id: string;
    exam_id?: string | null;
    questions?: Array<{
      id: string;
      section_id?: string | null;
      media_path?: string | null;
      metadata?: Record<string, unknown> | null;
    }>;
  }>;
  tracks?: Array<{
    exam_id: string;
    part_number: number;
    media_path: string;
  }>;
}): IsolationIssue[] {
  const issues: IsolationIssue[] = [];
  const sectionIds = new Set<string>();

  for (const section of input.sections) {
    if (section.exam_id && section.exam_id !== input.examId) {
      issues.push(`Section ${section.id} belongs to another exam`);
    }
    sectionIds.add(section.id);
    for (const q of section.questions ?? []) {
      if (q.section_id && !sectionIds.has(q.section_id) && q.section_id !== section.id) {
        issues.push(`Question ${q.id} section mismatch`);
      }
      if (q.media_path && !assertB1AudioPathMatchesExam(input.examCode, q.media_path)) {
        issues.push(`Question ${q.id} audio path does not match ${input.examCode}`);
      }
    }
  }

  for (const track of input.tracks ?? []) {
    if (track.exam_id !== input.examId) {
      issues.push(`Track Teil ${track.part_number} belongs to another exam`);
    }
    if (!assertB1AudioPathMatchesExam(input.examCode, track.media_path)) {
      issues.push(`Track Teil ${track.part_number} path mismatch for ${input.examCode}`);
    }
  }

  return issues;
}

export function previewStorageKey(examId: string): string {
  return `ga_b1_preview_${examId}`;
}

export function clearB1PreviewState(examId: string) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(previewStorageKey(examId));
  sessionStorage.removeItem("ga_active_exam_id");
  sessionStorage.removeItem("ga_active_attempt_id");
}
