import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

async function forceDownload(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("download_failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename || "document";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
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
  const [downloading, setDownloading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);
  const kind = kindFromMime(mimeType, title);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      setExpanded(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const panel = (
    <div
      className="fixed inset-0 z-[90] flex items-stretch justify-center bg-foreground/55 p-0 sm:p-3"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "flex min-h-0 w-full flex-col overflow-hidden bg-background shadow-xl",
          expanded
            ? "h-full max-w-none rounded-none border-0"
            : "my-auto h-[min(92dvh,56rem)] max-w-5xl rounded-none border-0 sm:rounded-2xl sm:border sm:border-border",
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Document"}
      >
        {/* Always-visible chrome — above the PDF iframe */}
        <div className="relative z-20 flex shrink-0 flex-col gap-2 border-b border-border bg-background px-3 py-2.5 pt-[max(0.65rem,env(safe-area-inset-top,0px))] sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold sm:text-base">{title || "Document"}</p>
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
              {mimeType || kind}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {kind === "pdf" ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2"
                  onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(1))))}
                  aria-label="Zoom arrière"
                >
                  <ZoomOut className="size-3.5" />
                  <span className="hidden sm:inline">−</span>
                </Button>
                <span className="min-w-10 text-center text-xs tabular-nums text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2"
                  onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(1))))}
                  aria-label="Zoom avant"
                >
                  <ZoomIn className="size-3.5" />
                  <span className="hidden sm:inline">+</span>
                </Button>
              </>
            ) : null}
            {url ? (
              <Button type="button" size="sm" variant="outline" className="h-8" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  <span className="hidden xs:inline sm:inline">Onglet</span>
                </a>
              </Button>
            ) : null}
            {url ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={downloading}
                onClick={() => {
                  setDownloading(true);
                  void forceDownload(url, title).finally(() => setDownloading(false));
                }}
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">{downloading ? "…" : "Télécharger"}</span>
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? (
                <>
                  <Minimize2 className="size-3.5" />
                  Réduire
                </>
              ) : (
                <>
                  <Maximize2 className="size-3.5" />
                  Agrandir
                </>
              )}
            </Button>
            <Button type="button" size="sm" variant="default" className="h-8" onClick={onClose}>
              <X className="size-3.5" />
              Fermer
            </Button>
          </div>
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-auto bg-secondary/30 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:p-3">
          {loading && (
            <div className="grid h-full min-h-[40dvh] place-items-center text-sm text-muted-foreground">
              Chargement du document…
            </div>
          )}
          {!loading && error && (
            <div className="grid h-full min-h-[40dvh] place-items-center gap-3 px-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              {url && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <a href={url} target="_blank" rel="noreferrer">
                      Ouvrir dans un nouvel onglet
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => void forceDownload(url, title)}>
                    Télécharger
                  </Button>
                </div>
              )}
            </div>
          )}
          {!loading && !error && url && kind === "pdf" && (
            <iframe
              title={title}
              src={`${url}#toolbar=1`}
              className="mx-auto h-[calc(100%-0.25rem)] min-h-[60dvh] w-full rounded-lg border border-border bg-white"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
            />
          )}
          {!loading && !error && url && kind === "image" && (
            <img src={url} alt={title} className="mx-auto max-h-full max-w-full object-contain" />
          )}
          {!loading && !error && url && kind === "audio" && (
            <div className="grid h-full place-items-center px-4">
              <audio controls src={url} className="w-full max-w-lg" />
            </div>
          )}
          {!loading && !error && url && kind === "video" && (
            <video controls src={url} className="mx-auto max-h-full max-w-full rounded-lg" />
          )}
          {!loading && !error && url && kind === "other" && (
            <div className="grid h-full place-items-center gap-3 px-4 text-center">
              <p className="text-sm text-muted-foreground">
                Aperçu indisponible pour ce type de fichier. Vous pouvez l’ouvrir ou le télécharger.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <a href={url} target="_blank" rel="noreferrer">
                    Consulter
                  </a>
                </Button>
                <Button variant="outline" onClick={() => void forceDownload(url, title)}>
                  Télécharger
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
