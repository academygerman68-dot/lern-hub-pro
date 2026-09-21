import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  assignmentCtaLabel,
  assignmentUxLabel,
  assignmentUxTone,
  formatAssignmentActivity,
  resolveAssignmentUxStatus,
  type AssignmentUxStatus,
} from "@/lib/assignment-ux";
import { queryKeys } from "@/lib/query-keys";
import { resolveOwnStudent } from "@/lib/payment-proof";
import { AssignmentService } from "@/services/academy-services";
import { useAssignmentRows, useStudents, useSubmitAssignment } from "@/hooks/use-academy-data";
import { ContentAttachmentUploader, type AttachmentDraft } from "./content-attachment-uploader";
import { DocumentViewer } from "./document-viewer";
import { PageHeader, Status, Surface } from "./primitives";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";

export function Assignments({ detail }: { detail: boolean }) {
  const { navigate, user, profile } = useAcademy();
  const search = useSearch({ from: "/app/$role/$page" });
  const studentsQuery = useStudents();
  const myStudent = resolveOwnStudent(studentsQuery.data ?? [], {
    profileId: profile?.id ?? user?.id ?? null,
    email: user?.email ?? null,
  });
  const listQuery = useAssignmentRows(myStudent?.classId);
  const submit = useSubmitAssignment();
  const published = useMemo(
    () => (listQuery.data ?? []).filter((row) => row.status === "published"),
    [listQuery.data],
  );
  const selected =
    published.find((a) => a.id === search.assignmentId) ?? (detail ? published[0] : undefined);

  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentDraft>({
    kind: "document",
    url: "",
    file: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    title: string;
    url: string | null;
    mimeType: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  const submissionsQuery = useQuery({
    queryKey: queryKeys.submissions.byStudent(myStudent?.id ?? ""),
    queryFn: () => AssignmentService.listSubmissionsForStudent(myStudent!.id),
    enabled: Boolean(myStudent?.id),
  });

  const submissionByAssignment = useMemo(() => {
    const map = new Map<string, NonNullable<typeof submissionsQuery.data>[number]>();
    for (const row of submissionsQuery.data ?? []) {
      if (!map.has(row.assignment_id)) map.set(row.assignment_id, row);
    }
    return map;
  }, [submissionsQuery.data]);

  const selectedSubmission = selected ? (submissionByAssignment.get(selected.id) ?? null) : null;

  useEffect(() => {
    setText(selectedSubmission?.content_text ?? "");
    setAttachment({ kind: "document", url: "", file: null });
    setFormError(null);
    setEditing(false);
  }, [
    selected?.id,
    selectedSubmission?.content_text,
    selectedSubmission?.updated_at,
    selectedSubmission?.version,
  ]);

  const uxFor = (assignmentId: string, dueAt: string | null | undefined): AssignmentUxStatus =>
    resolveAssignmentUxStatus({
      submission: submissionByAssignment.get(assignmentId) ?? null,
      dueAt: dueAt ?? null,
    });

  if (detail) {
    const submission = selectedSubmission;
    const ux = resolveAssignmentUxStatus({
      submission,
      dueAt: selected?.due_at ?? null,
    });
    const hasBeenSubmitted = Boolean(
      submission?.submitted_at ||
      submission?.status === "submitted" ||
      submission?.status === "graded",
    );
    const canEdit =
      Boolean(selected && selected.status === "published" && myStudent?.id) &&
      (editing || !hasBeenSubmitted);
    const showModifyCta = hasBeenSubmitted && !editing;

    return (
      <>
        <button
          type="button"
          onClick={() => navigate("assignments")}
          className="mb-5 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Devoirs
        </button>
        <PageHeader
          title={selected?.title ?? "Devoir"}
          subtitle={
            selected
              ? `${selected.level?.code ?? "—"} · Échéance ${selected.due_at ? new Date(selected.due_at).toLocaleString("fr-FR") : "—"}`
              : "Consigne, pièce jointe et remise."
          }
        />
        <QueryState
          isLoading={listQuery.isLoading || studentsQuery.isLoading || submissionsQuery.isLoading}
          isError={listQuery.isError || studentsQuery.isError || submissionsQuery.isError}
          error={listQuery.error ?? studentsQuery.error ?? submissionsQuery.error}
          isEmpty={!selected}
          emptyTitle="Devoir introuvable"
          emptyMessage="Sélectionnez un devoir depuis la liste."
          onRetry={() => {
            void listQuery.refetch();
            void submissionsQuery.refetch();
          }}
        >
          {selected ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-5">
                <Surface className="space-y-4 p-6">
                  <h2 className="text-base font-semibold tracking-tight">1. Consigne</h2>
                  <p className="text-xs text-muted-foreground">Instructions du professeur</p>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                    {selected.instructions ||
                      selected.description ||
                      "Suivez les consignes données par votre professeur."}
                  </p>
                  {(selected.content_url || selected.attachment_path) && (
                    <div className="space-y-2 border-t border-border/70 pt-4">
                      <h3 className="text-sm font-semibold">2. Documents</h3>
                      <p className="text-xs text-muted-foreground">Pièces jointes à consulter</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPreview({
                              title: selected.title,
                              url: null,
                              mimeType: selected.mime_type,
                              loading: true,
                              error: null,
                            });
                            void AssignmentService.getAttachmentUrl(selected)
                              .then((url) => {
                                if (selected.content_kind === "link") {
                                  window.open(url, "_blank", "noopener,noreferrer");
                                  setPreview(null);
                                  return;
                                }
                                setPreview({
                                  title: selected.title,
                                  url,
                                  mimeType: selected.mime_type,
                                  loading: false,
                                  error: null,
                                });
                              })
                              .catch((err: Error) =>
                                setPreview({
                                  title: selected.title,
                                  url: null,
                                  mimeType: selected.mime_type,
                                  loading: false,
                                  error: err.message,
                                }),
                              );
                          }}
                        >
                          Voir
                        </Button>
                        {selected.content_kind !== "link" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void (async () => {
                                try {
                                  const url = await AssignmentService.getAttachmentUrl(selected);
                                  const response = await fetch(url);
                                  const blob = await response.blob();
                                  const objectUrl = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = objectUrl;
                                  a.download = selected.title;
                                  a.click();
                                  URL.revokeObjectURL(objectUrl);
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
                        )}
                      </div>
                    </div>
                  )}
                </Surface>

                <Surface className="space-y-4 p-6">
                  <h2 className="text-base font-semibold tracking-tight">3. Ma réponse</h2>
                  <p className="text-xs text-muted-foreground">Texte et/ou fichier à remettre</p>
                  {!myStudent?.id ? (
                    <p className="text-sm text-destructive">Profil étudiant introuvable.</p>
                  ) : (
                    <>
                      {showModifyCta ? (
                        <div className="space-y-3">
                          <p className="whitespace-pre-wrap text-sm leading-6">
                            {submission?.content_text?.trim() || "Aucune réponse textuelle."}
                          </p>
                          {submission?.file_path ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void (async () => {
                                  try {
                                    const url =
                                      await AssignmentService.getSubmissionFileUrl(submission);
                                    window.open(url, "_blank", "noopener,noreferrer");
                                  } catch (err) {
                                    toast.error(
                                      err instanceof Error ? err.message : "Fichier indisponible",
                                    );
                                  }
                                })()
                              }
                            >
                              Voir mon fichier
                            </Button>
                          ) : null}
                          <Button onClick={() => setEditing(true)}>Modifier ma réponse</Button>
                          {submission?.status === "graded" ? (
                            <p className="text-xs text-muted-foreground">
                              Une modification après correction renverra le devoir en « Remis ».
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <label className="block text-sm">
                            Réponse écrite
                            <Textarea
                              className="mt-2 min-h-40 text-base"
                              value={text}
                              disabled={!canEdit || submit.isPending}
                              onChange={(e) => setText(e.target.value)}
                              placeholder="Rédigez votre réponse ici…"
                            />
                          </label>
                          {canEdit ? (
                            <div className="rounded-xl border-2 border-dashed border-primary/25 bg-primary/[0.03] p-3">
                              <ContentAttachmentUploader
                                kinds={["document", "pdf", "image"]}
                                value={attachment}
                                onChange={setAttachment}
                                disabled={submit.isPending}
                                uploading={submit.isPending}
                                error={formError}
                                requiredFileWhenNew={false}
                              />
                            </div>
                          ) : null}
                          {submission?.file_path && !attachment.file ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void (async () => {
                                  try {
                                    const url =
                                      await AssignmentService.getSubmissionFileUrl(submission);
                                    window.open(url, "_blank", "noopener,noreferrer");
                                  } catch (err) {
                                    toast.error(
                                      err instanceof Error ? err.message : "Fichier indisponible",
                                    );
                                  }
                                })()
                              }
                            >
                              Voir mon fichier
                            </Button>
                          ) : null}
                          {canEdit ? (
                            <div className="flex flex-wrap gap-2">
                              {editing ? (
                                <Button
                                  variant="outline"
                                  disabled={submit.isPending}
                                  onClick={() => {
                                    setEditing(false);
                                    setText(submission?.content_text ?? "");
                                    setAttachment({ kind: "document", url: "", file: null });
                                    setFormError(null);
                                  }}
                                >
                                  Annuler
                                </Button>
                              ) : null}
                              <Button
                                className="min-w-40"
                                disabled={
                                  submit.isPending ||
                                  (!text.trim() && !attachment.file && !submission?.file_path)
                                }
                                onClick={() => {
                                  if (!myStudent?.id) return;
                                  setFormError(null);
                                  if (!text.trim() && !attachment.file && !submission?.file_path) {
                                    setFormError("Ajoutez une réponse écrite ou un fichier.");
                                    return;
                                  }
                                  submit.mutate(
                                    {
                                      assignmentId: selected.id,
                                      studentId: myStudent.id,
                                      contentText: text.trim(),
                                      dueAt: selected.due_at,
                                      ...(attachment.file ? { file: attachment.file } : {}),
                                    },
                                    {
                                      onSuccess: () => {
                                        toast.success(
                                          hasBeenSubmitted ? "Réponse mise à jour" : "Devoir remis",
                                        );
                                        setEditing(false);
                                        void submissionsQuery.refetch();
                                      },
                                      onError: (err) => {
                                        setFormError(err.message);
                                        toast.error(err.message);
                                      },
                                    },
                                  );
                                }}
                              >
                                {hasBeenSubmitted ? "Remettre" : "Remettre le devoir"}
                              </Button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </>
                  )}
                </Surface>
              </div>

              <Surface className="h-fit space-y-4 p-6">
                <h2 className="text-base font-semibold tracking-tight">4. Statut / correction</h2>
                <p className="text-xs text-muted-foreground">Suivi de votre remise</p>
                <div className="flex flex-wrap gap-2">
                  <Status tone={assignmentUxTone(ux)}>{assignmentUxLabel(ux)}</Status>
                  {submission?.edited_after_due ? (
                    <Status tone="amber">Modifié après l’échéance</Status>
                  ) : null}
                </div>
                {submission ? (
                  <div className="space-y-2 text-sm">
                    {submission.submitted_at ? (
                      <p className="text-muted-foreground">
                        Remis le {new Date(submission.submitted_at).toLocaleString("fr-FR")}
                      </p>
                    ) : null}
                    {(submission.last_edited_at ?? submission.updated_at) ? (
                      <p className="text-muted-foreground">
                        Dernière modif{" "}
                        {new Date(
                          submission.last_edited_at ?? submission.updated_at,
                        ).toLocaleString("fr-FR")}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground">
                      Version {Number(submission.version ?? 1)}
                    </p>
                    {submission.status === "graded" ? (
                      <div className="space-y-2 border-t border-border/70 pt-3">
                        {submission.score != null ? (
                          <p className="font-medium">
                            Note : {submission.score}
                            {selected.max_score != null ? ` / ${selected.max_score}` : ""}
                          </p>
                        ) : null}
                        {submission.feedback ? (
                          <p className="whitespace-pre-wrap">Commentaire : {submission.feedback}</p>
                        ) : null}
                        {submission.file_path ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void (async () => {
                                try {
                                  const url =
                                    await AssignmentService.getSubmissionFileUrl(submission);
                                  window.open(url, "_blank", "noopener,noreferrer");
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error ? err.message : "Fichier indisponible",
                                  );
                                }
                              })()
                            }
                          >
                            Voir le fichier remis
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune remise pour l’instant.</p>
                )}
              </Surface>
            </div>
          ) : null}
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

  return (
    <>
      <PageHeader
        title="Devoirs"
        subtitle="Consultez les consignes, remettez et suivez vos notes."
      />
      <QueryState
        isLoading={listQuery.isLoading || submissionsQuery.isLoading}
        isError={listQuery.isError || submissionsQuery.isError}
        error={listQuery.error ?? submissionsQuery.error}
        isEmpty={!published.length}
        emptyTitle="Aucun devoir"
        emptyMessage="Les devoirs publiés apparaîtront ici."
        onRetry={() => {
          void listQuery.refetch();
          void submissionsQuery.refetch();
        }}
      >
        <div className="space-y-3 md:hidden">
          {published.map((row) => {
            const submission = submissionByAssignment.get(row.id);
            const ux = uxFor(row.id, row.due_at);
            return (
              <Surface key={row.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{row.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Échéance {row.due_at ? new Date(row.due_at).toLocaleString("fr-FR") : "—"}
                    </p>
                  </div>
                  <Status tone={assignmentUxTone(ux)}>{assignmentUxLabel(ux)}</Status>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dernière activité : {formatAssignmentActivity(submission)}
                </p>
                {ux === "graded" && submission?.score != null ? (
                  <p className="text-sm">
                    Note : {submission.score}
                    {row.max_score != null ? ` / ${row.max_score}` : ""}
                  </p>
                ) : null}
                <Button
                  size="sm"
                  onClick={() => navigate("assignment-detail", { assignmentId: row.id })}
                >
                  {assignmentCtaLabel(ux)}
                </Button>
              </Surface>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Devoir</th>
                <th>Échéance</th>
                <th>Statut</th>
                <th>Dernière activité</th>
                <th>Note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {published.map((row) => {
                const submission = submissionByAssignment.get(row.id);
                const ux = uxFor(row.id, row.due_at);
                return (
                  <tr key={row.id}>
                    <td className="font-medium">{row.title}</td>
                    <td>{row.due_at ? new Date(row.due_at).toLocaleString("fr-FR") : "—"}</td>
                    <td>
                      <Status tone={assignmentUxTone(ux)}>{assignmentUxLabel(ux)}</Status>
                    </td>
                    <td className="text-muted-foreground">
                      {formatAssignmentActivity(submission)}
                    </td>
                    <td>
                      {ux === "graded" && submission?.score != null
                        ? `${submission.score}${row.max_score != null ? ` / ${row.max_score}` : ""}`
                        : "—"}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate("assignment-detail", { assignmentId: row.id })}
                      >
                        {assignmentCtaLabel(ux)}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </QueryState>
    </>
  );
}
