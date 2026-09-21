import type { Database } from "@/types/database";

export type MediaKind = Database["public"]["Enums"]["media_content_kind"];
export type CourseKind = Database["public"]["Enums"]["course_content_kind"];

export const COURSE_KIND_LABELS: Record<CourseKind, string> = {
  none: "Aucun",
  pdf: "PDF",
  link: "Lien",
  image: "Image",
  audio: "Audio",
  text: "Texte",
};

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  pdf: "PDF",
  document: "Document",
  link: "Lien",
  image: "Image",
  audio: "Audio",
  poster: "Affiche",
  text: "Texte",
};

export const DOMAIN_LABELS = {
  academic: "Académique",
  professional: "Professionnelle",
} as const;

export const AUDIENCE_LABELS = {
  everyone: "Tout le monde",
  level: "Niveau",
  class: "Groupe",
} as const;

export function isTextContentKind(kind: string | null | undefined): boolean {
  return kind === "text";
}

/** File upload expected (not link, not inline text, not none). */
export function isFileContentKind(kind: string | null | undefined): boolean {
  return Boolean(kind && kind !== "link" && kind !== "text" && kind !== "none");
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function acceptForKind(kind: MediaKind | CourseKind) {
  if (kind === "pdf") return ".pdf,application/pdf";
  if (kind === "image" || kind === "poster") return "image/jpeg,image/png,image/webp,image/gif";
  if (kind === "audio") return "audio/mpeg,audio/wav,audio/webm,audio/mp4";
  if (kind === "document")
    return ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return undefined;
}

export function validateFileForKind(file: File, kind: MediaKind | CourseKind) {
  if (kind === "text" || kind === "link" || kind === "none") {
    return "Ce type de contenu n’accepte pas de fichier.";
  }
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const maxBytes = 25 * 1024 * 1024;
  if (file.size > maxBytes) {
    return "Le fichier dépasse 25 Mo.";
  }
  if (kind === "pdf" && !(mime.includes("pdf") || name.endsWith(".pdf"))) {
    return "Choisissez un fichier PDF.";
  }
  if ((kind === "image" || kind === "poster") && !mime.startsWith("image/")) {
    return "Choisissez une image.";
  }
  if (kind === "audio" && !mime.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|webm)$/.test(name)) {
    return "Choisissez un fichier audio.";
  }
  if (
    kind === "document" &&
    !mime.includes("pdf") &&
    !mime.includes("word") &&
    !mime.includes("officedocument") &&
    !/\.(pdf|doc|docx)$/.test(name)
  ) {
    return "Choisissez un document PDF ou Word.";
  }
  return null;
}

export function validateTextContentBody(text: string | null | undefined): string | null {
  if (!text?.trim()) {
    return "Saisissez le texte (ex. sujet d’expression écrite).";
  }
  if (text.trim().length < 3) {
    return "Le texte est trop court.";
  }
  return null;
}

export function formatFrDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function libraryCategoryForKind(
  kind: MediaKind,
): Database["public"]["Enums"]["library_category"] {
  if (kind === "poster") return "announcement";
  if (kind === "pdf") return "pdf";
  if (kind === "audio") return "audio";
  if (kind === "text") return "course_material";
  return "course_material";
}

export function courseKindFromMedia(
  kind: Extract<CourseKind, "pdf" | "link" | "image" | "audio" | "text">,
): CourseKind {
  return kind;
}
