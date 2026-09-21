import { useCallback, useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  acceptForKind,
  COURSE_KIND_LABELS,
  isFileContentKind,
  isTextContentKind,
  MEDIA_KIND_LABELS,
  validateFileForKind,
  type CourseKind,
  type MediaKind,
} from "@/lib/academic-content";
import { cn } from "@/lib/utils";

type Kind = MediaKind | CourseKind;

export type AttachmentDraft = {
  kind: Kind;
  url: string;
  file: File | null;
  /** Inline body when kind === "text" (e.g. expression écrite). */
  text?: string;
};

export function emptyAttachmentDraft(kind: Kind = "pdf"): AttachmentDraft {
  return { kind, url: "", file: null, text: "" };
}

function labelForKind(kind: Kind) {
  if (kind in MEDIA_KIND_LABELS) return MEDIA_KIND_LABELS[kind as MediaKind];
  return COURSE_KIND_LABELS[kind as CourseKind];
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

export function ContentAttachmentUploader({
  kinds,
  value,
  onChange,
  disabled,
  uploading,
  uploadProgress,
  error,
  requiredFileWhenNew = true,
  hasExistingFile = false,
  existingLabel = "Un fichier est déjà enregistré. Déposez-en un autre pour le remplacer.",
  onClearExisting,
  showKindSelect = true,
  accept,
  validateFile,
  textPlaceholder = "Sujet ou consignes (expression écrite, etc.)",
}: {
  kinds: Kind[];
  value: AttachmentDraft;
  onChange: (next: AttachmentDraft) => void;
  disabled?: boolean;
  uploading?: boolean;
  /** 0–100 when known; otherwise indeterminate bar while uploading */
  uploadProgress?: number | null;
  error?: string | null;
  requiredFileWhenNew?: boolean;
  hasExistingFile?: boolean;
  existingLabel?: string;
  onClearExisting?: () => void;
  showKindSelect?: boolean;
  /** Override the file input accept list (e.g. PDF+JPEG+PNG together). */
  accept?: string;
  /** Override kind-based validation. Return an error message or null. */
  validateFile?: (file: File) => string | null;
  textPlaceholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isLink = value.kind === "link";
  const isText = isTextContentKind(value.kind);
  const displayError = error ?? localError;

  const applyFile = useCallback(
    (file: File | null) => {
      setLocalError(null);
      if (!file) {
        onChange({ ...value, file: null });
        return;
      }
      const validation = validateFile
        ? validateFile(file)
        : validateFileForKind(file, value.kind as MediaKind | CourseKind);
      if (validation) {
        setLocalError(validation);
        onChange({ ...value, file: null });
        return;
      }
      onChange({ ...value, file });
    },
    [onChange, validateFile, value],
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (disabled || isLink || isText) return;
    const file = event.dataTransfer.files?.[0] ?? null;
    applyFile(file);
  };

  return (
    <div className="space-y-3">
      {showKindSelect ? (
        <label className="block text-sm">
          Type de contenu
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={value.kind}
            disabled={disabled}
            onChange={(e) => {
              setLocalError(null);
              onChange({
                kind: e.target.value as Kind,
                url: "",
                file: null,
                text: "",
              });
            }}
          >
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {labelForKind(kind)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

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
      ) : isText ? (
        <label className="block text-sm">
          Texte
          <Textarea
            className="mt-1 min-h-32"
            placeholder={textPlaceholder}
            value={value.text ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Aucun fichier requis — saisissez le sujet puis publiez.
          </p>
        </label>
      ) : (
        <div className="space-y-2">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onClick={() => !disabled && inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              if (!disabled) setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition",
              dragOver ? "border-primary bg-soft-blue/40" : "border-border bg-muted/30",
              disabled && "pointer-events-none opacity-60",
            )}
          >
            <FileUp className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Glissez-déposez un fichier ici</p>
            <p className="text-xs text-muted-foreground">ou cliquez pour sélectionner</p>
            <p className="text-xs text-muted-foreground">
              Formats acceptés selon le type · max selon la règle du contenu
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={accept ?? acceptForKind(value.kind)}
              disabled={disabled}
              onChange={(e) => {
                applyFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>

          {value.file ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{value.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(value.file.size)}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || uploading}
                onClick={() => applyFile(null)}
                aria-label="Retirer le fichier"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : null}

          {hasExistingFile && !value.file ? (
            <div className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              <span>{existingLabel}</span>
              {onClearExisting ? (
                <Button type="button" size="sm" variant="outline" onClick={onClearExisting}>
                  Supprimer
                </Button>
              ) : null}
            </div>
          ) : null}

          {requiredFileWhenNew &&
          isFileContentKind(value.kind) &&
          !hasExistingFile &&
          !value.file ? (
            <p className="text-xs text-muted-foreground">Fichier obligatoire.</p>
          ) : null}
        </div>
      )}

      {uploading ? (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Téléversement en cours…</p>
          <Progress value={uploadProgress ?? undefined} className="h-2" />
        </div>
      ) : null}
      {displayError ? <p className="text-sm text-destructive">{displayError}</p> : null}
    </div>
  );
}

/** Alias for shared file management naming in product specs. */
export const FileUploader = ContentAttachmentUploader;
