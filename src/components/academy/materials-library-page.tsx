import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useArchiveLibraryItem,
  useClasses,
  useLevels,
  useLibrary,
  useLibrarySubtypes,
  useSetLibrarySubtypeActive,
  useUpdateLibraryItem,
  useUploadLibraryItem,
  useUpsertLibrarySubtype,
} from "@/hooks/use-academy-data";
import {
  AUDIENCE_LABELS,
  DOMAIN_LABELS,
  LIBRARY_DOMAINS,
  formatFrDate,
  libraryCategoryForKind,
  MEDIA_KIND_LABELS,
  type LibraryDomainKey,
  type MediaKind,
} from "@/lib/academic-content";
import {
  buildTeacherScope,
  isDirectorRole,
  scopedLibraryItemVisible,
  STUDENT_RESTRICTED_MESSAGE,
} from "@/lib/academy-logic";
import {
  assertTeacherAudienceScope,
  attachmentKindSummary,
  audiencePreviewLabel,
  subtypeOptionsForDomain,
  validateAttachmentList,
  type LibraryAudienceMode,
} from "@/lib/library-resources";
import { LibraryService } from "@/services/academy-services";
import type { LibraryAttachmentInput } from "@/services/supabase/library-service";
import { emptyAttachmentDraft, type AttachmentDraft } from "./content-attachment-uploader";
import { DocumentViewer } from "./document-viewer";
import { useAcademy } from "./academy-context";
import {
  createMultiAttachmentItem,
  MultiAttachmentComposer,
  type MultiAttachmentItem,
} from "./multi-attachment-composer";
import { MultiClassPicker } from "./multi-class-picker";
import { PageHeader, Surface, LevelBadge, GroupBadge } from "./primitives";
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

function draftsToInputs(items: MultiAttachmentItem[]): LibraryAttachmentInput[] {
  return items.map((item) => ({
    contentKind: item.kind as MediaKind,
    file: item.file,
    externalUrl: item.kind === "link" ? item.url : null,
    textBody: item.kind === "text" ? item.text ?? null : null,
  }));
}

export function MaterialsLibraryPage() {
  const { role, user, profile } = useAcademy();
  const isTeacher = role === "teacher";
  const isStudent = role === "student";
  const isAdmin = isDirectorRole(role);

  const libraryQuery = useLibrary();
  const upload = useUploadLibraryItem();
  const updateItem = useUpdateLibraryItem();
  const archiveItem = useArchiveLibraryItem();
  const levelsQuery = useLevels();
  const classesQuery = useClasses();
  const adminSubtypesQuery = useLibrarySubtypes(undefined, true);
  const upsertSubtype = useUpsertLibrarySubtype();
  const setSubtypeActive = useSetLibrarySubtypeActive();

  const [domainTab, setDomainTab] = useState<LibraryDomainKey>("academic");
  const [subtypeFilter, setSubtypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState<LibraryDomainKey>("academic");
  const subtypesQuery = useLibrarySubtypes(domain);
  const [subtype, setSubtype] = useState("");
  const [audience, setAudience] = useState<LibraryAudienceMode>(isTeacher ? "classes" : "everyone");
  const [levelCode, setLevelCode] = useState("");
  const [classId, setClassId] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<MultiAttachmentItem[]>([
    createMultiAttachmentItem("document"),
  ]);
  const [existingAttachmentMeta, setExistingAttachmentMeta] = useState<
    Array<{ id: string; storage_bucket: string | null; storage_path: string | null; mime_type: string | null; file_size: number | null; external_url: string | null; text_body: string | null }>
  >([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [classTargetsByItem, setClassTargetsByItem] = useState<Record<string, string[]>>({});
  const [subtypeDraft, setSubtypeDraft] = useState({
    domain: "academic" as LibraryDomainKey,
    code: "",
    labelFr: "",
    sortOrder: "10",
  });
  const [subtypeConfigOpen, setSubtypeConfigOpen] = useState(false);

  const saving = upload.isPending || updateItem.isPending;
  const restricted = profile?.status === "restricted";
  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );

  const teacherClasses = useMemo(() => {
    const all = classesQuery.data ?? [];
    if (isAdmin) return all;
    return all.filter((c) => teacherScope.classIds.has(c.id));
  }, [classesQuery.data, isAdmin, teacherScope.classIds]);

  const classesForPicker = teacherClasses.filter((item) => !levelCode || item.level === levelCode);

  const subtypeOptions = useMemo(
    () =>
      subtypeOptionsForDomain(
        (subtypesQuery.data ?? []).concat(
          (adminSubtypesQuery.data ?? []).filter((row) => row.domain === domain && !row.active),
        ),
        domain,
        subtype,
      ),
    [subtypesQuery.data, adminSubtypesQuery.data, domain, subtype],
  );

  const tabSubtypeOptions = useMemo(
    () =>
      subtypeOptionsForDomain(
        (adminSubtypesQuery.data ?? []).length
          ? adminSubtypesQuery.data!
          : (subtypesQuery.data ?? []),
        domainTab,
      ),
    [adminSubtypesQuery.data, subtypesQuery.data, domainTab],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (libraryQuery.data ?? [])
      .filter((item) => item.domain === domainTab)
      .filter((item) => {
        if (isStudent || isAdmin) return true;
        const classIds = classTargetsByItem[item.id];
        return scopedLibraryItemVisible(
          { ...item, classIds: classIds ?? (item.class_id ? [item.class_id] : []) },
          teacherScope,
        );
      })
      .filter((item) => {
        if (!subtypeFilter) return true;
        return ((item as { subtype?: string | null }).subtype ?? "") === subtypeFilter;
      })
      .filter((item) => {
        if (!q) return true;
        return `${item.title} ${item.description ?? ""}`.toLowerCase().includes(q);
      });
  }, [
    libraryQuery.data,
    domainTab,
    isStudent,
    isAdmin,
    classTargetsByItem,
    teacherScope,
    subtypeFilter,
    search,
  ]);

  useEffect(() => {
    const items = libraryQuery.data ?? [];
    const missing = items.filter(
      (item) =>
        (item.audience === "classes" || item.audience === "class") && !classTargetsByItem[item.id],
    );
    if (!missing.length) return;
    let cancelled = false;
    void Promise.all(
      missing.map(async (item) => {
        try {
          const ids = await LibraryService.listClassTargets(item.id);
          return [item.id, ids.length ? ids : item.class_id ? [item.class_id] : []] as const;
        } catch {
          return [item.id, item.class_id ? [item.class_id] : []] as const;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      setClassTargetsByItem((prev) => {
        const next = { ...prev };
        for (const [id, ids] of rows) next[id] = ids;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [libraryQuery.data, classTargetsByItem]);

  const resetForm = () => {
    setEditingId(null);
    setStep(1);
    setTitle("");
    setDescription("");
    setDomain("academic");
    setSubtype("");
    setAudience(isTeacher ? "classes" : "everyone");
    setLevelCode("");
    setClassId("");
    setClassIds([]);
    setAttachments([createMultiAttachmentItem("document")]);
    setExistingAttachmentMeta([]);
    setFormError(null);
    setFormOpen(false);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
    setStep(1);
    if (isTeacher) {
      setAudience("classes");
      const first = teacherClasses[0];
      if (first) {
        setLevelCode(first.level);
        setClassIds([first.id]);
        setClassId(first.id);
      }
    }
  };

  const openEdit = async (item: NonNullable<typeof libraryQuery.data>[number]) => {
    setFormOpen(true);
    setStep(1);
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setDomain(item.domain as LibraryDomainKey);
    const rawAudience = String(item.audience);
    setAudience(
      rawAudience === "classes" ||
        rawAudience === "class" ||
        rawAudience === "level" ||
        rawAudience === "everyone"
        ? (rawAudience as LibraryAudienceMode)
        : "everyone",
    );
    setLevelCode(item.level_code ?? "");
    setClassId(item.class_id ?? "");
    setSubtype((item as { subtype?: string | null }).subtype ?? "");
    setFormError(null);
    setDomainTab(item.domain as LibraryDomainKey);
    try {
      const [ids, atts] = await Promise.all([
        LibraryService.listClassTargets(item.id),
        LibraryService.listAttachments(item.id),
      ]);
      setClassIds(ids.length ? ids : item.class_id ? [item.class_id] : []);
      if (atts.length) {
        setExistingAttachmentMeta(
          atts.map((a) => ({
            id: a.id,
            storage_bucket: a.storage_bucket,
            storage_path: a.storage_path,
            mime_type: a.mime_type,
            file_size: a.file_size,
            external_url: a.external_url,
            text_body: a.text_body,
          })),
        );
        setAttachments(
          atts.map((a) => ({
            localId: a.id,
            kind: a.content_kind,
            url: a.external_url ?? "",
            file: null,
            text: a.text_body ?? "",
          })),
        );
      } else {
        setExistingAttachmentMeta([]);
        setAttachments([
          {
            localId: crypto.randomUUID(),
            kind: (item.content_kind as MediaKind) || "document",
            url: item.external_url ?? "",
            file: null,
            text: "",
          },
        ]);
      }
    } catch {
      setClassIds(item.class_id ? [item.class_id] : []);
    }
  };

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

  const classLabel = (id: string) => {
    const c = (classesQuery.data ?? []).find((row) => row.id === id);
    return c ? c.reference || c.name : "Groupe";
  };

  const canGoNext = () => {
    if (step === 1) return Boolean(domain && subtype);
    if (step === 2) {
      return (
        title.trim().length > 0 &&
        !validateAttachmentList(attachments as AttachmentDraft[], {
          allowEmptyExisting: Boolean(editingId),
        })
      );
    }
    if (step === 3) {
      return !assertTeacherAudienceScope({
        isTeacher,
        audience,
        classId,
        classIds,
        scope: teacherScope,
      });
    }
    return true;
  };

  const submit = (asDraft: boolean) => {
    setFormError(null);
    const effectiveAudience = isTeacher ? "classes" : audience;
    const scopeError = assertTeacherAudienceScope({
      isTeacher,
      audience: effectiveAudience,
      classId,
      classIds,
      scope: teacherScope,
    });
    if (scopeError) {
      setFormError(scopeError);
      return;
    }
    if (!title.trim()) {
      setFormError("Le titre est obligatoire.");
      return;
    }
    if (!subtype) {
      setFormError("Le sous-type est obligatoire.");
      return;
    }
    const attachmentError = validateAttachmentList(attachments as AttachmentDraft[], {
      allowEmptyExisting: Boolean(editingId),
    });
    if (attachmentError) {
      setFormError(attachmentError);
      return;
    }
    if (effectiveAudience === "level" && !levelCode) {
      setFormError("Choisissez un niveau.");
      return;
    }
    if (effectiveAudience === "class" && !classId) {
      setFormError("Choisissez un groupe.");
      return;
    }
    if (effectiveAudience === "classes" && classIds.length === 0) {
      setFormError("Sélectionnez au moins un groupe.");
      return;
    }

    const targetClassIds =
      effectiveAudience === "classes"
        ? classIds
        : effectiveAudience === "class" && classId
          ? [classId]
          : [];
    const primaryKind = (attachments[0]?.kind as MediaKind) || "document";
    const visibility = asDraft ? ("staff" as const) : ("academy" as const);

    const attachmentInputs: LibraryAttachmentInput[] = attachments.map((item, index) => {
      const existing = existingAttachmentMeta[index];
      const hasNewFile = Boolean(item.file);
      const hasLink = item.kind === "link" && item.url.trim();
      const hasText = item.kind === "text" && (item.text ?? "").trim();
      return {
        contentKind: item.kind as MediaKind,
        file: item.file,
        externalUrl: item.kind === "link" ? item.url : null,
        textBody: item.kind === "text" ? item.text ?? null : null,
        existing:
          !hasNewFile && existing && (existing.storage_path || existing.external_url || existing.text_body)
            ? {
                id: existing.id,
                library_item_id: editingId ?? "",
                sort_order: index,
                content_kind: item.kind as MediaKind,
                storage_bucket: existing.storage_bucket,
                storage_path: existing.storage_path,
                mime_type: existing.mime_type,
                file_size: existing.file_size,
                external_url: hasLink ? item.url : existing.external_url,
                text_body: hasText ? item.text ?? null : existing.text_body,
                label: null,
              }
            : null,
      };
    });

    if (editingId) {
      updateItem.mutate(
        {
          id: editingId,
          patch: {
            title: title.trim(),
            description: description.trim() || null,
            domain,
            audience: effectiveAudience,
            levelCode: effectiveAudience === "everyone" ? null : levelCode || null,
            classId:
              effectiveAudience === "class"
                ? classId || null
                : effectiveAudience === "classes"
                  ? targetClassIds[0] ?? null
                  : null,
            classIds: targetClassIds,
            subtype,
            contentKind: primaryKind,
            visibility,
            attachments: attachmentInputs,
            externalUrl: primaryKind === "link" ? attachments[0]?.url.trim() || null : null,
          },
        },
        {
          onSuccess: () => {
            toast.success(asDraft ? "Brouillon enregistré" : "Ressource mise à jour");
            resetForm();
          },
          onError: (err) => {
            setFormError(err.message);
            toast.error(err.message);
          },
        },
      );
      return;
    }

    upload.mutate(
      {
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        domain,
        audience: effectiveAudience,
        category: libraryCategoryForKind(primaryKind),
        contentKind: primaryKind,
        levelCode: effectiveAudience === "everyone" ? null : levelCode || null,
        classId:
          effectiveAudience === "class"
            ? classId || null
            : effectiveAudience === "classes"
              ? targetClassIds[0] ?? null
              : null,
        classIds: targetClassIds,
        subtype,
        visibility,
        attachments: draftsToInputs(attachments),
        createdBy: user?.id ?? null,
      },
      {
        onSuccess: () => {
          toast.success(asDraft ? "Brouillon enregistré" : "Ressource publiée");
          setDomainTab(domain);
          resetForm();
        },
        onError: (err) => {
          setFormError(err.message);
          toast.error(err.message);
        },
      },
    );
  };

  const adminSubtypeRows = useMemo(() => {
    return (adminSubtypesQuery.data ?? []).slice().sort((a, b) => {
      if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
      return a.sort_order - b.sort_order;
    });
  }, [adminSubtypesQuery.data]);

  const recipientPreview = audiencePreviewLabel({
    audience: isTeacher ? "classes" : audience,
    levelCode,
    classLabels:
      (isTeacher ? "classes" : audience) === "classes"
        ? classIds.map(classLabel)
        : (isTeacher ? "classes" : audience) === "class" && classId
          ? [classLabel(classId)]
          : [],
  });

  return (
    <>
      <PageHeader
        title="Ressources"
        subtitle={
          isStudent
            ? "Bibliothèque de consultation — ressources publiées pour vous."
            : isTeacher
              ? "Même outils que l’administration, périmètre limité à vos groupes."
              : "Bibliothèque académique, administrative et annonces — diffusion ciblée."
        }
        action={
          !isStudent ? (
            <Button onClick={openCreate}>Ajouter une ressource</Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
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

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={subtypeFilter}
          onChange={(e) => setSubtypeFilter(e.target.value)}
        >
          <option value="">Tous les sous-types</option>
          {tabSubtypeOptions.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
        {isAdmin ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSubtypeConfigOpen((v) => !v)}
          >
            {subtypeConfigOpen ? "Fermer la config" : "Configurer les sous-types"}
          </Button>
        ) : null}
      </div>

      {isAdmin && subtypeConfigOpen ? (
        <Surface className="mb-5 space-y-3 p-5">
          <h2 className="text-sm font-semibold">Sous-types (configuration)</h2>
          <p className="text-xs text-muted-foreground">
            Source de vérité catalogue — créer, renommer, ordonner, désactiver. Les ressources
            historiques restent lisibles.
          </p>
          <div className="grid gap-2 sm:grid-cols-4">
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={subtypeDraft.domain}
              onChange={(e) =>
                setSubtypeDraft((prev) => ({
                  ...prev,
                  domain: e.target.value as LibraryDomainKey,
                }))
              }
            >
              {LIBRARY_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_LABELS[d]}
                </option>
              ))}
            </select>
            <Input
              placeholder="Code (ex. visa)"
              value={subtypeDraft.code}
              onChange={(e) => setSubtypeDraft((prev) => ({ ...prev, code: e.target.value }))}
            />
            <Input
              placeholder="Libellé FR"
              value={subtypeDraft.labelFr}
              onChange={(e) => setSubtypeDraft((prev) => ({ ...prev, labelFr: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Ordre"
              value={subtypeDraft.sortOrder}
              onChange={(e) => setSubtypeDraft((prev) => ({ ...prev, sortOrder: e.target.value }))}
            />
          </div>
          <Button
            size="sm"
            disabled={upsertSubtype.isPending}
            onClick={() => {
              void upsertSubtype
                .mutateAsync({
                  domain: subtypeDraft.domain,
                  code: subtypeDraft.code,
                  labelFr: subtypeDraft.labelFr,
                  sortOrder: Number(subtypeDraft.sortOrder) || 0,
                  active: true,
                })
                .then(() => {
                  toast.success("Sous-type enregistré");
                  setSubtypeDraft((prev) => ({ ...prev, code: "", labelFr: "" }));
                })
                .catch((err) =>
                  toast.error(err instanceof Error ? err.message : "Enregistrement impossible"),
                );
            }}
          >
            Ajouter / mettre à jour
          </Button>
          <div className="space-y-2">
            {adminSubtypeRows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{row.label_fr}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {DOMAIN_LABELS[row.domain as LibraryDomainKey] ?? row.domain} · {row.code} ·
                    ordre {row.sort_order}
                    {!row.active ? " · désactivé" : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSubtypeDraft({
                        domain: row.domain as LibraryDomainKey,
                        code: row.code,
                        labelFr: row.label_fr,
                        sortOrder: String(row.sort_order),
                      })
                    }
                  >
                    Éditer
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={setSubtypeActive.isPending}
                    onClick={() => {
                      void setSubtypeActive
                        .mutateAsync({ id: row.id, active: !row.active })
                        .then(() =>
                          toast.success(row.active ? "Sous-type désactivé" : "Sous-type réactivé"),
                        )
                        .catch((err) =>
                          toast.error(err instanceof Error ? err.message : "Action impossible"),
                        );
                    }}
                  >
                    {row.active ? "Désactiver" : "Réactiver"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      ) : null}

      {restricted && domainTab === "academic" ? (
        <Surface className="mb-5 p-6">
          <h2 className="font-semibold">Accès restreint</h2>
          <p className="mt-2 text-sm text-muted-foreground">{STUDENT_RESTRICTED_MESSAGE}</p>
        </Surface>
      ) : null}

      {!isStudent && formOpen ? (
        <Surface className="mb-5 space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {editingId ? "Modifier la ressource" : "Ajouter une ressource"} · Étape {step}/4
            </h2>
            <Button size="sm" variant="outline" onClick={resetForm}>
              Fermer
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {["Classification", "Contenu", "Destinataires", "Publication"].map((label, i) => (
              <span
                key={label}
                className={
                  step === i + 1
                    ? "rounded-md bg-primary px-2 py-1 text-primary-foreground"
                    : "rounded-md bg-muted px-2 py-1 text-muted-foreground"
                }
              >
                {i + 1}. {label}
              </span>
            ))}
          </div>

          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Catégorie principale *
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={domain}
                  onChange={(e) => {
                    setDomain(e.target.value as LibraryDomainKey);
                    setSubtype("");
                  }}
                >
                  {LIBRARY_DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {DOMAIN_LABELS[d]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Sous-type *
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={subtype}
                  onChange={(e) => setSubtype(e.target.value)}
                >
                  <option value="">Choisir…</option>
                  {subtypeOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <Input
                placeholder="Titre *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Description / instructions (facultatif)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <MultiAttachmentComposer
                items={attachments}
                onChange={setAttachments}
                disabled={saving}
                uploading={saving}
                error={formError}
                kinds={["text", "pdf", "document", "image", "poster", "audio", "link"]}
              />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <label className="block text-sm">
                Destinataires
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={audience}
                  disabled={isTeacher}
                  onChange={(e) => {
                    const next = e.target.value as LibraryAudienceMode;
                    setAudience(next);
                    setClassId("");
                    if (next !== "classes") setClassIds([]);
                  }}
                >
                  {!isTeacher ? (
                    <option value="everyone">Tous les étudiants autorisés</option>
                  ) : null}
                  {!isTeacher ? <option value="level">Niveau(x) précis</option> : null}
                  <option value="class">Un groupe précis</option>
                  <option value="classes">Plusieurs groupes précis</option>
                </select>
              </label>
              {(audience === "level" || audience === "class" || audience === "classes") && (
                <label className="block text-sm">
                  Niveau
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={levelCode}
                    onChange={(e) => {
                      setLevelCode(e.target.value);
                      setClassId("");
                      setClassIds([]);
                    }}
                  >
                    <option value="">
                      {audience === "level" ? "Choisir le niveau" : "Filtrer les groupes (facultatif)"}
                    </option>
                    {(levelsQuery.data ?? [])
                      .filter((level) => isAdmin || teacherScope.levelCodes.has(level.code))
                      .map((level) => (
                        <option key={level.id} value={level.code}>
                          {level.code} · {level.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {audience === "class" ? (
                <label className="block text-sm">
                  Groupe
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                  >
                    <option value="">Choisir le groupe</option>
                    {classesForPicker.map((item) => (
                      <option key={item.id} value={item.id}>
                        {(item.reference || item.name) + (item.level ? ` · ${item.level}` : "")}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {(audience === "classes" || isTeacher) && audience !== "class" ? (
                <MultiClassPicker
                  classes={classesForPicker.map((c) => ({
                    id: c.id,
                    name: c.name,
                    level: c.level,
                    reference: c.reference,
                  }))}
                  selectedIds={classIds}
                  onChange={setClassIds}
                  disabled={saving}
                />
              ) : null}
              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                Aperçu destinataires : <strong>{recipientPreview}</strong>
              </p>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Titre · </span>
                {title || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Catégorie · </span>
                {DOMAIN_LABELS[domain]} · {subtype || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Supports · </span>
                {attachmentKindSummary(attachments as AttachmentDraft[]) || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Destinataires · </span>
                {recipientPreview}
              </p>
            </div>
          ) : null}

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="outline"
              disabled={step === 1 || saving}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Retour
            </Button>
            <div className="flex flex-wrap gap-2">
              {step < 4 ? (
                <Button
                  disabled={!canGoNext() || saving}
                  onClick={() => {
                    setFormError(null);
                    if (step === 1 && !subtype) {
                      setFormError("Choisissez un sous-type.");
                      return;
                    }
                    if (step === 2) {
                      if (!title.trim()) {
                        setFormError("Le titre est obligatoire.");
                        return;
                      }
                      const err = validateAttachmentList(attachments as AttachmentDraft[], {
                        allowEmptyExisting: Boolean(editingId),
                      });
                      if (err) {
                        setFormError(err);
                        return;
                      }
                    }
                    if (step === 3) {
                      const err = assertTeacherAudienceScope({
                        isTeacher,
                        audience: isTeacher ? "classes" : audience,
                        classId,
                        classIds,
                        scope: teacherScope,
                      });
                      if (err) {
                        setFormError(err);
                        return;
                      }
                    }
                    setStep((s) => Math.min(4, s + 1));
                  }}
                >
                  Continuer
                </Button>
              ) : (
                <>
                  <Button variant="outline" disabled={saving} onClick={() => submit(true)}>
                    Enregistrer en brouillon
                  </Button>
                  <Button disabled={saving} onClick={() => submit(false)}>
                    {editingId ? "Enregistrer" : "Publier"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Surface>
      ) : null}

      {!(restricted && domainTab === "academic") ? (
        <QueryState
          isLoading={libraryQuery.isLoading}
          isError={libraryQuery.isError}
          error={libraryQuery.error}
          isEmpty={!filtered.length}
          emptyTitle="Aucune ressource"
          emptyMessage={
            isStudent
              ? "Aucune ressource publiée pour vous dans cette catégorie."
              : "Ajoutez une ressource ou changez de filtre."
          }
          onRetry={() => void libraryQuery.refetch()}
        >
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Ressource</th>
                  <th>Sous-type</th>
                  <th>Supports</th>
                  <th>Destinataires</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const subtypeCode = (item as { subtype?: string | null }).subtype;
                  const targets = classTargetsByItem[item.id] ?? [];
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          {item.level_code ? <LevelBadge code={item.level_code} /> : null}
                          {targets.slice(0, 2).map((id) => (
                            <GroupBadge key={id} label={classLabel(id)} />
                          ))}
                        </div>
                        <p className="mt-1 font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {DOMAIN_LABELS[item.domain as LibraryDomainKey] ?? item.domain}
                          {item.visibility === "staff" || item.visibility === "private"
                            ? " · Brouillon"
                            : ""}
                        </p>
                      </td>
                      <td className="text-sm">{subtypeCode || "—"}</td>
                      <td className="text-sm">
                        {MEDIA_KIND_LABELS[item.content_kind] ?? item.content_kind}
                      </td>
                      <td className="text-sm">
                        {AUDIENCE_LABELS[item.audience as keyof typeof AUDIENCE_LABELS] ??
                          item.audience}
                      </td>
                      <td className="text-sm whitespace-nowrap">
                        {formatFrDate(item.created_at)}
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void openSupport(
                                item.title,
                                item.content_kind,
                                item.mime_type,
                                () => LibraryService.getSignedUrl(item),
                              )
                            }
                          >
                            Consulter
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
                              Télécharger
                            </Button>
                          ) : null}
                          {!isStudent ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" aria-label="Actions">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => void openEdit(item)}>
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  disabled={archiveItem.isPending}
                                  onClick={() => {
                                    if (!window.confirm(`Archiver « ${item.title} » ?`)) return;
                                    archiveItem.mutate(item.id, {
                                      onSuccess: () => toast.success("Ressource archivée"),
                                      onError: (err) => toast.error(err.message),
                                    });
                                  }}
                                >
                                  Archiver
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </QueryState>
      ) : null}

      <DocumentViewer
        open={Boolean(preview)}
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
    </>
  );
}
