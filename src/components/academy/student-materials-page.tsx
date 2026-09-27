import { useMemo, useState } from "react";
import { Download, Eye, FileText, Link2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLibrary, useLibrarySubtypes } from "@/hooks/use-academy-data";
import {
  DOMAIN_LABELS,
  LIBRARY_DOMAINS,
  MEDIA_KIND_LABELS,
  formatFrDate,
  type LibraryDomainKey,
} from "@/lib/academic-content";
import { STUDENT_RESTRICTED_MESSAGE } from "@/lib/academy-logic";
import { subtypeOptionsForDomain } from "@/lib/library-resources";
import { LibraryService } from "@/services/academy-services";
import { useAcademy } from "./academy-context";
import { DocumentViewer } from "./document-viewer";
import { LevelBadge, PageHeader, Surface } from "./primitives";
import { QueryState } from "./query-state";

type PreviewState = {
  title: string;
  url: string | null;
  mimeType: string | null;
  loading: boolean;
  error: string | null;
  textBody?: string | null;
};

async function downloadFromUrl(url: string, filename: string) {
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

export function StudentMaterialsPage() {
  const { profile } = useAcademy();
  const libraryQuery = useLibrary();
  const [domainTab, setDomainTab] = useState<LibraryDomainKey>("academic");
  const [subtypeFilter, setSubtypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const subtypesQuery = useLibrarySubtypes(domainTab);
  const restricted = profile?.status === "restricted";

  const subtypeOptions = useMemo(
    () => subtypeOptionsForDomain(subtypesQuery.data ?? [], domainTab),
    [subtypesQuery.data, domainTab],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (libraryQuery.data ?? [])
      .filter((item) => item.domain === domainTab)
      .filter((item) => {
        if (!subtypeFilter) return true;
        return ((item as { subtype?: string | null }).subtype ?? "") === subtypeFilter;
      })
      .filter((item) => {
        if (!q) return true;
        return `${item.title} ${item.description ?? ""}`.toLowerCase().includes(q);
      });
  }, [libraryQuery.data, domainTab, subtypeFilter, search]);

  const openSupport = async (
    titleLabel: string,
    kind: string,
    mime: string | null | undefined,
    loader: () => Promise<string>,
    textBody?: string | null,
  ) => {
    if (kind === "text") {
      setPreview({
        title: titleLabel,
        url: null,
        mimeType: "text/plain",
        loading: false,
        error: null,
        textBody: textBody ?? "",
      });
      return;
    }
    if (kind === "link") {
      try {
        const url = await loader();
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ouverture impossible");
      }
      return;
    }
    setPreview({ title: titleLabel, url: null, mimeType: mime ?? null, loading: true, error: null });
    try {
      const url = await loader();
      setPreview({ title: titleLabel, url, mimeType: mime ?? null, loading: false, error: null });
    } catch (err) {
      setPreview({
        title: titleLabel,
        url: null,
        mimeType: mime ?? null,
        loading: false,
        error: err instanceof Error ? err.message : "Aperçu impossible",
      });
    }
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="Ressources"
        subtitle="Documents et supports publiés pour votre parcours."
      />

      <div className="flex flex-wrap gap-2">
        {LIBRARY_DOMAINS.map((d) => (
          <Button
            key={d}
            size="sm"
            variant={domainTab === d ? "default" : "outline"}
            onClick={() => {
              setDomainTab(d);
              setSubtypeFilter("");
            }}
          >
            {DOMAIN_LABELS[d]}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={subtypeFilter}
          onChange={(e) => setSubtypeFilter(e.target.value)}
        >
          <option value="">Tous les types</option>
          {subtypeOptions.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {restricted && domainTab === "academic" ? (
        <Surface className="p-6">
          <h2 className="font-semibold">Accès restreint</h2>
          <p className="mt-2 text-sm text-muted-foreground">{STUDENT_RESTRICTED_MESSAGE}</p>
        </Surface>
      ) : (
        <QueryState
          isLoading={libraryQuery.isLoading}
          isError={libraryQuery.isError}
          error={libraryQuery.error}
          isEmpty={!filtered.length}
          emptyTitle="Aucune ressource"
          emptyMessage="Aucune ressource publiée pour vous dans cette catégorie."
          onRetry={() => void libraryQuery.refetch()}
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item) => {
              const subtypeCode = (item as { subtype?: string | null }).subtype;
              const kindLabel = MEDIA_KIND_LABELS[item.content_kind] ?? item.content_kind;
              return (
                <li key={item.id}>
                  <Surface className="flex h-full flex-col p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.level_code ? <LevelBadge code={item.level_code} /> : null}
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {kindLabel}
                      </span>
                    </div>
                    <h2 className="mt-3 text-base font-semibold tracking-tight">{item.title}</h2>
                    {item.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {subtypeCode ? `${subtypeCode} · ` : ""}
                      {formatFrDate(item.created_at)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          void openSupport(
                            item.title,
                            item.content_kind,
                            item.mime_type,
                            () => LibraryService.getSignedUrl(item),
                            (item as { text_body?: string | null }).text_body,
                          )
                        }
                      >
                        {item.content_kind === "link" ? (
                          <Link2 className="size-4" />
                        ) : item.content_kind === "text" ? (
                          <FileText className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                        {item.content_kind === "link"
                          ? "Ouvrir"
                          : item.content_kind === "text"
                            ? "Lire"
                            : "Consulter"}
                      </Button>
                      {item.content_kind !== "link" && item.content_kind !== "text" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void (async () => {
                              try {
                                const url = await LibraryService.getSignedUrl(item);
                                await downloadFromUrl(url, item.title);
                              } catch (err) {
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Téléchargement impossible",
                                );
                              }
                            })()
                          }
                        >
                          <Download className="size-4" />
                          Télécharger
                        </Button>
                      ) : null}
                    </div>
                  </Surface>
                </li>
              );
            })}
          </ul>
        </QueryState>
      )}

      <DocumentViewer
        open={Boolean(preview) && preview?.textBody == null}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        url={preview?.url ?? null}
        mimeType={preview?.mimeType}
        loading={preview?.loading}
        error={preview?.error}
      />
      {preview?.textBody != null && preview.textBody !== "" && !preview.url ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Surface className="max-h-[80vh] w-full max-w-lg overflow-y-auto p-5">
            <h2 className="font-semibold">{preview.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm">{preview.textBody}</p>
            <Button className="mt-4" onClick={() => setPreview(null)}>
              Fermer
            </Button>
          </Surface>
        </div>
      ) : null}
    </div>
  );
}
