import { useEffect, useMemo, useState } from "react";
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
import {
  buildTeacherScope,
  hideArchivedStatus,
  isDirectorRole,
  scopedLibraryItemVisible,
} from "@/lib/academy-logic";
import { CourseService, LibraryService, AssignmentService } from "@/services/academy-services";
import type { Database } from "@/types/database";
import { useAcademy } from "./academy-context";
import { DocumentViewer } from "./document-viewer";
import { QueryState } from "./query-state";
import { PageHeader, Status, Surface } from "./primitives";

export function DirectorCoursesPage() {
  const { user, role } = useAcademy();
  const classesQuery = useClasses();
  const coursesQuery = useCourses();
  const levelsQuery = useLevels();
  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );
  const visibleCourses = useMemo(() => {
    return hideArchivedStatus(coursesQuery.data ?? []).filter(
      (course) => isDirectorRole(role) || teacherScope.levelIds.has(course.level_id),
    );
  }, [coursesQuery.data, role, teacherScope]);
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
        isEmpty={!visibleCourses.length}
        emptyTitle="Aucun cours"
        emptyMessage={
          role === "teacher"
            ? "Aucun cours pour les niveaux de vos groupes."
            : "Créez le premier cours pour un niveau."
        }
        onRetry={() => void coursesQuery.refetch()}
      >
        <div className="space-y-3">
          {visibleCourses.map((course) => {
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
              {(levelsQuery.data ?? [])
                .filter((level) => isDirectorRole(role) || teacherScope.levelIds.has(level.id))
                .map((level) => (
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
  const { role } = useAcademy();
  const classesQuery = useClasses();
  const lessonsQuery = useLessons();
  const coursesQuery = useCourses();
  const createLesson = useCreateLesson();
  const publishLesson = usePublishLesson();
  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );
  const visibleCourses = useMemo(() => {
    return hideArchivedStatus(coursesQuery.data ?? []).filter(
      (course) => isDirectorRole(role) || teacherScope.levelIds.has(course.level_id),
    );
  }, [coursesQuery.data, role, teacherScope]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [courseId, setCourseId] = useState("");

  const lessonStatusLabel = (status: string) => {
    if (status === "published") return "Publié";
    if (status === "draft") return "Brouillon";
    if (status === "archived") return "Archivé";
    return status;
  };

  return (
    <>
      <PageHeader
        title="Gestion des leçons"
        subtitle="Créez et publiez des leçons liées à vos cours."
        action={<Button onClick={() => setOpen(true)}>+ Créer une leçon</Button>}
      />
      <QueryState
        isLoading={lessonsQuery.isLoading}
        isError={lessonsQuery.isError}
        error={lessonsQuery.error}
        isEmpty={!lessonsQuery.data?.length}
        emptyTitle="Aucune leçon"
        emptyMessage="Créez une leçon liée à un cours de vos niveaux."
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
                  {lesson.description ?? "Aucune description"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Status tone={lesson.status === "published" ? "green" : "amber"}>
                  {lessonStatusLabel(lesson.status)}
                </Status>
                {lesson.status !== "published" && (
                  <Button
                    size="sm"
                    disabled={publishLesson.isPending}
                    onClick={() =>
                      publishLesson.mutate(lesson.id, {
                        onSuccess: () => toast.success("Leçon publiée"),
                        onError: (err) => toast.error(err.message),
                      })
                    }
                  >
                    Publier
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
            <h2 className="text-lg font-semibold">Créer une leçon</h2>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Choisir un cours</option>
              {visibleCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.level?.code} · {course.title}
                </option>
              ))}
            </select>
            <Input
              placeholder="Titre de la leçon"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Contenu (Markdown)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
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
                        toast.success("Leçon créée en brouillon");
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
                Créer
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </>
  );
}

export { MaterialsLibraryPage } from "./materials-library-page";


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
            Votre mois d’essai est terminé ou votre paiement n’est plus à jour. Consultez Paiements
            pour régulariser et retrouver l’accès aux cours.
          </p>
          <Button onClick={() => navigate("payments")}>Mes paiements</Button>
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
        emptyTitle="Aucun module publié"
        emptyMessage="Les cours apparaîtront ici une fois publiés par l’équipe pédagogique."
        onRetry={() => void modulesQuery.refetch()}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {modulesQuery.data?.map((module) => (
            <Surface key={module.id} className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase">{module.level}</p>
              <h2 className="mt-2 text-lg font-semibold">{module.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {module.courseTitle} · {module.lessons} leçon{module.lessons !== 1 ? "s" : ""}
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => navigate("lesson", { moduleId: module.id })}
              >
                Ouvrir les leçons
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
  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );
  const listQuery = useAssignments();
  const assignments = useMemo(() => {
    return (listQuery.data ?? []).filter(
      (item) => item.classId && teacherScope.classIds.has(item.classId),
    );
  }, [listQuery.data, teacherScope]);

  useEffect(() => {
    if (classId || !classesQuery.data?.[0]) return;
    setClassId(classesQuery.data[0].id);
  }, [classId, classesQuery.data]);

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
        isEmpty={!assignments.length}
        emptyTitle="Aucun devoir"
        emptyMessage="Créez un devoir pour l’un de vos groupes."
        onRetry={() => void listQuery.refetch()}
      >
        <div className="space-y-3">
          {assignments.map((item) => (
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
  const { user, role } = useAcademy();
  const classesQuery = useClasses();
  const listQuery = useAssignments();
  const create = useCreateAssignment();
  const isTeacher = role === "teacher";
  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );
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
  const assignments = useMemo(() => {
    return (listQuery.data ?? []).filter(
      (row) =>
        isDirectorRole(role) || Boolean(row.classId && teacherScope.classIds.has(row.classId)),
    );
  }, [listQuery.data, role, teacherScope]);

  useEffect(() => {
    if (!isTeacher || classId || !classesQuery.data?.[0]) return;
    setClassId(classesQuery.data[0].id);
  }, [isTeacher, classId, classesQuery.data]);

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
        isEmpty={!assignments.length}
        emptyTitle="Aucun devoir"
        emptyMessage={
          isTeacher
            ? "Aucun devoir pour vos groupes pour le moment."
            : "Créez un devoir pour un groupe."
        }
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
              {assignments.map((row) => (
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
