import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
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
  useAcademicAccess,
  useArchiveAssignment,
  useArchiveLibraryItem,
  useAssignmentRows,
  useClasses,
  useCourses,
  useCreateAssignment,
  useCreateCourse,
  useDeleteCourse,
  useGroupProgress,
  useLevels,
  useLibrary,
  useStudents,
  useUpdateAssignment,
  useUpdateCourse,
  useUpdateLibraryItem,
  useUploadLibraryItem,
} from "@/hooks/use-academy-data";
import { groupProgressSummary } from "@/lib/group-progress";
import { resolveOwnStudent } from "@/lib/payment-proof";
import {
  AUDIENCE_LABELS,
  COURSE_KIND_LABELS,
  DOMAIN_LABELS,
  formatFrDate,
  isFileContentKind,
  isTextContentKind,
  isValidHttpUrl,
  libraryCategoryForKind,
  MEDIA_KIND_LABELS,
  validateFileForKind,
  validateTextContentBody,
  type CourseKind,
  type MediaKind,
} from "@/lib/academic-content";
import { PRESET_SCORE_SCALES, parseCustomMaxScore } from "@/lib/assignment-score-scale";
import {
  buildTeacherScope,
  hideArchivedStatus,
  isDirectorRole,
  scopedClassOrLevelItemVisible,
  scopedLibraryItemVisible,
  STUDENT_RESTRICTED_MESSAGE,
} from "@/lib/academy-logic";
import { AssignmentService, CourseService, LibraryService } from "@/services/academy-services";
import type { Database } from "@/types/database";
import { ContentAttachmentUploader, type AttachmentDraft } from "./content-attachment-uploader";
import {
  createMultiAttachmentItem,
  MultiAttachmentComposer,
  type MultiAttachmentItem,
} from "./multi-attachment-composer";
import { DocumentViewer } from "./document-viewer";
import { useAcademy } from "./academy-context";
import { MultiClassPicker } from "./multi-class-picker";
import { GroupProgressPage } from "./group-progress-page";
import { PageHeader, Status, Surface, LevelBadge, GroupBadge, FormSection } from "./primitives";
import { QueryState } from "./query-state";
import { AssignmentGrading } from "./workflow-pages";

type PreviewState = {
  title: string;
  url: string | null;
  mimeType: string | null;
  loading: boolean;
  error: string | null;
};

function usePreview() {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const openLinkOrFile = async (
    title: string,
    kind: string,
    mimeType: string | null,
    loader: () => Promise<string>,
  ) => {
    if (kind === "link") {
      try {
        const url = await loader();
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ouverture impossible");
      }
      return;
    }
    setPreview({ title, url: null, mimeType, loading: true, error: null });
    try {
      const url = await loader();
      setPreview({ title, url, mimeType, loading: false, error: null });
    } catch (err) {
      setPreview({
        title,
        url: null,
        mimeType,
        loading: false,
        error: err instanceof Error ? err.message : "Ouverture impossible",
      });
    }
  };
  return { preview, setPreview, openLinkOrFile };
}

async function downloadFromUrl(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Téléchargement impossible");
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

async function persistAssignmentAttachments(
  assignmentId: string,
  input: {
    kind: MediaKind;
    attachment: AttachmentDraft;
    attachmentBucket: string | null;
    attachmentPath: string | null;
    mimeType: string | null;
    textBody: string;
    extraAttachments: MultiAttachmentItem[];
  },
) {
  const items: Parameters<typeof AssignmentService.replaceAttachments>[1] = [];

  if (isTextContentKind(input.kind) && input.textBody.trim()) {
    items.push({
      contentKind: "text",
      contentText: input.textBody.trim(),
      title: "Consigne texte",
    });
  } else if (input.kind === "link" && input.attachment.url.trim()) {
    items.push({
      contentKind: "link",
      contentUrl: input.attachment.url.trim(),
      title: "Lien",
    });
  } else if (input.attachmentPath || input.attachment.url) {
    items.push({
      contentKind: input.kind,
      contentUrl: input.kind === "link" ? input.attachment.url.trim() || null : null,
      storageBucket: input.attachmentBucket,
      storagePath: input.attachmentPath,
      mimeType: input.mimeType,
      fileSize: input.attachment.file?.size ?? null,
      title: input.attachment.file?.name ?? null,
    });
  }

  for (const extra of input.extraAttachments) {
    const kind = extra.kind as MediaKind;
    if (isTextContentKind(kind) && (extra.text ?? "").trim()) {
      items.push({ contentKind: "text", contentText: (extra.text ?? "").trim() });
      continue;
    }
    if (kind === "link" && extra.url.trim()) {
      items.push({ contentKind: "link", contentUrl: extra.url.trim() });
      continue;
    }
    if (extra.file && isFileContentKind(kind)) {
      const uploaded = await AssignmentService.uploadAttachment(extra.file);
      items.push({
        contentKind: kind,
        storageBucket: uploaded.attachmentBucket,
        storagePath: uploaded.attachmentPath,
        mimeType: uploaded.mimeType,
        fileSize: extra.file.size,
        title: extra.file.name,
      });
    }
  }

  await AssignmentService.replaceAttachments(assignmentId, items);
}

function statusLabel(status: string) {
  if (status === "published" || status === "Open") return "Publié";
  if (status === "draft") return "Brouillon";
  if (status === "archived") return "Archivé";
  if (status === "closed") return "Clôturé";
  return status;
}

export function DirectorCoursesPage() {
  const { role } = useAcademy();
  const classesQuery = useClasses();
  const coursesQuery = useCourses();
  const levelsQuery = useLevels();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();
  const { preview, setPreview, openLinkOrFile } = usePreview();
  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );
  const [view, setView] = useState<"catalog" | "group-progress">("catalog");
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<AttachmentDraft>({
    kind: "pdf",
    url: "",
    file: null,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [existingFile, setExistingFile] = useState(false);

  const levels = useMemo(() => {
    const all = levelsQuery.data ?? [];
    if (isDirectorRole(role)) return all;
    return all.filter((level) => teacherScope.levelIds.has(level.id));
  }, [levelsQuery.data, role, teacherScope]);
  const selectedLevel = levels.find((level) => level.id === selectedLevelId) ?? null;
  const courses = useMemo(() => {
    return hideArchivedStatus(coursesQuery.data ?? []).filter(
      (course) =>
        (!selectedLevelId || course.level_id === selectedLevelId) &&
        (isDirectorRole(role) || teacherScope.levelIds.has(course.level_id)),
    );
  }, [coursesQuery.data, selectedLevelId, role, teacherScope]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setAttachment({ kind: "pdf", url: "", file: null });
    setExistingFile(false);
    setFormError(null);
  };

  const openCreate = () => {
    if (!selectedLevelId) return;
    resetForm();
    setOpen(true);
  };

  const openEdit = (course: NonNullable<typeof coursesQuery.data>[number]) => {
    setEditingId(course.id);
    setTitle(course.title);
    setDescription(course.description ?? "");
    setAttachment({
      kind: (course.content_kind === "none" ? "text" : course.content_kind) as CourseKind,
      url: course.content_url ?? "",
      file: null,
      text: course.content_kind === "text" ? (course.description ?? "") : "",
    });
    setExistingFile(Boolean(course.storage_path) && course.content_kind !== "text");
    setOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={view === "catalog" ? "default" : "outline"}
          onClick={() => setView("catalog")}
        >
          Catalogue (niveau)
        </Button>
        <Button
          size="sm"
          variant={view === "group-progress" ? "default" : "outline"}
          onClick={() => setView("group-progress")}
        >
          Progression des groupes
        </Button>
      </div>
      {view === "group-progress" ? <GroupProgressPage /> : null}
      {view === "catalog" ? (
        <>
      <PageHeader
        title="Cours"
        subtitle={
          selectedLevel
            ? `Niveau ${selectedLevel.code} — ${selectedLevel.name}`
            : isDirectorRole(role)
              ? "Choisissez un niveau pour consulter et créer des cours."
              : "Consultez et créez des cours pour les niveaux de vos groupes."
        }
        action={
          selectedLevel ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedLevelId(null)}>
                Tous les niveaux
              </Button>
              <Button onClick={openCreate}>+ Créer un cours</Button>
            </div>
          ) : undefined
        }
      />

      {!selectedLevelId ? (
        <QueryState
          isLoading={levelsQuery.isLoading}
          isError={levelsQuery.isError}
          error={levelsQuery.error}
          isEmpty={!levels.length}
          emptyTitle="Aucun niveau"
          emptyMessage="Les niveaux de l’académie apparaîtront ici."
          onRetry={() => void levelsQuery.refetch()}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {levels.map((level) => {
              const count = hideArchivedStatus(coursesQuery.data ?? []).filter(
                (course) =>
                  course.level_id === level.id &&
                  (isDirectorRole(role) || teacherScope.levelIds.has(course.level_id)),
              ).length;
              return (
                <button
                  key={level.id}
                  type="button"
                  className="rounded-xl border border-border bg-card p-5 text-left shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-card motion-reduce:transform-none"
                  onClick={() => setSelectedLevelId(level.id)}
                >
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Niveau
                  </p>
                  <div className="mt-3">
                    <LevelBadge code={level.code} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{level.name}</p>
                  <p className="mt-3 text-sm font-medium">{count} cours</p>
                </button>
              );
            })}
          </div>
        </QueryState>
      ) : (
        <QueryState
          isLoading={coursesQuery.isLoading}
          isError={coursesQuery.isError}
          error={coursesQuery.error}
          isEmpty={!courses.length}
          emptyTitle="Aucun cours"
          emptyMessage="Créez le premier cours de ce niveau."
          onRetry={() => void coursesQuery.refetch()}
        >
          <div className="space-y-3">
            {courses.map((course) => (
              <Surface className="p-5" key={course.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <LevelBadge code={course.level?.code ?? selectedLevel?.code} />
                      <span className="text-xs text-muted-foreground">
                        {COURSE_KIND_LABELS[course.content_kind]}
                      </span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold tracking-tight">{course.title}</h2>
                    {course.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatFrDate(course.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Status tone={course.status === "published" ? "green" : "amber"}>
                      {statusLabel(course.status)}
                    </Status>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (isTextContentKind(course.content_kind)) {
                          toast.message(course.description?.trim() || "Aucun texte enregistré.");
                          return;
                        }
                        void openLinkOrFile(
                          course.title,
                          course.content_kind,
                          course.mime_type,
                          () => CourseService.getCourseMaterialUrl(course),
                        );
                      }}
                    >
                      {isTextContentKind(course.content_kind) ? "Voir le texte" : "Ouvrir"}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" aria-label="Actions du cours">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(course)}>
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={deleteCourse.isPending}
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (!window.confirm(`Supprimer le cours « ${course.title} » ?`)) return;
                            deleteCourse.mutate(course.id, {
                              onSuccess: () => toast.success("Cours supprimé"),
                              onError: (err) => toast.error(err.message),
                            });
                          }}
                        >
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        </QueryState>
      )}

      {open && selectedLevelId && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel max-h-[90dvh] space-y-4 overflow-y-auto">
            <h2 className="text-lg font-semibold">
              {editingId ? "Modifier le cours" : `Nouveau cours · ${selectedLevel?.code}`}
            </h2>
            <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              placeholder="Description (facultative)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <ContentAttachmentUploader
              kinds={["text", "pdf", "link", "image", "audio"]}
              value={attachment}
              onChange={setAttachment}
              disabled={saving}
              uploading={saving}
              error={formError}
              hasExistingFile={existingFile && isFileContentKind(attachment.kind)}
              requiredFileWhenNew={!isTextContentKind(attachment.kind)}
              textPlaceholder="Contenu textuel du cours (ex. sujet d’expression écrite)…"
              onClearExisting={() => {
                setExistingFile(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                Annuler
              </Button>
              <Button
                disabled={
                  !title.trim() || saving || createCourse.isPending || updateCourse.isPending
                }
                onClick={() => {
                  void (async () => {
                    setFormError(null);
                    const kind = attachment.kind as CourseKind;
                    if (isTextContentKind(kind)) {
                      const textError = validateTextContentBody(attachment.text || description);
                      if (textError) {
                        setFormError(textError);
                        return;
                      }
                    }
                    if (kind === "link" && !isValidHttpUrl(attachment.url)) {
                      setFormError("Saisissez une URL valide (http ou https).");
                      return;
                    }
                    if (isFileContentKind(kind) && attachment.file) {
                      const fileError = validateFileForKind(attachment.file, kind);
                      if (fileError) {
                        setFormError(fileError);
                        return;
                      }
                    }
                    if (isFileContentKind(kind) && !attachment.file && !existingFile) {
                      if (!editingId) {
                        setFormError("Ajoutez un fichier.");
                        return;
                      }
                    }
                    setSaving(true);
                    try {
                      let storageBucket: string | null = null;
                      let storagePath: string | null = null;
                      let mimeType: string | null = null;
                      const url: string | null = kind === "link" ? attachment.url.trim() : null;
                      if (attachment.file && isFileContentKind(kind)) {
                        const uploaded = await CourseService.uploadCourseMaterial(
                          attachment.file,
                          `courses/${selectedLevelId}`,
                        );
                        storageBucket = uploaded.storageBucket;
                        storagePath = uploaded.storagePath;
                        mimeType = uploaded.mimeType;
                      }
                      const textBody = (attachment.text || description).trim();
                      const resolvedDescription = isTextContentKind(kind)
                        ? textBody
                        : description.trim() || null;
                      if (editingId) {
                        const patch: Database["public"]["Tables"]["courses"]["Update"] = {
                          title: title.trim(),
                          level_id: selectedLevelId,
                          description: resolvedDescription,
                          content_kind: kind,
                          content_url: url,
                          status: "published",
                        };
                        if (isTextContentKind(kind)) {
                          patch.storage_bucket = null;
                          patch.storage_path = null;
                          patch.mime_type = "text/plain";
                        } else if (storagePath) {
                          patch.storage_bucket = storageBucket;
                          patch.storage_path = storagePath;
                          patch.mime_type = mimeType;
                        } else if (!existingFile && !attachment.file && kind !== "link") {
                          patch.storage_bucket = null;
                          patch.storage_path = null;
                          patch.mime_type = null;
                        }
                        await updateCourse.mutateAsync({ id: editingId, patch });
                        toast.success("Cours mis à jour");
                      } else {
                        await createCourse.mutateAsync({
                          title: title.trim(),
                          levelId: selectedLevelId,
                          ...(resolvedDescription ? { description: resolvedDescription } : {}),
                          contentKind: kind,
                          contentUrl: url,
                          storageBucket: isTextContentKind(kind) ? null : storageBucket,
                          storagePath: isTextContentKind(kind) ? null : storagePath,
                          mimeType: isTextContentKind(kind) ? "text/plain" : mimeType,
                          status: "published",
                        });
                        toast.success("Cours créé");
                      }
                      setOpen(false);
                      resetForm();
                    } catch (err) {
                      setFormError(
                        err instanceof Error ? err.message : "Enregistrement impossible",
                      );
                    } finally {
                      setSaving(false);
                    }
                  })();
                }}
              >
                Enregistrer
              </Button>
            </div>
          </Surface>
        </div>
      )}
      <DocumentViewer
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        url={preview?.url ?? null}
        mimeType={preview?.mimeType}
        loading={preview?.loading}
        error={preview?.error}
      />
        </>
      ) : null}
    </>
  );
}

export function MaterialsLibraryPage() {
  const { role, user, profile } = useAcademy();
  const libraryQuery = useLibrary();
  const upload = useUploadLibraryItem();
  const updateItem = useUpdateLibraryItem();
  const archiveItem = useArchiveLibraryItem();
  const levelsQuery = useLevels();
  const classesQuery = useClasses();
  const { preview, setPreview, openLinkOrFile } = usePreview();
  const [domainTab, setDomainTab] = useState<"academic" | "professional">("academic");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clearFile, setClearFile] = useState(false);
  const [existingFile, setExistingFile] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState<"academic" | "professional">("academic");
  const isTeacher = role === "teacher";
  const [audience, setAudience] = useState<"everyone" | "level" | "class" | "classes">(
    isTeacher ? "classes" : "everyone",
  );
  const [levelCode, setLevelCode] = useState("");
  const [classId, setClassId] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [subtype, setSubtype] = useState("");
  const [attachment, setAttachment] = useState<AttachmentDraft>({
    kind: "document",
    url: "",
    file: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const saving = upload.isPending || updateItem.isPending;

  const restricted = profile?.status === "restricted";
  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );
  const scopedClasses = classesQuery.data ?? [];
  const filtered = useMemo(() => {
    return (libraryQuery.data ?? [])
      .filter((item) => item.domain === domainTab)
      .filter((item) => {
        if (role === "student" || isDirectorRole(role)) return true;
        return scopedLibraryItemVisible(item, teacherScope);
      });
  }, [libraryQuery.data, domainTab, role, teacherScope]);
  const classesForLevel = scopedClasses.filter((item) => !levelCode || item.level === levelCode);
  const subtypeOptions = useMemo(() => {
    if (domain === "professional") {
      return [
        { code: "visa", label: "Visa" },
        { code: "demarches", label: "Démarches administratives" },
        { code: "documents", label: "Documents requis" },
        { code: "rendez_vous", label: "Rendez-vous" },
        { code: "logement", label: "Logement" },
        { code: "autre", label: "Autres" },
      ];
    }
    return [
      { code: "cours", label: "Cours" },
      { code: "exercices", label: "Exercices" },
      { code: "annonce", label: "Annonces" },
    ];
  }, [domain]);

  const resetForm = () => {
    setEditingId(null);
    setClearFile(false);
    setExistingFile(false);
    setTitle("");
    setDescription("");
    setAttachment({ kind: "document", url: "", file: null });
    setClassIds([]);
    setSubtype("");
    setFormError(null);
    if (!isTeacher) setAudience("everyone");
  };

  const openEdit = (item: NonNullable<typeof libraryQuery.data>[number]) => {
    setEditingId(item.id);
    setClearFile(false);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setDomain(item.domain);
    const rawAudience = String(item.audience);
    const nextAudience =
      rawAudience === "classes" ||
      rawAudience === "class" ||
      rawAudience === "level" ||
      rawAudience === "everyone"
        ? (rawAudience as typeof audience)
        : "everyone";
    setAudience(nextAudience);
    setLevelCode(item.level_code ?? "");
    setClassId(item.class_id ?? "");
    setSubtype((item as { subtype?: string | null }).subtype ?? "");
    setAttachment({
      kind: (item.content_kind as MediaKind) || "document",
      url: item.external_url ?? "",
      file: null,
    });
    setExistingFile(Boolean(item.storage_path || item.external_url));
    setFormError(null);
    setDomainTab(item.domain);
    void LibraryService.listClassTargets(item.id)
      .then((ids) => setClassIds(ids.length ? ids : item.class_id ? [item.class_id] : []))
      .catch(() => setClassIds(item.class_id ? [item.class_id] : []));
  };

  useEffect(() => {
    if (!isTeacher || editingId) return;
    setAudience("classes");
    if (classIds.length) return;
    const first = classesQuery.data?.[0];
    if (first) {
      setLevelCode(first.level);
      setClassIds([first.id]);
      setClassId(first.id);
    }
  }, [isTeacher, classIds.length, classesQuery.data, editingId]);

  return (
    <>
      <PageHeader
        title="Ressources"
        subtitle={
          isTeacher
            ? "Ajoutez des ressources et partagez-les uniquement avec vos groupes."
            : "Ressources académiques et professionnelles, ciblées par audience."
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["academic", "professional"] as const).map((d) => (
          <Button
            key={d}
            size="sm"
            variant={domainTab === d ? "default" : "outline"}
            onClick={() => setDomainTab(d)}
          >
            {DOMAIN_LABELS[d]}
          </Button>
        ))}
      </div>

      {restricted && domainTab === "academic" ? (
        <Surface className="mb-5 p-6">
          <h2 className="font-semibold">Accès restreint</h2>
          <p className="mt-2 text-sm text-muted-foreground">{STUDENT_RESTRICTED_MESSAGE}</p>
        </Surface>
      ) : null}

      {role !== "student" && (
        <Surface className="mb-5 space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {editingId ? "Modifier la ressource" : "Ajouter une ressource"}
            </h2>
            {editingId ? (
              <Button size="sm" variant="outline" onClick={resetForm}>
                Annuler la modification
              </Button>
            ) : null}
          </div>
          <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="Description (facultative)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Catégorie
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={domain}
                onChange={(e) => setDomain(e.target.value as typeof domain)}
              >
                <option value="academic">Académique</option>
                <option value="professional">Professionnelle</option>
              </select>
            </label>
            <label className="block text-sm">
              Partager avec
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={audience}
                onChange={(e) => {
                  const next = e.target.value as typeof audience;
                  setAudience(next);
                  setClassId("");
                  if (next !== "classes") setClassIds([]);
                }}
                disabled={isTeacher}
              >
                {!isTeacher ? (
                  <option value="everyone">Tous les étudiants autorisés</option>
                ) : null}
                {!isTeacher ? <option value="level">Un niveau</option> : null}
                <option value="class">Un groupe précis</option>
                <option value="classes">Groupes précis (multi)</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Sous-type
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
            >
              <option value="">Sans sous-type</option>
              {subtypeOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
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
                  {audience === "level" ? "Choisir le niveau" : "Niveau (filtre facultatif)"}
                </option>
                {(levelsQuery.data ?? [])
                  .filter(
                    (level) => isDirectorRole(role) || teacherScope.levelCodes.has(level.code),
                  )
                  .map((level) => (
                    <option key={level.id} value={level.code}>
                      {level.code} · {level.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {audience === "class" && (
            <label className="block text-sm">
              Groupe
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">Choisir le groupe</option>
                {classesForLevel.map((item) => (
                  <option key={item.id} value={item.id}>
                    {(item.reference || item.name) + (item.level ? ` · ${item.level}` : "")}
                  </option>
                ))}
              </select>
            </label>
          )}
          {audience === "classes" && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Groupes précis</p>
              <MultiClassPicker
                classes={classesForLevel.map((c) => ({
                  id: c.id,
                  name: c.name,
                  level: c.level,
                  reference: c.reference,
                }))}
                selectedIds={classIds}
                onChange={setClassIds}
                disabled={saving}
              />
            </div>
          )}
          <ContentAttachmentUploader
            kinds={["poster", "document", "link", "image"]}
            value={attachment}
            onChange={(next) => {
              setClearFile(false);
              setAttachment(next);
            }}
            disabled={saving}
            uploading={saving}
            error={formError}
            requiredFileWhenNew={!editingId}
            hasExistingFile={existingFile && !clearFile}
            onClearExisting={() => {
              setClearFile(true);
              setExistingFile(false);
              setAttachment({ ...attachment, file: null, url: "" });
            }}
          />
          <Button
            disabled={
              !title.trim() ||
              saving ||
              (audience === "level" && !levelCode) ||
              (audience === "class" && !classId) ||
              (audience === "classes" && classIds.length === 0)
            }
            onClick={() => {
              setFormError(null);
              const effectiveAudience = isTeacher ? "classes" : audience;
              if (
                isTeacher &&
                (effectiveAudience !== "classes" || classIds.length === 0) &&
                !classId
              ) {
                setFormError("Choisissez au moins un de vos groupes pour partager cette ressource.");
                return;
              }
              if (effectiveAudience === "classes" && classIds.length === 0) {
                setFormError("Sélectionnez au moins un groupe.");
                return;
              }
              const kind = attachment.kind as MediaKind;
              if (kind === "link" && !isValidHttpUrl(attachment.url)) {
                setFormError("Saisissez une URL valide (http ou https).");
                return;
              }
              if (kind !== "link" && !editingId) {
                if (!attachment.file) {
                  setFormError("Ajoutez un fichier.");
                  return;
                }
              }
              if (attachment.file) {
                const fileError = validateFileForKind(attachment.file, kind);
                if (fileError) {
                  setFormError(fileError);
                  return;
                }
              }
              const targetClassIds =
                effectiveAudience === "classes"
                  ? classIds
                  : effectiveAudience === "class" && classId
                    ? [classId]
                    : [];
              if (editingId) {
                updateItem.mutate(
                  {
                    id: editingId,
                    ...(attachment.file && kind !== "link" ? { file: attachment.file } : {}),
                    clearFile: clearFile && kind !== "link",
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
                      subtype: subtype || null,
                      contentKind: kind,
                      externalUrl: kind === "link" ? attachment.url.trim() : null,
                      ...(clearFile && kind !== "link" ? { clearFile: true } : {}),
                    },
                  },
                  {
                    onSuccess: () => {
                      toast.success("Ressource mise à jour");
                      resetForm();
                    },
                    onError: (err) => toast.error(err.message),
                  },
                );
                return;
              }
              upload.mutate(
                {
                  ...(kind !== "link" && attachment.file ? { file: attachment.file } : {}),
                  title: title.trim(),
                  ...(description.trim() ? { description: description.trim() } : {}),
                  domain,
                  audience: effectiveAudience,
                  category: libraryCategoryForKind(kind),
                  contentKind: kind,
                  levelCode: effectiveAudience === "everyone" ? null : levelCode || null,
                  classId:
                    effectiveAudience === "class"
                      ? classId || null
                      : effectiveAudience === "classes"
                        ? targetClassIds[0] ?? null
                        : null,
                  classIds: targetClassIds,
                  subtype: subtype || null,
                  externalUrl: kind === "link" ? attachment.url.trim() : null,
                  createdBy: user?.id ?? null,
                },
                {
                  onSuccess: () => {
                    toast.success("Ressource publiée");
                    resetForm();
                    setDomainTab(domain);
                  },
                  onError: (err) => toast.error(err.message),
                },
              );
            }}
          >
            {editingId ? "Enregistrer" : "Publier"}
          </Button>
        </Surface>
      )}

      {!(restricted && domainTab === "academic") && (
        <QueryState
          isLoading={libraryQuery.isLoading}
          isError={libraryQuery.isError}
          error={libraryQuery.error}
          isEmpty={!filtered.length}
          emptyTitle="Aucune ressource"
          emptyMessage="Aucune ressource n’est disponible dans cette catégorie."
          onRetry={() => void libraryQuery.refetch()}
        >
          <div className="space-y-3">
            {filtered.map((item) => (
              <Surface
                className="flex flex-wrap items-center justify-between gap-3 p-4"
                key={item.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.level_code ? <LevelBadge code={item.level_code} /> : null}
                    {item.audience === "class" || item.class_id ? (
                      <GroupBadge
                        label={
                          (classesQuery.data ?? []).find((c) => c.id === item.class_id)?.name ??
                          "Groupe"
                        }
                      />
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {DOMAIN_LABELS[item.domain]} · {MEDIA_KIND_LABELS[item.content_kind]}
                    </span>
                  </div>
                  <h2 className="mt-1.5 font-semibold tracking-tight">{item.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {AUDIENCE_LABELS[item.audience as keyof typeof AUDIENCE_LABELS] ??
                      item.audience}
                    {` · ${formatFrDate(item.created_at)}`}
                  </p>
                  {item.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void openLinkOrFile(item.title, item.content_kind, item.mime_type, () =>
                        LibraryService.getSignedUrl(item),
                      )
                    }
                  >
                    {item.content_kind === "link" ? "Ouvrir" : "Consulter"}
                  </Button>
                  {item.content_kind !== "link" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void (async () => {
                          try {
                            const url = await LibraryService.getSignedUrl(item);
                            await downloadFromUrl(url, item.title);
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Téléchargement impossible",
                            );
                          }
                        })()
                      }
                    >
                      Télécharger
                    </Button>
                  )}
                  {role !== "student" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" aria-label="Actions ressource">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(item)}>Modifier</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={archiveItem.isPending}
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (!window.confirm(`Supprimer la ressource « ${item.title} » ?`))
                              return;
                            archiveItem.mutate(item.id, {
                              onSuccess: () => toast.success("Ressource archivée"),
                              onError: (err) => toast.error(err.message),
                            });
                          }}
                        >
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </Surface>
            ))}
          </div>
        </QueryState>
      )}
      <DocumentViewer
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        url={preview?.url ?? null}
        mimeType={preview?.mimeType}
        loading={preview?.loading}
        error={preview?.error}
      />
    </>
  );
}

export function StudentLearningPage() {
  const { user, profile } = useAcademy();
  const coursesQuery = useCourses();
  const accessQuery = useAcademicAccess();
  const studentsQuery = useStudents();
  const { preview, setPreview, openLinkOrFile } = usePreview();
  const myStudent = resolveOwnStudent(studentsQuery.data ?? [], {
    profileId: profile?.id ?? user?.id ?? null,
    email: user?.email ?? null,
  });
  const classId = myStudent?.classId ?? null;
  const levelCode = myStudent?.level ?? null;
  const progressQuery = useGroupProgress(classId ?? undefined, levelCode);
  const summary = useMemo(
    () => groupProgressSummary(progressQuery.data ?? []),
    [progressQuery.data],
  );

  if (accessQuery.data === false) {
    return (
      <>
        <PageHeader title="Cours" subtitle="Les cours de votre niveau." />
        <Surface className="space-y-3 p-6">
          <h2 className="font-semibold">Accès académique indisponible</h2>
          <p className="text-sm text-muted-foreground">
            Votre mois d’essai est terminé ou votre paiement n’est plus à jour. Régularisez dans
            Paiements pour rouvrir les cours.
          </p>
        </Surface>
      </>
    );
  }

  const courses = (coursesQuery.data ?? []).filter((course) => {
    if (course.status !== "published") return false;
    if (levelCode && course.level?.code && course.level.code !== levelCode) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Cours"
        subtitle={
          classId
            ? `Niveau ${levelCode || "—"} · progression groupe ${summary.completed}/${summary.total} (${summary.percent} %)`
            : "Uniquement les cours de votre niveau."
        }
      />
      {classId ? (
        <Surface className="mb-5 space-y-2 p-4">
          <p className="text-sm font-medium">Progression de votre groupe</p>
          <p className="text-xs text-muted-foreground">
            Distincte du niveau catalogue. Les chapitres verrouillés restent fermés jusqu’au
            déblocage par l’équipe pédagogique.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {(progressQuery.data ?? []).map((row) => (
              <Status
                key={row.unitId}
                tone={
                  row.status === "completed" ? "green" : row.status === "unlocked" ? "blue" : "gray"
                }
              >
                {row.title}
                {row.status === "locked" ? " (verrouillé)" : ""}
              </Status>
            ))}
            {!progressQuery.isLoading && !(progressQuery.data ?? []).length ? (
              <p className="text-sm text-muted-foreground">
                Aucun chapitre de parcours pour ce niveau pour l’instant.
              </p>
            ) : null}
          </div>
        </Surface>
      ) : null}
      <QueryState
        isLoading={coursesQuery.isLoading}
        isError={coursesQuery.isError}
        error={coursesQuery.error}
        isEmpty={!courses.length}
        emptyTitle="Aucun cours"
        emptyMessage="Les cours de votre niveau apparaîtront ici une fois publiés."
        onRetry={() => void coursesQuery.refetch()}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <Surface key={course.id} className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                {course.level?.code ?? "—"} · {COURSE_KIND_LABELS[course.content_kind]}
              </p>
              <h2 className="mt-2 text-lg font-semibold">{course.title}</h2>
              {course.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
              ) : null}
              <p className="mt-1 text-sm text-muted-foreground">
                {formatFrDate(course.created_at)}
              </p>
              {course.content_kind === "text" ? null : (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() =>
                    void openLinkOrFile(course.title, course.content_kind, course.mime_type, () =>
                      CourseService.getCourseMaterialUrl(course),
                    )
                  }
                >
                  {course.content_kind === "link" ? "Ouvrir le lien" : "Ouvrir"}
                </Button>
              )}
            </Surface>
          ))}
        </div>
      </QueryState>
      <DocumentViewer
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        url={preview?.url ?? null}
        mimeType={preview?.mimeType}
        loading={preview?.loading}
        error={preview?.error}
      />
    </>
  );
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DirectorAssignmentsPage() {
  const { user, role } = useAcademy();
  const search = useSearch({ from: "/app/$role/$page" });
  const classesQuery = useClasses();
  const levelsQuery = useLevels();
  const listQuery = useAssignmentRows();
  const create = useCreateAssignment();
  const update = useUpdateAssignment();
  const archive = useArchiveAssignment();
  const { preview, setPreview, openLinkOrFile } = usePreview();
  const isTeacher = role === "teacher";
  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [gradingId, setGradingId] = useState<string | null>(search.assignmentId ?? null);

  useEffect(() => {
    if (search.assignmentId) setGradingId(search.assignmentId);
  }, [search.assignmentId]);

  const [clearAttachment, setClearAttachment] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [levelId, setLevelId] = useState("");
  const [classId, setClassId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [maxScorePreset, setMaxScorePreset] = useState<string>("20");
  const [customMaxScore, setCustomMaxScore] = useState("");
  const [attachment, setAttachment] = useState<AttachmentDraft>({
    kind: "pdf",
    url: "",
    file: null,
  });
  const [extraAttachments, setExtraAttachments] = useState<MultiAttachmentItem[]>([]);
  const [existingFile, setExistingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const classesForLevel = (classesQuery.data ?? []).filter(
    (item) => !levelId || item.levelId === levelId,
  );
  const assignments = useMemo(() => {
    return (listQuery.data ?? []).filter(
      (row) => isDirectorRole(role) || scopedClassOrLevelItemVisible(row, teacherScope),
    );
  }, [listQuery.data, role, teacherScope]);

  const resolvedMaxScore = (): number | null => {
    if (maxScorePreset === "custom") return parseCustomMaxScore(customMaxScore);
    const n = Number(maxScorePreset);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const resetForm = () => {
    setEditingId(null);
    setClearAttachment(false);
    setTitle("");
    setDescription("");
    setLevelId("");
    setClassId("");
    setDueAt("");
    setPublishedAt("");
    setMaxScorePreset("20");
    setCustomMaxScore("");
    setAttachment({ kind: "text", url: "", file: null, text: "" });
    setExtraAttachments([]);
    setExistingFile(false);
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (row: NonNullable<typeof listQuery.data>[number]) => {
    setEditingId(row.id);
    setClearAttachment(false);
    setTitle(row.title);
    setDescription(row.instructions || row.description || "");
    setLevelId(row.level_id);
    setClassId(row.class_id ?? "");
    setDueAt(toLocalInput(row.due_at));
    setPublishedAt(toLocalInput(row.published_at));
    const max = Number(row.max_score);
    if (PRESET_SCORE_SCALES.includes(max as (typeof PRESET_SCORE_SCALES)[number])) {
      setMaxScorePreset(String(max));
      setCustomMaxScore("");
    } else if (Number.isFinite(max) && max > 0) {
      setMaxScorePreset("custom");
      setCustomMaxScore(String(max));
    } else {
      setMaxScorePreset("20");
      setCustomMaxScore("");
    }
    setAttachment({
      kind: (row.content_kind as MediaKind) || "text",
      url: row.content_url ?? "",
      file: null,
      text:
        row.content_kind === "text" ? row.instructions || row.description || "" : "",
    });
    setExistingFile(
      Boolean(row.content_url || row.attachment_path) && row.content_kind !== "text",
    );
    setFormError(null);
    setOpen(true);
  };

  useEffect(() => {
    if (!isTeacher || classId || !levelId) return;
    const firstClass = classesForLevel[0];
    if (firstClass) setClassId(firstClass.id);
  }, [isTeacher, classId, levelId, classesForLevel]);

  useEffect(() => {
    if (!isTeacher || classId || editingId) return;
    const firstClass = classesQuery.data?.[0];
    if (firstClass) setClassId(firstClass.id);
  }, [isTeacher, classId, classesQuery.data, editingId]);

  return (
    <>
      <PageHeader
        title="Devoirs"
        subtitle={
          isTeacher
            ? "Publiez et partagez des devoirs avec vos groupes uniquement."
            : "Ciblez un niveau entier ou un groupe de ce niveau."
        }
        action={<Button onClick={openCreate}>+ Créer un devoir</Button>}
      />
      <QueryState
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        isEmpty={!assignments.length}
        emptyTitle="Aucun devoir"
        emptyMessage={
          isTeacher
            ? "Aucun devoir pour vos groupes pour le moment."
            : "Créez un devoir pour un niveau ou un groupe."
        }
        onRetry={() => void listQuery.refetch()}
      >
        <div className="space-y-3">
          {assignments.map((row) => (
            <Surface className="p-5" key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <LevelBadge code={row.level?.code} />
                    <GroupBadge label={row.class?.name ?? "Niveau entier"} />
                  </div>
                  <h2 className="font-semibold tracking-tight">{row.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {`Limite ${formatFrDate(row.due_at)}`}
                    {` · ${MEDIA_KIND_LABELS[row.content_kind]}`}
                  </p>
                  {row.instructions || row.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.instructions || row.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Status>{statusLabel(row.status)}</Status>
                  {(row.content_url || row.attachment_path) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void openLinkOrFile(row.title, row.content_kind, row.mime_type, () =>
                            AssignmentService.getAttachmentUrl(row),
                          )
                        }
                      >
                        Voir
                      </Button>
                      {row.content_kind !== "link" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void (async () => {
                              try {
                                const url = await AssignmentService.getAttachmentUrl(row);
                                await downloadFromUrl(url, row.title);
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Téléchargement impossible",
                                );
                              }
                            })()
                          }
                        >
                          Télécharger
                        </Button>
                      )}
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-10 font-semibold shadow-soft"
                    onClick={() => setGradingId(gradingId === row.id ? null : row.id)}
                  >
                    {gradingId === row.id ? "Masquer les remises" : "Voir les remises"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!window.confirm(`Supprimer le devoir « ${row.title} » ?`)) return;
                      archive.mutate(row.id, {
                        onSuccess: () => toast.success("Devoir archivé"),
                        onError: (err) => toast.error(err.message),
                      });
                    }}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
              {gradingId === row.id &&
                (row.class_id ? (
                  <AssignmentGrading assignmentId={row.id} classId={row.class_id} />
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Les remises nécessitent un groupe. Assignez ce devoir à un groupe pour suivre et
                    corriger les remises.
                  </p>
                ))}
            </Surface>
          ))}
        </div>
      </QueryState>

      {open && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel max-h-[90dvh] space-y-4 overflow-y-auto">
            <h2 className="text-lg font-semibold">
              {editingId ? "Modifier le devoir" : "Créer un devoir"}
            </h2>
            <FormSection
              title="Consigne"
              description="Titre et instructions visibles par les étudiants."
            >
              <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea
                placeholder="Consigne / description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormSection>
            <label className="block text-sm">
              Niveau
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={levelId}
                onChange={(e) => {
                  setLevelId(e.target.value);
                  setClassId("");
                }}
              >
                <option value="">Choisir le niveau</option>
                {(levelsQuery.data ?? [])
                  .filter((level) => isDirectorRole(role) || teacherScope.levelIds.has(level.id))
                  .map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.code} · {level.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm">
              {isTeacher ? "Groupe" : "Groupe (facultatif)"}
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                disabled={!levelId}
                required={isTeacher}
              >
                <option value="">{isTeacher ? "Choisir le groupe" : "Tout le niveau"}</option>
                {classesForLevel.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Date de publication
              <Input
                className="mt-1"
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Date limite
              <Input
                className="mt-1"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Barème
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={maxScorePreset}
                onChange={(e) => setMaxScorePreset(e.target.value)}
              >
                {PRESET_SCORE_SCALES.map((n) => (
                  <option key={n} value={String(n)}>
                    /{n}
                  </option>
                ))}
                <option value="custom">Personnalisé</option>
              </select>
            </label>
            {maxScorePreset === "custom" ? (
              <label className="block text-sm">
                Note maximale
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  step="0.5"
                  placeholder="Ex. 25"
                  value={customMaxScore}
                  onChange={(e) => setCustomMaxScore(e.target.value)}
                />
              </label>
            ) : null}
            <ContentAttachmentUploader
              kinds={["text", "pdf", "document", "image", "link", "audio"]}
              value={attachment}
              onChange={(next) => {
                setClearAttachment(false);
                setAttachment(next);
              }}
              disabled={saving}
              uploading={saving}
              error={formError}
              requiredFileWhenNew={false}
              hasExistingFile={existingFile && !clearAttachment && isFileContentKind(attachment.kind)}
              textPlaceholder="Sujet d’expression écrite ou consignes textuelles…"
              onClearExisting={() => {
                setClearAttachment(true);
                setExistingFile(false);
                setAttachment({ ...attachment, file: null, url: "", text: "" });
              }}
            />
            <MultiAttachmentComposer
              items={extraAttachments}
              onChange={setExtraAttachments}
              disabled={saving}
              uploading={saving}
            />
            {extraAttachments.length === 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => setExtraAttachments([createMultiAttachmentItem("pdf")])}
              >
                + Ajouter d’autres pièces (PDF, image, audio, lien…)
              </Button>
            ) : null}
            {editingId && existingFile && !clearAttachment && attachment.kind !== "link" ? (
              <p className="text-xs text-muted-foreground">
                Déposez un fichier pour le remplacer, ou utilisez « Supprimer » pour retirer la
                pièce jointe (Supprimer fichier).
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                Annuler
              </Button>
              <Button
                disabled={
                  !title.trim() ||
                  !levelId ||
                  saving ||
                  create.isPending ||
                  update.isPending ||
                  (isTeacher && !classId)
                }
                onClick={() => {
                  void (async () => {
                    setFormError(null);
                    if (isTeacher && !classId) {
                      setFormError("Choisissez un de vos groupes pour partager ce devoir.");
                      return;
                    }
                    const kind = attachment.kind as MediaKind;
                    if (isTextContentKind(kind)) {
                      const textError = validateTextContentBody(
                        attachment.text || description,
                      );
                      if (textError) {
                        setFormError(textError);
                        return;
                      }
                    }
                    if (kind === "link" && attachment.url && !isValidHttpUrl(attachment.url)) {
                      setFormError("Saisissez une URL valide.");
                      return;
                    }
                    if (attachment.file && isFileContentKind(kind)) {
                      const fileError = validateFileForKind(attachment.file, kind);
                      if (fileError) {
                        setFormError(fileError);
                        return;
                      }
                    }
                    setSaving(true);
                    try {
                      const maxScore = resolvedMaxScore();
                      if (maxScore == null) {
                        setFormError("Indiquez un barème positif (/10, /20, /50, /100 ou personnalisé).");
                        return;
                      }
                      let attachmentBucket: string | null | undefined;
                      let attachmentPath: string | null | undefined;
                      let mimeType: string | null | undefined;
                      if (attachment.file && isFileContentKind(kind)) {
                        const uploaded = await AssignmentService.uploadAttachment(attachment.file);
                        attachmentBucket = uploaded.attachmentBucket;
                        attachmentPath = uploaded.attachmentPath;
                        mimeType = uploaded.mimeType;
                      }
                      const textBody = (attachment.text || description).trim();
                      const resolvedDescription = isTextContentKind(kind)
                        ? textBody
                        : description.trim() || null;
                      if (editingId) {
                        const patch: Parameters<typeof AssignmentService.update>[1] = {
                          title: title.trim(),
                          description: resolvedDescription,
                          instructions: resolvedDescription,
                          levelId,
                          classId: classId || null,
                          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                          maxScore,
                          contentKind: kind,
                          contentUrl: kind === "link" ? attachment.url.trim() || null : null,
                          mimeType: isTextContentKind(kind) ? "text/plain" : mimeType ?? null,
                        };
                        if (publishedAt) {
                          patch.publishedAt = new Date(publishedAt).toISOString();
                        }
                        if (isTextContentKind(kind) || clearAttachment) {
                          patch.clearAttachment = true;
                        } else if (attachment.file && isFileContentKind(kind)) {
                          patch.attachmentBucket = attachmentBucket ?? null;
                          patch.attachmentPath = attachmentPath ?? null;
                          patch.mimeType = mimeType ?? null;
                        }
                        await update.mutateAsync({
                          id: editingId,
                          patch,
                        });
                        await persistAssignmentAttachments(editingId, {
                          kind,
                          attachment,
                          attachmentBucket: attachmentBucket ?? null,
                          attachmentPath: attachmentPath ?? null,
                          mimeType: mimeType ?? null,
                          textBody,
                          extraAttachments,
                        });
                        toast.success("Devoir mis à jour");
                      } else {
                        const created = await create.mutateAsync({
                          levelId,
                          classId: classId || null,
                          title: title.trim(),
                          maxScore,
                          ...(resolvedDescription
                            ? {
                                description: resolvedDescription,
                                instructions: resolvedDescription,
                              }
                            : {}),
                          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                          publishedAt: publishedAt
                            ? new Date(publishedAt).toISOString()
                            : new Date().toISOString(),
                          contentKind: kind,
                          contentUrl: kind === "link" ? attachment.url.trim() || null : null,
                          mimeType: isTextContentKind(kind)
                            ? "text/plain"
                            : (mimeType ?? null),
                          attachmentBucket: isTextContentKind(kind)
                            ? null
                            : (attachmentBucket ?? null),
                          attachmentPath: isTextContentKind(kind)
                            ? null
                            : (attachmentPath ?? null),
                          createdBy: user?.id ?? null,
                          status: "published",
                        });
                        await persistAssignmentAttachments(created.id, {
                          kind,
                          attachment,
                          attachmentBucket: attachmentBucket ?? null,
                          attachmentPath: attachmentPath ?? null,
                          mimeType: mimeType ?? null,
                          textBody,
                          extraAttachments,
                        });
                        toast.success("Devoir publié");
                      }
                      setOpen(false);
                      resetForm();
                    } catch (err) {
                      setFormError(
                        err instanceof Error
                          ? err.message
                          : editingId
                            ? "Mise à jour impossible"
                            : "Création impossible",
                      );
                    } finally {
                      setSaving(false);
                    }
                  })();
                }}
              >
                {editingId ? "Enregistrer" : "Publier"}
              </Button>
            </div>
          </Surface>
        </div>
      )}
      <DocumentViewer
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        url={preview?.url ?? null}
        mimeType={preview?.mimeType}
        loading={preview?.loading}
        error={preview?.error}
      />
    </>
  );
}
