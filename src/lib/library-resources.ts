import type { AttachmentDraft } from "@/components/academy/content-attachment-uploader";
import {
  isValidHttpUrl,
  MEDIA_KIND_LABELS,
  type MediaKind,
  validateFileForKind,
  validateTextContentBody,
} from "@/lib/academic-content";
import type { TeacherScope } from "@/lib/academy-logic";

export type LibraryAudienceMode = "everyone" | "level" | "class" | "classes";

export function subtypeOptionsForDomain(
  rows: Array<{ domain: string; code: string; label_fr: string; active: boolean; sort_order: number }>,
  domain: string,
  selected?: string | null,
) {
  const active = rows
    .filter((row) => row.domain === domain && row.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({ code: row.code, label: row.label_fr }));
  if (selected && !active.some((row) => row.code === selected)) {
    const historical = rows.find((row) => row.domain === domain && row.code === selected);
    return [
      ...active,
      {
        code: selected,
        label: historical ? `${historical.label_fr} (désactivé)` : `${selected} (historique)`,
      },
    ];
  }
  return active;
}

export function assertTeacherAudienceScope(input: {
  isTeacher: boolean;
  audience: LibraryAudienceMode;
  classId?: string | null;
  classIds?: string[];
  scope: TeacherScope;
}): string | null {
  if (!input.isTeacher) return null;
  if (input.audience !== "class" && input.audience !== "classes") {
    return "Un enseignant doit cibler un ou plusieurs de ses groupes.";
  }
  const ids =
    input.audience === "classes"
      ? [...new Set((input.classIds ?? []).filter(Boolean))]
      : input.classId
        ? [input.classId]
        : [];
  if (!ids.length) return "Sélectionnez au moins un de vos groupes.";
  const forbidden = ids.filter((id) => !input.scope.classIds.has(id));
  if (forbidden.length) {
    return "Vous ne pouvez pas diffuser hors de vos groupes autorisés.";
  }
  return null;
}

export function validateAttachmentDraft(draft: AttachmentDraft, opts?: { requireFile?: boolean }) {
  const kind = draft.kind as MediaKind;
  if (kind === "link") {
    if (!isValidHttpUrl(draft.url)) return "Saisissez une URL valide (http ou https).";
    return null;
  }
  if (kind === "text") {
    return validateTextContentBody(draft.text);
  }
  if (draft.file) {
    return validateFileForKind(draft.file, kind);
  }
  if (opts?.requireFile !== false) {
    return "Ajoutez un fichier pour ce support.";
  }
  return null;
}

export function validateAttachmentList(
  drafts: AttachmentDraft[],
  opts?: { allowEmptyExisting?: boolean },
) {
  if (!drafts.length) {
    return opts?.allowEmptyExisting ? null : "Ajoutez au moins un support (fichier, lien ou texte).";
  }
  for (let i = 0; i < drafts.length; i += 1) {
    const err = validateAttachmentDraft(drafts[i]!, {
      requireFile: !(opts?.allowEmptyExisting && !drafts[i]!.file && !drafts[i]!.url && !drafts[i]!.text),
    });
    if (err) return `Support ${i + 1} : ${err}`;
  }
  return null;
}

export function attachmentKindSummary(drafts: AttachmentDraft[]) {
  const counts = new Map<string, number>();
  for (const draft of drafts) {
    const label = MEDIA_KIND_LABELS[draft.kind as MediaKind] ?? String(draft.kind);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, n]) => (n > 1 ? `${label} ×${n}` : label)).join(" · ");
}

export function audiencePreviewLabel(input: {
  audience: LibraryAudienceMode;
  levelCode?: string | null;
  classLabels?: string[];
}) {
  if (input.audience === "everyone") return "Tous les étudiants autorisés";
  if (input.audience === "level") return `Niveau ${input.levelCode ?? "—"}`;
  const labels = input.classLabels ?? [];
  if (!labels.length) return "Aucun groupe sélectionné";
  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(0, 3).join(", ")} (+${labels.length - 3})`;
}
