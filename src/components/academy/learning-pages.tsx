import { useState } from "react";
import { AssignmentGrading } from "./workflow-pages";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAssignments,
  useAcademicAccess,
  useArchiveCourse,
  useArchiveLibraryItem,
  useClasses,
  useCourseModules,
  useCourses,
  useCreateAssignment,
  useCreateCourse,
  useCreateLesson,
  useLessons,
  useLevels,
  useLibrary,
  usePublishLesson,
  useUpdateCourse,
  useUploadLibraryItem,
} from "@/hooks/use-academy-data";
import { CourseService, LibraryService, AssignmentService } from "@/services/academy-services";
import type { Database } from "@/types/database";
import { useAcademy } from "./academy-context";
import { DocumentViewer } from "./document-viewer";
import { QueryState } from "./query-state";
import { PageHeader, Status, Surface } from "./primitives";

export function DirectorCoursesPage() {
  const { user } = useAcademy();
  const coursesQuery = useCourses();
  const levelsQuery = useLevels();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const archiveCourse = useArchiveCourse();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [levelId, setLevelId] = useState("");
  const [contentKind, setContentKind] = useState<"none" | "pdf" | "link" | "image" | "audio">(
    "none",
  );
  const [contentUrl, setContentUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    title: string;
    url: string | null;
    mimeType: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setLevelId("");
    setContentKind("none");
    setContentUrl("");
    setFile(null);
  };

  const openEdit = (course: NonNullable<typeof coursesQuery.data>[number]) => {
    setEditingId(course.id);
    setTitle(course.title);
    setDescription(course.description ?? "");
    setLevelId(course.level_id);
    setContentKind((course.content_kind as typeof contentKind) ?? "none");
    setContentUrl(course.content_url ?? "");
    setFile(null);
    setOpen(true);
  };

  const kindLabel: Record<string, string> = {
    none: "Aucun",
    pdf: "PDF",
    link: "Lien",
    image: "Image",
    audio: "Audio",
  };

  return (
    <>
      <PageHeader
        title="Gestion des cours"
        subtitle="Parcours par niveau CECR — contenu PDF, lien, image ou audio."
        action={
          <Button
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            + Créer un cours
          </Button>
        }
      />
      <QueryState
        isLoading={coursesQuery.isLoading}
        isError={coursesQuery.isError}
        error={coursesQuery.error}
        isEmpty={!coursesQuery.data?.length}
        emptyTitle="Aucun cours"
        emptyMessage="Créez le premier cours pour un niveau."
        onRetry={() => void coursesQuery.refetch()}
      >
        <div className="space-y-3">
          {coursesQuery.data?.map((course) => {
            const moduleCount = (course.modules ?? []).length;
            const lessonCount = (course.modules ?? []).reduce(
              (acc, mod) =>
                acc +
                (mod.units ?? []).reduce((uAcc, unit) => uAcc + (unit.lessons ?? []).length, 0),
              0,
            );
            return (
              <Surface className="p-5" key={course.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {course.level?.code ?? "—"} · {kindLabel[course.content_kind] ?? "Aucun"}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{course.title}</h2>
                    {course.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {moduleCount} modules · {lessonCount} leçons
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Status tone={course.status === "published" ? "green" : "amber"}>
                      {course.status === "published" ? "Publié" : "Brouillon"}
                    </Status>
                    {(course.content_kind !== "none" ||
                      course.content_url ||
                      course.storage_path) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void (async () => {
                            setPreview({
                              title: course.title,
                              url: null,
                              mimeType: course.mime_type,
                              loading: true,
                              error: null,
                            });
                            try {
                              const url = await CourseService.getCourseMaterialUrl(course);
                              if (course.content_kind === "link") {
                                window.open(url, "_blank", "noopener,noreferrer");
                                setPreview(null);
                                return;
                              }
                              setPreview({
                                title: course.title,
                                url,
                                mimeType: course.mime_type,
                                loading: false,
                                error: null,
                              });
                            } catch (err) {
                              setPreview({
                                title: course.title,
                                url: null,
                                mimeType: course.mime_type,
                                loading: false,
                                error: err instanceof Error ? err.message : "Ouverture impossible",
                              });
                            }
                          })();
                        }}
                      >
                        Ouvrir
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(course)}>
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={archiveCourse.isPending}
                      onClick={() => {
                        if (!window.confirm(`Supprimer le cours « ${course.title} » ?`)) return;
                        archiveCourse.mutate(course.id, {
                          onSuccess: () => toast.success("Cours archivé"),
                          onError: (err) => toast.error(err.message),
                        });
                      }}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              </Surface>
            );
          })}
        </div>
      </QueryState>

      {open && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel max-h-[90dvh] space-y-4 overflow-y-auto">
            <h2 className="text-lg font-semibold">
              {editingId ? "Modifier le cours" : "Créer un cours"}
            </h2>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
            >
              <option value="">Choisir le niveau</option>
              {(levelsQuery.data ?? []).map((level) => (
                <option key={level.id} value={level.id}>
                  {level.code} · {level.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Titre du cours"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={contentKind}
              onChange={(e) => setContentKind(e.target.value as typeof contentKind)}
            >
              <option value="none">Type de contenu — aucun</option>
              <option value="pdf">PDF</option>
              <option value="link">Lien</option>
              <option value="image">Image</option>
              <option value="audio">Audio</option>
            </select>
            {contentKind === "link" ? (
              <Input
                placeholder="URL du contenu"
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
              />
            ) : contentKind !== "none" ? (
              <Input
                type="file"
                accept={
                  contentKind === "pdf"
                    ? ".pdf,application/pdf"
                    : contentKind === "image"
                      ? "image/*"
                      : "audio/*"
                }
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
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
                  createCourse.isPending ||
                  updateCourse.isPending ||
                  (contentKind === "link" && !contentUrl.trim()) ||
                  (contentKind !== "none" && contentKind !== "link" && !file && !editingId)
                }
                onClick={() => {
                  void (async () => {
                    setSaving(true);
                    try {
                      let storageBucket: string | null = null;
                      let storagePath: string | null = null;
                      let mimeType: string | null = null;
                      const url: string | null = contentKind === "link" ? contentUrl.trim() : null;

                      if (file && contentKind !== "none" && contentKind !== "link") {
                        const uploaded = await CourseService.uploadCourseMaterial(file);
                        storageBucket = uploaded.storageBucket;
                        storagePath = uploaded.storagePath;
                        mimeType = uploaded.mimeType;
                      }

                      if (editingId) {
                        const patch: Database["public"]["Tables"]["courses"]["Update"] = {
                          title: title.trim(),
                          level_id: levelId,
                          description: description.trim() || null,
                          content_kind: contentKind,
                          content_url: url,
                          status: "published",
                        };
                        if (storagePath) {
                          patch["storage_bucket"] = storageBucket;
                          patch["storage_path"] = storagePath;
                          patch["mime_type"] = mimeType;
                        }
                        await updateCourse.mutateAsync({ id: editingId, patch });
                        toast.success("Cours mis à jour");
                      } else {
                        await createCourse.mutateAsync({
                          title: title.trim(),
                          levelId,
                          ...(description.trim() ? { description: description.trim() } : {}),
                          contentKind,
                          contentUrl: url,
                          storageBucket,
                          storagePath,
                          mimeType,
                          status: "published",
                        });
                        toast.success("Cours créé");
                      }
                      setOpen(false);
                      resetForm();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Erreur");
                    } finally {
                      setSaving(false);
                    }
                  })();
                }}
              >
                {editingId ? "Enregistrer" : "Créer"}
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

export function TeacherLessonManagerPage() {
  const lessonsQuery = useLessons();
  const coursesQuery = useCourses();
  const createLesson = useCreateLesson();
  const publishLesson = usePublishLesson();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [courseId, setCourseId] = useState("");

  return (
    <>
      <PageHeader
        title="Lesson Manager"
        subtitle="Create and publish lessons stored in Supabase."
        action={<Button onClick={() => setOpen(true)}>+ Create lesson</Button>}
      />
      <QueryState
        isLoading={lessonsQuery.isLoading}
        isError={lessonsQuery.isError}
        error={lessonsQuery.error}
        isEmpty={!lessonsQuery.data?.length}
        emptyTitle="No lessons"
        emptyMessage="Create a lesson linked to a course unit."
        onRetry={() => void lessonsQuery.refetch()}
      >
        <div className="space-y-3">
          {lessonsQuery.data?.map((lesson) => (
            <Surface
              className="flex flex-wrap items-center justify-between gap-3 p-4"
              key={lesson.id}
            >
              <div>
                <h2 className="font-semibold">{lesson.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {lesson.description ?? "No description"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Status tone={lesson.status === "published" ? "green" : "amber"}>
                  {lesson.status}
                </Status>
                {lesson.status !== "published" && (
                  <Button
                    size="sm"
                    disabled={publishLesson.isPending}
                    onClick={() =>
                      publishLesson.mutate(lesson.id, {
                        onSuccess: () => toast.success("Lesson published"),
                        onError: (err) => toast.error(err.message),
                      })
                    }
                  >
                    Publish
                  </Button>
                )}
              </div>
            </Surface>
          ))}
        </div>
      </QueryState>

      {open && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Create lesson</h2>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Select course</option>
              {(coursesQuery.data ?? []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.level?.code} · {course.title}
                </option>
              ))}
            </select>
            <Input
              placeholder="Lesson title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Markdown content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!title.trim() || !courseId || createLesson.isPending}
                onClick={() => {
                  createLesson.mutate(
                    {
                      courseId,
                      title: title.trim(),
                      ...(content.trim() ? { contentMarkdown: content.trim() } : {}),
                    },
                    {
                      onSuccess: () => {
                        toast.success("Lesson created as draft");
                        setOpen(false);
                        setTitle("");
                        setContent("");
                        setCourseId("");
                      },
                      onError: (err) => toast.error(err.message),
                    },
                  );
                }}
              >
                Create
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </>
  );
}

export function MaterialsLibraryPage() {
  const { role, user } = useAcademy();
  const libraryQuery = useLibrary();
  const upload = useUploadLibraryItem();
  const archiveItem = useArchiveLibraryItem();
  const levelsQuery = useLevels();
  const classesQuery = useClasses();
  const [domainTab, setDomainTab] = useState<"academic" | "professional">("academic");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<"academic" | "professional">("academic");
  const [contentMode, setContentMode] = useState<"file" | "link">("file");
  const [externalUrl, setExternalUrl] = useState("");
  const [audience, setAudience] = useState<"everyone" | "level" | "class">("everyone");
  const [levelCode, setLevelCode] = useState("");
  const [classId, setClassId] = useState("");
  const [category, setCategory] = useState<"pdf" | "audio" | "video" | "course_material">("pdf");
  const [preview, setPreview] = useState<{
    title: string;
    url: string | null;
    mimeType: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  const filtered = (libraryQuery.data ?? []).filter((item) => item.domain === domainTab);
  const audienceLabel = { everyone: "Tout le monde", level: "Niveau", class: "Groupe" } as const;
  const domainLabel = { academic: "Académique", professional: "Professionnelle" } as const;

  return (
    <>
      <PageHeader
        title="Bibliothèque de ressources"
        subtitle="Documents académiques et professionnels, ciblés par audience."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["academic", "professional"] as const).map((d) => (
          <Button
            key={d}
            size="sm"
            variant={domainTab === d ? "default" : "outline"}
            onClick={() => setDomainTab(d)}
          >
            {domainLabel[d]}
          </Button>
        ))}
      </div>

      {role !== "student" && (
        <Surface className="mb-5 space-y-3 p-5">
          <h2 className="text-sm font-semibold">Ajouter une ressource</h2>
          <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={domain}
              onChange={(e) => setDomain(e.target.value as typeof domain)}
            >
              <option value="academic">Domaine — Académique</option>
              <option value="professional">Domaine — Professionnelle</option>
            </select>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
            >
              <option value="pdf">Type — PDF</option>
              <option value="audio">Type — Audio</option>
              <option value="video">Type — Vidéo</option>
              <option value="course_material">Type — Support de cours</option>
            </select>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={audience}
              onChange={(e) => setAudience(e.target.value as typeof audience)}
            >
              <option value="everyone">Public — Tout le monde</option>
              <option value="level">Public — Niveau</option>
              <option value="class">Public — Groupe</option>
            </select>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={contentMode}
              onChange={(e) => setContentMode(e.target.value as typeof contentMode)}
            >
              <option value="file">Fichier</option>
              <option value="link">Lien externe</option>
            </select>
          </div>
          {(audience === "level" || audience === "everyone") && (
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={levelCode}
              onChange={(e) => setLevelCode(e.target.value)}
            >
              <option value="">
                {audience === "level" ? "Choisir le niveau" : "Niveau (facultatif)"}
              </option>
              {(levelsQuery.data ?? []).map((level) => (
                <option key={level.id} value={level.code}>
                  {level.code}
                </option>
              ))}
            </select>
          )}
          {audience === "class" && (
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Choisir le groupe</option>
              {(classesQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.level}
                </option>
              ))}
            </select>
          )}
          {contentMode === "file" ? (
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              accept=".pdf,.mp3,.mp4,.png,.jpg,.jpeg,.zip"
            />
          ) : (
            <Input
              placeholder="URL externe"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
            />
          )}
          <Button
            disabled={
              !title.trim() ||
              upload.isPending ||
              (contentMode === "file" && !file) ||
              (contentMode === "link" && !externalUrl.trim()) ||
              (audience === "level" && !levelCode) ||
              (audience === "class" && !classId)
            }
            onClick={() => {
              upload.mutate(
                {
                  ...(contentMode === "file" && file ? { file } : {}),
                  title: title.trim(),
                  domain,
                  audience,
                  category,
                  levelCode: levelCode || null,
                  classId: classId || null,
                  externalUrl: contentMode === "link" ? externalUrl.trim() : null,
                  createdBy: user?.id ?? null,
                },
                {
                  onSuccess: () => {
                    toast.success("Ressource ajoutée");
                    setFile(null);
                    setTitle("");
                    setExternalUrl("");
                    setDomainTab(domain);
                  },
                  onError: (err) => toast.error(err.message),
                },
              );
            }}
          >
            Enregistrer
          </Button>
        </Surface>
      )}

      <QueryState
        isLoading={libraryQuery.isLoading}
        isError={libraryQuery.isError}
        error={libraryQuery.error}
        isEmpty={!filtered.length}
        emptyTitle="Aucune ressource"
        emptyMessage="Ajoutez un PDF, un audio ou un lien pour commencer."
        onRetry={() => void libraryQuery.refetch()}
      >
        <div className="space-y-3">
          {filtered.map((item) => (
            <Surface
              className="flex flex-wrap items-center justify-between gap-3 p-4"
              key={item.id}
            >
              <div>
                <h2 className="font-semibold">{item.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {item.level_code ?? "—"} · {item.category} · {audienceLabel[item.audience]}
                  {item.file_size
                    ? ` · ${Math.max(1, Math.round(item.file_size / 1024))} Ko`
                    : item.external_url
                      ? " · Lien"
                      : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void (async () => {
                      setPreview({
                        title: item.title,
                        url: null,
                        mimeType: item.mime_type ?? null,
                        loading: true,
                        error: null,
                      });
                      try {
                        const url = await LibraryService.getSignedUrl(item);
                        if (item.external_url) {
                          window.open(url, "_blank", "noopener,noreferrer");
                          setPreview(null);
                          return;
                        }
                        setPreview({
                          title: item.title,
                          url,
                          mimeType: item.mime_type ?? null,
                          loading: false,
                          error: null,
                        });
                      } catch (err) {
                        setPreview({
                          title: item.title,
                          url: null,
                          mimeType: item.mime_type ?? null,
                          loading: false,
                          error: err instanceof Error ? err.message : "Ouverture impossible",
                        });
                      }
                    })();
                  }}
                >
                  Ouvrir
                </Button>
                {role !== "student" && (
                  <Button
                    variant="outline"
                    size="sm"
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
                  </Button>
                )}
              </div>
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

export function StudentLearningPage() {
  const { navigate } = useAcademy();
  const modulesQuery = useCourseModules();
  const accessQuery = useAcademicAccess();

  if (accessQuery.data === false) {
    return (
      <>
        <PageHeader title="Mes cours" subtitle="Parcours publiés de votre académie." />
        <Surface className="space-y-3 p-6">
          <h2 className="font-semibold">Accès restreint</h2>
          <p className="text-sm text-muted-foreground">
            An active subscription is required to open courses. Review your payments to renew.
          </p>
          <Button onClick={() => navigate("payments")}>Open payments</Button>
        </Surface>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Mes cours" subtitle="Parcours publiés de votre académie." />
      <QueryState
        isLoading={modulesQuery.isLoading}
        isError={modulesQuery.isError}
        error={modulesQuery.error}
        isEmpty={!modulesQuery.data?.length}
        emptyTitle="No published modules"
        emptyMessage="Courses appear here once staff publishes curriculum."
        onRetry={() => void modulesQuery.refetch()}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {modulesQuery.data?.map((module) => (
            <Surface key={module.id} className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase">{module.level}</p>
              <h2 className="mt-2 text-lg font-semibold">{module.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {module.courseTitle} · {module.lessons} lessons
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => navigate("lesson", { moduleId: module.id })}
              >
                Open lessons
              </Button>
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}

export function TeacherAssignmentsPage() {
  const [instructions, setInstructions] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [gradingId, setGradingId] = useState<string | null>(null);
  const classesQuery = useClasses();
  const create = useCreateAssignment();
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const effectiveClassId = classId || classesQuery.data?.[0]?.id;
  const listQuery = useAssignments(effectiveClassId);

  return (
    <>
      <PageHeader title="Devoirs" subtitle="Publiez des devoirs pour vos groupes." />
      <Surface className="mb-5 space-y-3 p-5">
        <Input
          placeholder="Titre du devoir"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">Choisir le groupe</option>
          {(classesQuery.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <label className="block text-sm">
          Consignes
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </label>
        <label className="block text-sm">
          Date limite (facultative)
          <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </label>
        <Button
          disabled={
            !title.trim() ||
            !instructions.trim() ||
            !classId ||
            create.isPending ||
            (!!dueAt && new Date(dueAt).getTime() <= Date.now())
          }
          onClick={() => {
            create.mutate(
              {
                classId,
                levelId: classesQuery.data?.find((c) => c.id === classId)?.levelId ?? "",
                title: title.trim(),
                instructions: instructions.trim(),
                dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                status: "published",
              },
              {
                onSuccess: () => {
                  toast.success("Devoir publié");
                  setTitle("");
                  setInstructions("");
                  setDueAt("");
                  void listQuery.refetch();
                },
                onError: (err) => toast.error(err.message),
              },
            );
          }}
        >
          Créer et publier
        </Button>
      </Surface>
      <QueryState
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        isEmpty={!listQuery.data?.length}
        emptyTitle="Aucun devoir"
        emptyMessage="Créez un devoir pour un groupe."
        onRetry={() => void listQuery.refetch()}
      >
        <div className="space-y-3">
          {listQuery.data?.map((item) => (
            <Surface className="p-4" key={item.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{item.title}</h2>
                  <p className="text-sm text-muted-foreground">Limite {item.due}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setGradingId(gradingId === item.id ? null : item.id)}
                >
                  {gradingId === item.id ? "Fermer les remises" : "Voir et corriger les remises"}
                </Button>
              </div>
              {gradingId === item.id && item.classId && (
                <AssignmentGrading assignmentId={item.id} classId={item.classId} />
              )}
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}

export function DirectorAssignmentsPage() {
  const { user } = useAcademy();
  const classesQuery = useClasses();
  const listQuery = useAssignments();
  const create = useCreateAssignment();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedClass = (classesQuery.data ?? []).find((c) => c.id === classId);

  return (
    <>
      <PageHeader
        title="Devoirs"
        subtitle="Création et suivi des devoirs pour tous les groupes."
        action={<Button onClick={() => setOpen(true)}>+ Créer un devoir</Button>}
      />
      <QueryState
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        isEmpty={!listQuery.data?.length}
        emptyTitle="Aucun devoir"
        emptyMessage="Créez un devoir pour un groupe."
        onRetry={() => void listQuery.refetch()}
      >
        <Surface className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Devoir</th>
                <th>Échéance</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.data?.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.title}</td>
                  <td>{row.due}</td>
                  <td>
                    <Status>
                      {row.status === "Open" || row.status === "published"
                        ? "Publié"
                        : row.status === "draft"
                          ? "Brouillon"
                          : String(row.status)}
                    </Status>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </QueryState>

      {open && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel max-h-[90dvh] space-y-4 overflow-y-auto">
            <h2 className="text-lg font-semibold">Créer un devoir</h2>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Choisir le groupe</option>
              {(classesQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · niveau {item.level}
                </option>
              ))}
            </select>
            {selectedClass && (
              <p className="text-sm text-muted-foreground">
                Niveau : <strong>{selectedClass.level}</strong>
              </p>
            )}
            <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              placeholder="Description / consignes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
              Date de publication
              <Input
                className="mt-1"
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
            </label>
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
            />
            <Input
              placeholder="Ou lien de pièce jointe (facultatif)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                disabled={!title.trim() || !classId || saving || create.isPending}
                onClick={() => {
                  void (async () => {
                    setSaving(true);
                    try {
                      let attachmentBucket: string | null = null;
                      let attachmentPath: string | null = null;
                      if (file) {
                        const uploaded = await AssignmentService.uploadAttachment(file);
                        attachmentBucket = uploaded.attachmentBucket;
                        attachmentPath = uploaded.attachmentPath;
                      }
                      const descParts = [
                        description.trim(),
                        link.trim() ? `Lien : ${link.trim()}` : "",
                      ].filter(Boolean);
                      const desc = descParts.join("\n");
                      await create.mutateAsync({
                        classId,
                        levelId: selectedClass?.levelId ?? "",
                        title: title.trim(),
                        ...(desc ? { description: desc } : {}),
                        ...(description.trim() ? { instructions: description.trim() } : {}),
                        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                        publishedAt: publishedAt
                          ? new Date(publishedAt).toISOString()
                          : new Date().toISOString(),
                        attachmentBucket,
                        attachmentPath,
                        createdBy: user?.id ?? null,
                        status: "published",
                      });
                      toast.success("Devoir créé");
                      setOpen(false);
                      setTitle("");
                      setDescription("");
                      setClassId("");
                      setDueAt("");
                      setPublishedAt("");
                      setFile(null);
                      setLink("");
                      void listQuery.refetch();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Erreur");
                    } finally {
                      setSaving(false);
                    }
                  })();
                }}
              >
                Créer et publier
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </>
  );
}
