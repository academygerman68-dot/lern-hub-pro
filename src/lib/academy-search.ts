import type { NavigateOptions } from "@/types/academy";

export function parseAcademySearch(search: Record<string, unknown>): NavigateOptions {
  const result: NavigateOptions = {};
  for (const key of [
    "studentId",
    "classId",
    "moduleId",
    "lessonId",
    "assignmentId",
    "recipientId",
  ] as const) {
    const value = search[key];
    if (typeof value === "string" && value.trim() && value.length <= 200)
      result[key] = value.trim();
  }
  return result;
}
