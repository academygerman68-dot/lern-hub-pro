import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContentAttachmentUploader,
  emptyAttachmentDraft,
  type AttachmentDraft,
} from "./content-attachment-uploader";
import type { MediaKind } from "@/lib/academic-content";

const DEFAULT_KINDS: MediaKind[] = ["text", "pdf", "document", "image", "link", "audio"];

export type MultiAttachmentItem = AttachmentDraft & { localId: string };

export function createMultiAttachmentItem(kind: MediaKind = "pdf"): MultiAttachmentItem {
  return { localId: crypto.randomUUID(), ...emptyAttachmentDraft(kind) };
}

type Props = {
  items: MultiAttachmentItem[];
  onChange: (next: MultiAttachmentItem[]) => void;
  kinds?: MediaKind[];
  disabled?: boolean;
  uploading?: boolean;
  error?: string | null;
};

export function MultiAttachmentComposer({
  items,
  onChange,
  kinds = DEFAULT_KINDS,
  disabled,
  uploading,
  error,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.localId ?? null);

  const move = (index: number, delta: number) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Pièces jointes ({items.length})</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => {
            const created = createMultiAttachmentItem("pdf");
            onChange([...items, created]);
            setActiveId(created.localId);
          }}
        >
          <Plus className="size-4" /> Ajouter
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          Aucune pièce. Ajoutez du texte, des PDF, images, audio ou liens.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const open = activeId === item.localId;
            return (
              <div key={item.localId} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-left text-sm font-medium"
                    onClick={() => setActiveId(open ? null : item.localId)}
                  >
                    #{index + 1} · {item.kind}
                    {item.file ? ` · ${item.file.name}` : item.url ? " · lien" : ""}
                  </button>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={index === 0 || disabled}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={index === items.length - 1 || disabled}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() => {
                        const next = items.filter((row) => row.localId !== item.localId);
                        onChange(next);
                        if (activeId === item.localId) setActiveId(next[0]?.localId ?? null);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {open ? (
                  <div className="mt-3">
                    <ContentAttachmentUploader
                      kinds={kinds}
                      value={item}
                      onChange={(draft) => {
                        onChange(
                          items.map((row) =>
                            row.localId === item.localId ? { ...row, ...draft } : row,
                          ),
                        );
                      }}
                      disabled={Boolean(disabled)}
                      uploading={Boolean(uploading)}
                      {...(error ? { error } : {})}
                      requiredFileWhenNew={false}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
