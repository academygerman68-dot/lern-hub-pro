export const ASSIGNMENT_SUBMISSION_BUCKET = "course-materials";

/** Path: submissions/{assignmentId}/{studentId}/{uuid}.{ext} */
export function buildAssignmentSubmissionStoragePath(input: {
  assignmentId: string;
  studentId: string;
  fileName: string;
  objectId?: string;
}): string {
  const ext = input.fileName.includes(".")
    ? (input.fileName.split(".").pop() ?? "bin").toLowerCase()
    : "bin";
  const objectId = input.objectId ?? crypto.randomUUID();
  return `submissions/${input.assignmentId}/${input.studentId}/${objectId}.${ext}`;
}

export function isForeignStudentSubmissionPath(
  path: string,
  ownStudentId: string,
): boolean {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "submissions" || parts.length < 3) return true;
  return parts[2] !== ownStudentId;
}

function readErrorField(error: unknown, key: string): string {
  if (!error || typeof error !== "object") return "";
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

const FRIENDLY_STORAGE =
  "Impossible d'envoyer votre fichier. Vérifiez le format ou réessayez.";
const FRIENDLY_SUBMISSION =
  "Impossible d'enregistrer votre remise. Réessayez ou contactez l'administration.";

export function mapAssignmentSubmissionError(
  error: unknown,
  stage: "storage" | "insert" | "generic" = "generic",
): Error {
  const message = error instanceof Error ? error.message : readErrorField(error, "message");
  if (
    message === FRIENDLY_STORAGE ||
    message === FRIENDLY_SUBMISSION ||
    message.startsWith("Ajoutez une réponse")
  ) {
    return error instanceof Error ? error : new Error(message);
  }

  const details = readErrorField(error, "details");
  const hint = readErrorField(error, "hint");
  const code = readErrorField(error, "code") || readErrorField(error, "statusCode");
  const blob = `${code} ${message} ${details} ${hint}`.toLowerCase();

  if (import.meta.env.DEV && !import.meta.env["VITEST"]) {
    console.error("[assignment-submission]", stage, { code, message, details, hint, error });
  }

  if (
    stage === "storage" ||
    blob.includes("bucket") ||
    blob.includes("mime type") ||
    blob.includes("payload too large") ||
    blob.includes("maximum allowed size") ||
    blob.includes("storage")
  ) {
    return new Error(FRIENDLY_STORAGE);
  }

  if (
    code === "42501" ||
    blob.includes("row-level security") ||
    blob.includes("permission denied") ||
    blob.includes("unauthorized") ||
    code === "403"
  ) {
    return new Error(stage === "insert" ? FRIENDLY_SUBMISSION : FRIENDLY_STORAGE);
  }

  if (stage === "insert") return new Error(FRIENDLY_SUBMISSION);
  return new Error(FRIENDLY_SUBMISSION);
}
