/**
 * Student / staff exam catalog visibility rules.
 *
 * Completeness (audio Hören, answer keys, etc.) is enforced at publish/start
 * on the server — never by silently dropping rows from the published list.
 * A failed completeness RPC must not turn into an empty catalog.
 */

export type CompletenessProbe = {
  /** true when exam_is_complete returned true */
  complete: boolean;
  /** true when the RPC/network call failed */
  errored: boolean;
};

/**
 * Resolves which published exams appear in the catalog.
 * Always fail-open: RPC errors or missing probes keep the published rows.
 */
export function resolvePublishedExamCatalog<T>(
  publishedExams: T[],
  completenessProbes?: CompletenessProbe[] | null,
): T[] {
  if (!completenessProbes || completenessProbes.length !== publishedExams.length) {
    return publishedExams;
  }
  if (completenessProbes.some((probe) => probe.errored)) {
    return publishedExams;
  }
  // Catalog lists published exams; do not hide incomplete ones here.
  return publishedExams;
}

/** Nav / route pages that must keep Examens blancs for each role. */
export const EXAM_BLANCS_PAGES_BY_ROLE = {
  student: ["exams", "mock-exam", "exam-result"] as const,
  teacher: ["exams"] as const,
  director: ["exams"] as const,
};
