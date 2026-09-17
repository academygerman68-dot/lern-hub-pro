import { Input } from "@/components/ui/input";
import {
  acceptForKind,
  COURSE_KIND_LABELS,
  MEDIA_KIND_LABELS,
  type CourseKind,
  type MediaKind,
} from "@/lib/academic-content";

type Kind = MediaKind | CourseKind;

export type AttachmentDraft = {
  kind: Kind;
  url: string;
  file: File | null;
};

export function ContentAttachmentUploader({
  kinds,
  value,
  onChange,
  disabled,
  uploading,
  error,
  requiredFileWhenNew = true,
  hasExistingFile = false,
}: {
  kinds: Kind[];
  value: AttachmentDraft;
  onChange: (next: AttachmentDraft) => void;
  disabled?: boolean;
  uploading?: boolean;
  error?: string | null;
  requiredFileWhenNew?: boolean;
  hasExistingFile?: boolean;
}) {
  const isLink = value.kind === "link";
  const labels = kinds.reduce<Record<string, string>>((acc, kind) => {
    acc[kind] =
      kind in MEDIA_KIND_LABELS
        ? MEDIA_KIND_LABELS[kind as MediaKind]
        : COURSE_KIND_LABELS[kind as CourseKind];
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Type de contenu
        <select
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={value.kind}
          disabled={disabled}
          onChange={(e) => onChange({ kind: e.target.value as Kind, url: "", file: null })}
        >
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {labels[kind]}
            </option>
          ))}
        </select>
      </label>
      {isLink ? (
        <label className="block text-sm">
          Lien
          <Input
            className="mt-1"
            placeholder="https://"
            value={value.url}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
          />
        </label>
      ) : (
        <label className="block text-sm">
          Fichier
          <Input
            className="mt-1"
            type="file"
            accept={acceptForKind(value.kind)}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, file: e.target.files?.[0] ?? null })}
          />
          {hasExistingFile && !value.file ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              Un fichier est déjà enregistré. Choisissez-en un autre pour le remplacer.
            </span>
          ) : null}
          {requiredFileWhenNew && !hasExistingFile && !value.file ? (
            <span className="mt-1 block text-xs text-muted-foreground">Fichier obligatoire.</span>
          ) : null}
        </label>
      )}
      {uploading ? <p className="text-sm text-muted-foreground">Téléversement en cours…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
