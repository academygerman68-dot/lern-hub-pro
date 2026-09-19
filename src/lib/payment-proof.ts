export const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PAYMENT_PROOF_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const USER_FACING_RE =
  /justificatif|échéance|mois à payer|montant|fichier|opération|téléversement|enregistrement|profil étudiant|formule|devise|RIB/i;

export function paymentProofMimeFromFile(file: Pick<File, "name" | "type">): string | null {
  const type = (file.type || "").toLowerCase().trim();
  if (type === "application/pdf" || type === "image/jpeg" || type === "image/png") return type;
  if (type === "image/jpg" || type === "image/pjpeg") return "image/jpeg";
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  return null;
}

export function validatePaymentProofFile(file: File | null | undefined): string | null {
  if (!file) return "Joignez un justificatif PDF, JPEG ou PNG.";
  if (file.size <= 0) return "Le fichier est vide.";
  if (file.size > PAYMENT_PROOF_MAX_BYTES) return "Fichier trop volumineux (max 10 Mo).";
  if (!paymentProofMimeFromFile(file)) {
    return "Type de fichier non autorisé (PDF, JPEG ou PNG uniquement).";
  }
  return null;
}

export function isValidDeclaredAmount(value: number | string | null | undefined): boolean {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount > 0;
}

export function validatePaymentProofSubmitInput(input: {
  studentId?: string | null;
  paymentId?: string | null;
  file?: File | null;
  declaredAmount?: number | string | null;
  operationDate?: string | null;
}): string | null {
  if (!input.studentId?.trim()) {
    return "Profil étudiant introuvable. Contactez l’administration.";
  }
  if (!input.paymentId?.trim() || !UUID_RE.test(input.paymentId.trim())) {
    return "Sélectionnez un mois à payer.";
  }
  const fileError = validatePaymentProofFile(input.file);
  if (fileError) return fileError;
  if (!isValidDeclaredAmount(input.declaredAmount)) {
    return "Le montant déclaré doit être supérieur à zéro.";
  }
  if (!input.operationDate?.trim()) {
    return "La date de l’opération est obligatoire.";
  }
  return null;
}

export function studentProofDeadlineHint(input: {
  paymentsLoaded: boolean;
  eligibleCount: number;
  paymentId: string;
}): string | null {
  if (!input.paymentsLoaded) return null;
  if (input.eligibleCount === 0) {
    return "Aucun mois à payer n’est disponible. Contactez l’administration.";
  }
  if (!input.paymentId.trim()) {
    return "Sélectionnez un mois à payer.";
  }
  return null;
}

export function resolveOwnStudent<T extends { id: string; email: string; profileId?: string }>(
  students: T[],
  identity: { profileId?: string | null | undefined; email?: string | null | undefined },
): T | undefined {
  const profileId = identity.profileId?.trim();
  if (profileId) {
    const byProfile = students.find((student) => student.profileId === profileId);
    if (byProfile) return byProfile;
  }
  const email = identity.email?.trim().toLowerCase();
  if (!email) return undefined;
  return students.find((student) => student.email.toLowerCase() === email);
}

function readErrorField(error: unknown, key: string): string {
  if (!error || typeof error !== "object") return "";
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function isPaymentProofUserFacingMessage(message: string): boolean {
  return USER_FACING_RE.test(message);
}

export function toPaymentProofUserError(
  error: unknown,
  stage: "storage" | "insert" | "generic" = "generic",
): Error {
  const message = error instanceof Error ? error.message : readErrorField(error, "message");
  if (message && isPaymentProofUserFacingMessage(message)) {
    return error instanceof Error ? error : new Error(message);
  }

  const details = readErrorField(error, "details");
  const hint = readErrorField(error, "hint");
  const code = readErrorField(error, "code") || readErrorField(error, "statusCode");
  const blob = `${code} ${message} ${details} ${hint}`.toLowerCase();

  if (
    stage === "storage" ||
    blob.includes("bucket") ||
    blob.includes("mime type") ||
    blob.includes("payload too large") ||
    blob.includes("maximum allowed size") ||
    blob.includes("object not found")
  ) {
    if (blob.includes("mime")) {
      return new Error(
        "Le téléversement a échoué : type de fichier refusé par le stockage (PDF, JPEG ou PNG).",
      );
    }
    if (
      blob.includes("row-level security") ||
      blob.includes("unauthorized") ||
      blob.includes("permission denied") ||
      code === "403" ||
      code === "42501"
    ) {
      return new Error(
        "Le téléversement du justificatif a échoué (droits de stockage insuffisants). Contactez l’administration.",
      );
    }
    const extra = message.trim();
    return new Error(
      extra
        ? `Le téléversement du justificatif a échoué : ${extra}`
        : "Le téléversement du justificatif a échoué. Réessayez, ou contactez l’administration.",
    );
  }

  if (code === "23505" || blob.includes("duplicate") || blob.includes("payment_proofs_one_open")) {
    return new Error(
      "Un justificatif est déjà en cours de validation ou déjà approuvé pour ce mois.",
    );
  }
  if (code === "23503" || blob.includes("foreign key")) {
    return new Error("Le mois sélectionné est introuvable. Actualisez la page et réessayez.");
  }
  if (
    code === "42501" ||
    blob.includes("row-level security") ||
    blob.includes("permission denied") ||
    blob.includes("unauthorized")
  ) {
    return new Error(
      "L’enregistrement du justificatif a été refusé. Vérifiez le mois à payer, ou contactez l’administration.",
    );
  }

  const readable = [message, details, hint].filter(Boolean).join(" — ");
  if (stage === "insert") {
    return new Error(
      readable
        ? `L’enregistrement du justificatif a échoué : ${readable}`
        : "L’enregistrement du justificatif a échoué. Contactez l’administration.",
    );
  }
  return new Error(readable || "L’envoi du justificatif a échoué.");
}
