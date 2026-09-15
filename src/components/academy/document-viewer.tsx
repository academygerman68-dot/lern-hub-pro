import { useEffect, useState } from "react";
import { Download, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type DocumentViewerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string | null;
  mimeType?: string | null | undefined;
  loading?: boolean | undefined;
  error?: string | null | undefined;
};

function kindFromMime(mime?: string | null, title?: string) {
  const m = (mime ?? "").toLowerCase();
  const t = (title ?? "").toLowerCase();
  if (m.includes("pdf") || t.endsWith(".pdf")) return "pdf" as const;
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/.test(t)) return "image" as const;
  if (m.startsWith("audio/") || /\.(mp3|wav|ogg)$/.test(t)) return "audio" as const;
  if (m.startsWith("video/") || /\.(mp4|webm|mov)$/.test(t)) return "video" as const;
  return "other" as const;
}

export function DocumentViewer({
  open,
  onClose,
  title,
  url,
  mimeType,
  loading,
  error,
}: DocumentViewerProps) {
  const [zoom, setZoom] = useState(1);
  const kind = kindFromMime(mimeType, title);

  useEffect(() => {
    if (!open) setZoom(1);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground/50 p-3 sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{mimeType || kind}</p>
          </div>
          <div className="flex items-center gap-2">
            {kind === "pdf" && (
              <>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="size-4" />
                </Button>
              </>
            )}
            {url && (
              <Button size="sm" variant="outline" asChild>
                <a href={url} download target="_blank" rel="noreferrer">
                  <Download className="size-4" />
                  Download
                </a>
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="relative flex-1 overflow-auto bg-secondary/30 p-3">
          {loading && (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Loading document…
            </div>
          )}
          {!loading && error && (
            <div className="grid h-full place-items-center text-sm text-destructive">{error}</div>
          )}
          {!loading && !error && url && kind === "pdf" && (
            <iframe
              title={title}
              src={`${url}#toolbar=1`}
              className="mx-auto h-full min-h-[70vh] w-full rounded-lg border border-border bg-white"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
            />
          )}
          {!loading && !error && url && kind === "image" && (
            <img src={url} alt={title} className="mx-auto max-h-full max-w-full object-contain" />
          )}
          {!loading && !error && url && kind === "audio" && (
            <div className="grid h-full place-items-center">
              <audio controls src={url} className="w-full max-w-lg" />
            </div>
          )}
          {!loading && !error && url && kind === "video" && (
            <video controls src={url} className="mx-auto max-h-full max-w-full rounded-lg" />
          )}
          {!loading && !error && url && kind === "other" && (
            <div className="grid h-full place-items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                Preview not available for this file type.
              </p>
              <Button asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  Open in new tab
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
