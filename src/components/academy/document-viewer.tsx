import { useEffect, useState } from "react";
import { Download, ExternalLink, X, ZoomIn, ZoomOut } from "lucide-react";
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
  const kind = kindFromMime(mimeType, title);

  useEffect(() => {
    if (!open) setZoom(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground/50 p-0 sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-none border-0 bg-background shadow-xl sm:rounded-2xl sm:border sm:border-border">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:gap-3 sm:px-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{mimeType || kind}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {kind === "pdf" && (
              <>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
                  aria-label="Réduire"
                >
                  <ZoomOut className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
                  aria-label="Agrandir"
                >
                  <ZoomIn className="size-4" />
                </Button>
              </>
            )}
            {url && (
              <Button size="sm" variant="outline" asChild className="hidden sm:inline-flex">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Nouvel onglet
                </a>
              </Button>
            )}
            {url && (
              <Button
                size="sm"
                variant="outline"
                disabled={downloading}
                className="hidden sm:inline-flex"
                onClick={() => {
                  setDownloading(true);
                  void forceDownload(url, title).finally(() => setDownloading(false));
                }}
              >
                <Download className="size-4" />
                Télécharger
              </Button>
            )}
            {url && (
              <Button
                size="icon"
                variant="outline"
                className="sm:hidden"
                disabled={downloading}
                aria-label="Télécharger"
                onClick={() => {
                  setDownloading(true);
                  void forceDownload(url, title).finally(() => setDownloading(false));
                }}
              >
                <Download className="size-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fermer">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="relative flex-1 overflow-auto bg-secondary/30 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:p-3">
          {loading && (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Chargement du document…
            </div>
          )}
          {!loading && error && (
            <div className="grid h-full place-items-center gap-3 px-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              {url && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <a href={url} target="_blank" rel="noreferrer">
                      Ouvrir dans un nouvel onglet
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void forceDownload(url, title)}
                  >
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
              className="mx-auto h-full min-h-[70dvh] w-full rounded-lg border border-border bg-white sm:min-h-[70vh]"
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
}
