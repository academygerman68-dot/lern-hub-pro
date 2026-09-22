import { Fragment, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase";
import {
  useAcademicAccess,
  useCourses,
  useClassRoster,
  useGradeAssignment,
} from "@/hooks/use-academy-data";
import { formatFrDate, isTextContentKind, MEDIA_KIND_LABELS, validateFileForKind } from "@/lib/academic-content";
import { setLiveSessionId } from "@/lib/live-class-session";
import { openExternalMeeting } from "@/lib/live-meeting";
import {
  AssignmentService,
  GradeAssistService,
  LiveSessionService,
} from "@/services/academy-services";
import { SupabaseAssignmentService as Assignments } from "@/services/supabase/assignment-service";
import { SupabaseLiveSessionService } from "@/services/supabase/live-session-service";
import type { GradeAssistSuggestion } from "@/services/supabase/grade-assist-service";
import type { Database } from "@/types/database";
import {
  GRADE_ASSIST_NEEDS_TEXT_MESSAGE,
  gradeAssistNeedsExploitableText,
} from "@/lib/grade-assist-ux";
import {
  formatGradedScore,
  scoreScaleChangedWarning,
} from "@/lib/assignment-score-scale";
import { useAcademy } from "./academy-context";
import { AiGradeAssistPanel } from "./ai-grade-assist-panel";
import { ContentAttachmentUploader, type AttachmentDraft } from "./content-attachment-uploader";
import { DocumentViewer } from "./document-viewer";
import { PageHeader, Surface, Status, TableScroll, StatCard, AvatarName } from "./primitives";
import { QueryState } from "./query-state";

type Assignment = Database["public"]["Tables"]["assignments"]["Row"];
type Submission = Database["public"]["Tables"]["assignment_submissions"]["Row"];

export function StudentLessonPage() {
  const { navigate, user } = useAcademy();
  const search = useSearch({ from: "/app/$role/$page" });
  const courses = useCourses();
  const access = useAcademicAccess();
  const qc = useQueryClient();
  const lessons = (courses.data ?? [])
    .filter((c) => c.status === "published")
    .flatMap((c) =>
      c.modules.filter(
        (m) => m.status === "published" && (!search.moduleId || m.id === search.moduleId),
      ),
    )
    .flatMap((m) =>
      [...m.units]
        .sort((a, b) => a.sort_order - b.sort_order)
        .filter((u) => u.status === "published"),
    )
    .flatMap((u) =>
      [...u.lessons]
        .sort((a, b) => a.sort_order - b.sort_order)
        .filter((l) => l.status === "published"),
    );
  const current = search.lessonId ? lessons.find((l) => l.id === search.lessonId) : lessons[0];
  const progress = useQuery({
    queryKey: ["lesson-progress", user?.id],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("current_student_id");
      if (error) throw error;
      if (!data) throw new Error("Profil étudiant introuvable");
      const result = await getSupabase().from("lesson_progress").select("*").eq("student_id", data);
      if (result.error) throw result.error;
      return { studentId: data, rows: result.data };
    },
  });
  const complete = useMutation({
    mutationFn: async (lessonId: string) => {
      if (!progress.data || access.data !== true) throw new Error("Accès non confirmé");
      const { error } = await getSupabase().from("lesson_progress").upsert(
        {
          student_id: progress.data.studentId,
          lesson_id: lessonId,
          progress_pct: 100,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "student_id,lesson_id" },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lesson-progress"] });
      toast.success("Progression enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (access.data === false)
    return (
      <Surface className="space-y-3 p-6">
        <p>Votre accès aux cours est suspendu.</p>
        <Button onClick={() => navigate("payments")}>Mes paiements</Button>
      </Surface>
    );
  const completed = progress.data?.rows.some(
    (r) => r.lesson_id === current?.id && r.progress_pct === 100,
  );
  const next = lessons[lessons.findIndex((l) => l.id === current?.id) + 1];
  return (
    <>
      <Button variant="outline" className="mb-4" onClick={() => navigate("courses")}>
        ← Mes cours
      </Button>
      <PageHeader
        title={current?.title ?? "Leçons"}
        subtitle="Contenu publié par votre académie."
      />
      <QueryState
        isLoading={courses.isLoading || access.isLoading || progress.isLoading}
        isError={courses.isError || access.isError || progress.isError}
        error={courses.error ?? access.error ?? progress.error}
        isEmpty={!current}
        emptyTitle="Leçon indisponible"
        emptyMessage="Le contenu sélectionné n’est pas publié ou n’est pas accessible."
        onRetry={() => {
          void courses.refetch();
          void access.refetch();
          void progress.refetch();
        }}
      >
        <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
          <Surface className="space-y-2 p-4">
            {lessons.map((lesson) => (
              <Button
                key={lesson.id}
                className="h-auto w-full justify-start whitespace-normal text-left"
                variant={current?.id === lesson.id ? "default" : "ghost"}
                onClick={() =>
                  navigate("lesson", {
                    ...(search.moduleId ? { moduleId: search.moduleId } : {}),
                    lessonId: lesson.id,
                  })
                }
              >
                {lesson.title}
              </Button>
            ))}
          </Surface>
          <Surface className="space-y-5 p-6">
            <p className="text-sm text-muted-foreground">{current?.description}</p>
            <div className="whitespace-pre-wrap leading-8">
              {current?.content_markdown || "Aucun texte de leçon n’a été ajouté."}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={
                  !current ||
                  !current.content_markdown ||
                  completed ||
                  complete.isPending ||
                  access.data !== true
                }
                onClick={() => current && complete.mutate(current.id)}
              >
                {completed ? "Leçon terminée" : "Marquer comme terminée"}
              </Button>
              {next && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate("lesson", {
                      ...(search.moduleId ? { moduleId: search.moduleId } : {}),
                      lessonId: next.id,
                    })
                  }
                >
                  Leçon suivante
                </Button>
              )}
            </div>
          </Surface>
        </div>
      </QueryState>
    </>
  );
}

function submissionStatusLabel(status: string) {
  if (status === "submitted") return "Remis";
  if (status === "graded") return "Corrigé";
  if (status === "draft") return "Brouillon";
  if (status === "returned") return "Renvoyé";
  return status;
}

export function AssignmentWorkflow({ detail }: { detail: boolean }) {
  const { navigate } = useAcademy();
  const search = useSearch({ from: "/app/$role/$page" });
  const query = useQuery({ queryKey: ["assignment-workflow"], queryFn: () => Assignments.list() });
  const selected = query.data?.find((a) => a.id === search.assignmentId);
  return (
    <>
      {detail && (
        <Button variant="outline" className="mb-4" onClick={() => navigate("assignments")}>
          ← Devoirs
        </Button>
      )}
      <PageHeader
        title={detail ? (selected?.title ?? "Devoir") : "Mes devoirs"}
        subtitle="Consignes, pièce jointe, remise et correction."
      />
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={detail ? !selected : !query.data?.length}
        emptyTitle={detail ? "Devoir introuvable" : "Aucun devoir"}
        emptyMessage="Sélectionnez un devoir accessible depuis la liste."
        onRetry={() => void query.refetch()}
      >
        {detail && selected ? (
          <AssignmentSubmission key={selected.id} assignment={selected} />
        ) : (
          <div className="space-y-3">
            {query.data?.map((a) => (
              <Surface key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <h2 className="font-semibold">{a.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {a.level?.code ?? "—"}
                    {a.class?.name ? ` · ${a.class.name}` : " · Niveau entier"}
                    {` · Publié ${formatFrDate(a.published_at ?? a.created_at)}`}
                    {` · Limite ${formatFrDate(a.due_at)}`}
                  </p>
                </div>
                <Button onClick={() => navigate("assignment-detail", { assignmentId: a.id })}>
                  Ouvrir le devoir
                </Button>
              </Surface>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}

function AssignmentSubmission({ assignment }: { assignment: Assignment }) {
  const { user } = useAcademy();
  const [preview, setPreview] = useState<{
    title: string;
    url: string | null;
    mimeType: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const query = useQuery({
    queryKey: ["submissions", assignment.id, user?.id],
    queryFn: async () => {
      const { data: studentId, error } = await getSupabase().rpc("current_student_id");
      if (error) throw error;
      if (!studentId) throw new Error("Profil étudiant introuvable");
      const rows = await Assignments.listSubmissions(assignment.id);
      return { studentId, submission: rows.find((r) => r.student_id === studentId) };
    },
  });
  return (
    <Surface className="space-y-4 p-6">
      <p className="text-sm text-muted-foreground">
        Publié {formatFrDate(assignment.published_at ?? assignment.created_at)} · Limite{" "}
        {formatFrDate(assignment.due_at)}
        {` · ${MEDIA_KIND_LABELS[assignment.content_kind]}`}
      </p>
      <p className="whitespace-pre-wrap">{assignment.description}</p>
      <p className="whitespace-pre-wrap">
        {assignment.instructions || "Suivez les consignes données par votre professeur."}
      </p>
      {(assignment.content_url || assignment.attachment_path) &&
        !isTextContentKind(assignment.content_kind) && (
        <Button
          variant="outline"
          onClick={() => {
            setPreview({
              title: assignment.title,
              url: null,
              mimeType: assignment.mime_type,
              loading: true,
              error: null,
            });
            void AssignmentService.getAttachmentUrl(assignment)
              .then((url) => {
                if (assignment.content_kind === "link") {
                  window.open(url, "_blank", "noopener,noreferrer");
                  setPreview(null);
                  return;
                }
                setPreview({
                  title: assignment.title,
                  url,
                  mimeType: assignment.mime_type,
                  loading: false,
                  error: null,
                });
              })
              .catch((err: Error) =>
                setPreview({
                  title: assignment.title,
                  url: null,
                  mimeType: assignment.mime_type,
                  loading: false,
                  error: err.message,
                }),
              );
          }}
        >
          {assignment.content_kind === "link" ? "Ouvrir le lien" : "Ouvrir la pièce jointe"}
        </Button>
      )}
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
      >
        {query.data && (
          <SubmissionForm
            key={query.data.submission?.updated_at ?? "new"}
            assignment={assignment}
            studentId={query.data.studentId}
            submission={query.data.submission ?? null}
            saved={() => query.refetch()}
          />
        )}
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
    </Surface>
  );
}

function SubmissionForm({
  assignment,
  studentId,
  submission,
  saved,
}: {
  assignment: Assignment;
  studentId: string;
  submission: Submission | null;
  saved: () => Promise<unknown>;
}) {
  const [text, setText] = useState(submission?.content_text ?? "");
  const [attachment, setAttachment] = useState<AttachmentDraft>({
    kind: "document",
    url: "",
    file: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const closed =
    assignment.status !== "published" ||
    (assignment.due_at !== null && new Date(assignment.due_at).getTime() < Date.now());
  const locked = closed || submission?.status === "submitted" || submission?.status === "graded";
  const hasFile = Boolean(submission?.file_path);
  const mutation = useMutation({
    mutationFn: () =>
      Assignments.upsertSubmission({
        assignmentId: assignment.id,
        studentId,
        contentText: text.trim(),
        ...(attachment.file ? { file: attachment.file } : {}),
      }),
    onSuccess: async () => {
      setAttachment({ kind: attachment.kind, url: "", file: null });
      await saved();
      toast.success("Devoir remis au professeur");
    },
    onError: (e: Error) => {
      setFormError(e.message);
      toast.error(e.message);
    },
  });
  return (
    <div className="space-y-4">
      {submission && <Status>{submissionStatusLabel(submission.status)}</Status>}
      {submission?.score != null && (
        <p>
          Note :{" "}
          {formatGradedScore({
            score: submission.score,
            gradedMaxScore:
              (submission as { graded_max_score?: number | null }).graded_max_score ?? null,
            currentMaxScore: assignment.max_score,
          })}
        </p>
      )}
      {scoreScaleChangedWarning({
        gradedMaxScore:
          (submission as { graded_max_score?: number | null } | null)?.graded_max_score ?? null,
        currentMaxScore: assignment.max_score,
      }) ? (
        <p className="text-xs text-amber-800">
          {scoreScaleChangedWarning({
            gradedMaxScore:
              (submission as { graded_max_score?: number | null }).graded_max_score ?? null,
            currentMaxScore: assignment.max_score,
          })}
        </p>
      ) : null}
      {submission?.feedback && (
        <p className="whitespace-pre-wrap">Correction : {submission.feedback}</p>
      )}
      <label className="block text-sm">
        Votre réponse
        <Textarea
          className="mt-2 min-h-48"
          value={text}
          disabled={locked || mutation.isPending}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {hasFile && submission && (
        <SubmissionFileButton submission={submission} label="Mon fichier" />
      )}
      {!locked && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Fichier joint (facultatif)</p>
          <ContentAttachmentUploader
            kinds={["document", "pdf", "image"]}
            value={attachment}
            onChange={(next) => {
              setFormError(null);
              setAttachment(next);
            }}
            disabled={mutation.isPending}
            uploading={mutation.isPending}
            error={formError}
            requiredFileWhenNew={false}
            hasExistingFile={hasFile}
            existingLabel="Un fichier est déjà déposé. Déposez-en un autre pour le remplacer."
          />
        </div>
      )}
      {closed && (
        <p className="text-sm text-muted-foreground">La période de remise est terminée.</p>
      )}
      {!locked && (
        <>
          <p className="text-xs text-muted-foreground">
            Une réponse écrite, un fichier, ou les deux : au moins un élément est requis.
          </p>
          <Button
            disabled={(!text.trim() && !attachment.file) || mutation.isPending}
            onClick={() => {
              setFormError(null);
              if (attachment.file) {
                const fileError = validateFileForKind(attachment.file, attachment.kind);
                if (fileError) {
                  setFormError(fileError);
                  return;
                }
              }
              mutation.mutate();
            }}
          >
            Remettre mon devoir
          </Button>
        </>
      )}
      {submission?.status === "submitted" && (
        <p>Votre réponse est enregistrée et attend une correction.</p>
      )}
    </div>
  );
}

function SubmissionFileButton({
  submission,
  label = "Télécharger le fichier",
  size = "default",
}: {
  submission: Submission;
  label?: string;
  size?: "default" | "sm";
}) {
  const [loading, setLoading] = useState(false);
  if (!submission.file_path) return null;
  return (
    <Button
      variant="outline"
      size={size}
      disabled={loading}
      onClick={() => {
        setLoading(true);
        void AssignmentService.getSubmissionFileUrl(submission)
          .then((url) => window.open(url, "_blank", "noopener,noreferrer"))
          .catch((err: Error) => toast.error(err.message))
          .finally(() => setLoading(false));
      }}
    >
      {label}
    </Button>
  );
}

function isLateSubmission(submission: Submission | null, dueAt: string | null | undefined) {
  if (!submission?.submitted_at || !dueAt) return false;
  return new Date(submission.submitted_at).getTime() > new Date(dueAt).getTime();
}

export function AssignmentGrading({
  assignmentId,
  classId,
}: {
  assignmentId: string;
  classId: string;
}) {
  const roster = useClassRoster(classId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sequential, setSequential] = useState(false);
  const [seqIndex, setSeqIndex] = useState(0);
  const query = useQuery({
    queryKey: ["submissions", assignmentId],
    queryFn: () => Assignments.listSubmissions(assignmentId),
  });
  const assignmentQuery = useQuery({
    queryKey: ["assignment-grading", assignmentId],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("assignments")
        .select(
          "max_score, due_at, title, instructions, description, level:levels!assignments_level_id_fkey ( code )",
        )
        .eq("id", assignmentId)
        .single();
      if (error) throw error;
      return data as {
        max_score: number | null;
        due_at: string | null;
        title: string;
        instructions: string | null;
        description: string | null;
        level: { code: string } | null;
      };
    },
  });

  const dueAt = assignmentQuery.data?.due_at ?? null;
  const maxScore = assignmentQuery.data?.max_score ?? 100;
  const levelCode = assignmentQuery.data?.level?.code ?? null;
  const rows = (roster.data ?? []).map((student) => {
    const submission =
      (query.data ?? []).find((s) => s.student_id === student.id && s.status !== "draft") ?? null;
    return { student, submission, late: isLateSubmission(submission, dueAt) };
  });
  const toGrade = rows.filter((r) => r.submission && r.submission.status !== "graded");
  const counters = {
    total: rows.length,
    submitted: rows.filter((r) => r.submission).length,
    missing: rows.filter((r) => !r.submission).length,
    late: rows.filter((r) => r.late).length,
    graded: rows.filter((r) => r.submission?.status === "graded").length,
    toCorrect: toGrade.length,
  };

  const currentSeq = toGrade[Math.min(seqIndex, Math.max(0, toGrade.length - 1))] ?? null;

  return (
    <QueryState
      isLoading={query.isLoading || assignmentQuery.isLoading || roster.isLoading}
      isError={query.isError || assignmentQuery.isError || roster.isError}
      error={query.error ?? assignmentQuery.error ?? roster.error}
      isEmpty={!rows.length}
      emptyTitle="Aucun étudiant inscrit"
      emptyMessage="Inscrivez des étudiants dans ce groupe pour suivre les remises."
      onRetry={() => {
        void query.refetch();
        void assignmentQuery.refetch();
        void roster.refetch();
      }}
    >
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Remises du devoir</h3>
            <p className="text-sm text-muted-foreground">
              Limite : {formatFrDate(dueAt)} · Note maximale : {maxScore}
            </p>
          </div>
          <Button
            size="sm"
            disabled={!toGrade.length}
            onClick={() => {
              setSeqIndex(0);
              setSequential(true);
            }}
          >
            Corriger les remises
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total" value={counters.total} />
          <StatCard label="Remis" value={counters.submitted} tone="success" />
          <StatCard label="Non remis" value={counters.missing} tone="danger" />
          <StatCard label="En retard" value={counters.late} tone="warning" />
          <StatCard label="À corriger" value={counters.toCorrect} tone="warning" />
          <StatCard label="Corrigés" value={counters.graded} tone="info" />
        </div>

        {sequential && currentSeq?.submission ? (
          <Surface className="space-y-4 border-primary/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-semibold">Correction séquentielle</h4>
                <p className="text-sm text-muted-foreground">
                  {Math.min(seqIndex, toGrade.length - 1) + 1} / {toGrade.length} ·{" "}
                  {currentSeq.student.name}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSequential(false)}>
                Quitter
              </Button>
            </div>
            <GradeForm
              key={`${currentSeq.submission.id}-${currentSeq.submission.updated_at}-seq`}
              submission={currentSeq.submission}
              maxScore={maxScore}
              name={currentSeq.student.name}
              assignmentTitle={assignmentQuery.data?.title ?? ""}
              instructions={
                assignmentQuery.data?.instructions || assignmentQuery.data?.description || ""
              }
              levelCode={levelCode}
              sequential
              saved={async () => {
                await query.refetch();
              }}
            />
          </Surface>
        ) : sequential && !toGrade.length ? (
          <Surface className="p-4">
            <p className="text-sm text-muted-foreground">Toutes les remises sont corrigées.</p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              onClick={() => setSequential(false)}
            >
              Fermer
            </Button>
          </Surface>
        ) : null}

        <TableScroll>
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="sticky top-0 z-10 bg-card text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3 font-medium">Étudiant</th>
                <th className="p-3 font-medium">Remise</th>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Texte</th>
                <th className="p-3 font-medium">Fichier</th>
                <th className="p-3 font-medium">Note</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ student, submission, late }) => (
                <Fragment key={student.id}>
                  <tr className="border-b border-border align-middle">
                    <td className="p-3">
                      <AvatarName name={student.name} subtitle={student.email || null} size="sm" />
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {submission ? (
                          <Status tone={submission.status === "graded" ? "blue" : "green"}>
                            {submissionStatusLabel(submission.status)}
                          </Status>
                        ) : (
                          <Status tone="red">Non remis</Status>
                        )}
                        {late && <Status tone="amber">En retard</Status>}
                        {submission?.edited_after_due ? (
                          <Status tone="amber">Modifié après l’échéance</Status>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {formatFrDate(submission?.submitted_at)}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {submission?.content_text?.trim() ? "Oui" : "—"}
                    </td>
                    <td className="p-3">
                      {submission?.file_path ? (
                        <SubmissionFileButton
                          submission={submission}
                          label="Télécharger"
                          size="sm"
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {submission?.score != null ? `${submission.score} / ${maxScore}` : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!submission}
                        onClick={() => setExpanded(expanded === student.id ? null : student.id)}
                      >
                        {expanded === student.id ? "Fermer" : "Ouvrir"}
                      </Button>
                    </td>
                  </tr>
                  {expanded === student.id && submission && (
                    <tr className="border-b border-border bg-muted/30">
                      <td className="p-3" colSpan={7}>
                        <GradeForm
                          key={`${submission.id}-${submission.updated_at}`}
                          submission={submission}
                          maxScore={maxScore}
                          name={student.name}
                          assignmentTitle={assignmentQuery.data?.title ?? ""}
                          instructions={
                            assignmentQuery.data?.instructions ||
                            assignmentQuery.data?.description ||
                            ""
                          }
                          levelCode={levelCode}
                          saved={() => query.refetch()}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>
    </QueryState>
  );
}

function GradeForm({
  submission,
  maxScore,
  name,
  assignmentTitle,
  instructions,
  levelCode,
  saved,
  sequential = false,
}: {
  submission: Submission;
  maxScore: number;
  name: string;
  assignmentTitle?: string;
  instructions?: string;
  levelCode?: string | null;
  saved: () => Promise<unknown>;
  sequential?: boolean;
}) {
  const { user } = useAcademy();
  const [score, setScore] = useState(submission.score?.toString() ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<GradeAssistSuggestion | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const save = useGradeAssignment();

  const requestAi = async () => {
    setAiMessage(null);
    if (
      gradeAssistNeedsExploitableText(submission.content_text, Boolean(submission.file_path))
    ) {
      setAiSuggestion(null);
      setAiMessage(GRADE_ASSIST_NEEDS_TEXT_MESSAGE);
      return;
    }
    if (!submission.content_text?.trim()) {
      setAiSuggestion(null);
      setAiMessage(GRADE_ASSIST_NEEDS_TEXT_MESSAGE);
      return;
    }

    setAiBusy(true);
    try {
      const outcome = await GradeAssistService.suggest({
        level: levelCode ?? null,
        subject: assignmentTitle ?? "Devoir",
        instructions: instructions ?? "",
        response: submission.content_text ?? "",
        maxScore,
        targetKind: "assignment",
        targetId: submission.id,
        studentId: submission.student_id,
      });
      if (!outcome.ok) {
        setAiSuggestion(null);
        setAiMessage(outcome.message);
        return;
      }
      setAiSuggestion(outcome.suggestion);
      setAiMessage(null);
    } catch (err) {
      setAiSuggestion(null);
      setAiMessage(err instanceof Error ? err.message : "Suggestion indisponible");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{name}</h3>
        {submission.edited_after_due ? (
          <Status tone="amber">Modifié après l’échéance</Status>
        ) : null}
      </div>
      {submission.submitted_at ? (
        <p className="text-sm text-muted-foreground">
          Remis le {formatFrDate(submission.submitted_at)}
        </p>
      ) : null}
      <div>
        <p className="text-sm text-muted-foreground">Réponse écrite</p>
        <p className="whitespace-pre-wrap">
          {submission.content_text || "Aucune réponse textuelle"}
        </p>
      </div>
      {submission.file_path && <SubmissionFileButton submission={submission} size="sm" />}
      <label className="block text-sm">
        Note / {maxScore}
        <Input
          className="mt-1"
          type="number"
          min={0}
          max={maxScore}
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Retour au participant
        <Textarea className="mt-1" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </label>
      <AiGradeAssistPanel
        busy={aiBusy}
        disabled={save.isPending}
        suggestion={aiSuggestion}
        statusMessage={aiMessage}
        maxScore={maxScore}
        onRequest={() => void requestAi()}
        onUse={() => {
          if (!aiSuggestion) return;
          setScore(String(aiSuggestion.suggested_score));
          setFeedback(aiSuggestion.feedback);
          toast.message("Proposition appliquée — vérifiez puis enregistrez la correction.");
        }}
        onRegenerate={() => void requestAi()}
        onIgnore={() => {
          setAiSuggestion(null);
          setAiMessage(null);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            !score.trim() ||
            !Number.isFinite(Number(score)) ||
            Number(score) < 0 ||
            Number(score) > maxScore ||
            save.isPending
          }
          onClick={() =>
            save.mutate(
              {
                submissionId: submission.id,
                score: Number(score),
                feedback,
                gradedBy: user?.id ?? null,
                assignmentId: submission.assignment_id,
              },
              {
                onSuccess: async () => {
                  await saved();
                  toast.success(
                    sequential ? "Correction enregistrée — suivant" : "Correction enregistrée",
                  );
                },
                onError: (e: Error) => toast.error(e.message),
              },
            )
          }
        >
          {sequential
            ? "Enregistrer et suivant"
            : submission.status === "graded"
              ? "Mettre à jour la correction"
              : "Marquer comme corrigé"}
        </Button>
      </div>
    </div>
  );
}

export function AcademyCalendar() {
  const { navigate, role } = useAcademy();
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState<"week" | "month">("week");
  const live = useQuery({
    queryKey: ["calendar", "live"],
    queryFn: () => SupabaseLiveSessionService.list(),
  });
  const assignments = useQuery({
    queryKey: ["calendar", "assignments"],
    queryFn: () => Assignments.list(),
  });
  const start = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    mode === "month" ? 1 : anchor.getDate() - ((anchor.getDay() + 6) % 7),
  );
  const end = new Date(start);
  if (mode === "month") end.setMonth(end.getMonth() + 1);
  else end.setDate(end.getDate() + 7);
  const events = [
    ...(live.data ?? [])
      .filter((s) => s.status !== "cancelled")
      .map((s) => ({
        id: s.id,
        date: s.starts_at,
        title: s.title,
        kind: "live" as const,
        subtitle: `${s.class?.name ?? "—"} · ${s.class?.level?.code ?? "—"} · En ligne`,
      })),
    ...(assignments.data ?? [])
      .filter((a) => a.due_at)
      .map((a) => ({
        id: a.id,
        date: a.due_at!,
        title: a.title,
        kind: "assignment" as const,
        subtitle: "Échéance du devoir",
      })),
  ]
    .filter((e) => new Date(e.date) >= start && new Date(e.date) < end)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const move = (direction: number) => {
    const next = new Date(anchor);
    if (mode === "month") next.setMonth(next.getMonth() + direction, 1);
    else next.setDate(next.getDate() + direction * 7);
    setAnchor(next);
  };
  return (
    <>
      <PageHeader
        title="Calendrier"
        subtitle={`${start.toLocaleDateString()} — ${new Date(end.getTime() - 1).toLocaleDateString()}`}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => move(-1)}>
          ← Précédent
        </Button>
        <Button variant="outline" onClick={() => setAnchor(new Date())}>
          Aujourd’hui
        </Button>
        <Button variant="outline" onClick={() => move(1)}>
          Suivant →
        </Button>
        <Button variant={mode === "week" ? "default" : "outline"} onClick={() => setMode("week")}>
          Semaine
        </Button>
        <Button variant={mode === "month" ? "default" : "outline"} onClick={() => setMode("month")}>
          Mois
        </Button>
      </div>
      <QueryState
        isLoading={live.isLoading || assignments.isLoading}
        isError={live.isError || assignments.isError}
        error={live.error ?? assignments.error}
        isEmpty={!events.length}
        emptyTitle="Aucun événement sur cette période"
        emptyMessage="Les séances planifiées et les échéances des devoirs apparaissent ici."
        onRetry={() => {
          void live.refetch();
          void assignments.refetch();
        }}
      >
        <div className="space-y-3">
          {events.map((e) => (
            <Surface
              key={`${e.kind}-${e.id}`}
              className="flex flex-wrap items-center justify-between gap-3 p-5"
            >
              <div>
                <p className="text-sm text-muted-foreground">{new Date(e.date).toLocaleString()}</p>
                <h2 className="font-semibold">{e.title}</h2>
                <p>{e.subtitle}</p>
              </div>
              <Button
                variant={e.kind === "live" ? "default" : "outline"}
                onClick={() => {
                  if (e.kind !== "live") {
                    if (role === "student") navigate("assignment-detail", { assignmentId: e.id });
                    else navigate("assignments");
                    return;
                  }
                  void LiveSessionService.joinTarget(e.id)
                    .then((target) => {
                      if (target.provider === "zoom") {
                        const href =
                          role === "student" ? target.url : target.start_url || target.url;
                        if (!href) throw new Error("La réunion Zoom n’est pas encore prête.");
                        openExternalMeeting(href);
                        return;
                      }
                      setLiveSessionId(e.id);
                      navigate("meeting");
                    })
                    .catch((err: Error) => toast.error(err.message));
                }}
              >
                {e.kind === "live" ? "Rejoindre le cours" : "Consulter"}
              </Button>
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}

export function AuditPage() {
  const query = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("audit_logs")
        .select("id, actor_id, action, entity_type, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  return (
    <>
      <PageHeader
        title="Journal d’activité"
        subtitle="Les 100 dernières actions enregistrées par le serveur."
      />
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={!query.data?.length}
        emptyTitle="Aucune action enregistrée"
        onRetry={() => void query.refetch()}
      >
        <Surface className="divide-y">
          {query.data?.map((row) => (
            <div key={row.id} className="p-4">
              <p>
                {row.action} · {row.entity_type}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(row.created_at).toLocaleString()} · {row.actor_id ?? "Système"}
              </p>
            </div>
          ))}
        </Surface>
      </QueryState>
    </>
  );
}
