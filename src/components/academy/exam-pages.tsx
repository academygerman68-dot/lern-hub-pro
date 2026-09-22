import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Flag, Headphones } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useArchiveExam,
  useAllExams,
  useAcademicAccess,
  useClasses,
  useCreateExam,
  useExam,
  useExamAnswers,
  useExamAttempt,
  useExamAttemptReview,
  useExamAttemptsForExam,
  useExamResult,
  useGradeWritingAnswer,
  useLevels,
  useMyExamAttempts,
  usePublishExam,
  usePublishedExams,
  useSaveExamAnswer,
  useStartExam,
  useSubmitExam,
  useUploadOralExamAnswer,
} from "@/hooks/use-academy-data";
import { ExamService, GradeAssistService } from "@/services/academy-services";
import type { GradeAssistSuggestion } from "@/services/supabase/grade-assist-service";
import type { Json } from "@/types/database";
import { ExamParticipantRosterPanel } from "./exam-participant-roster";
import { ExamOralAnswerComposer } from "./exam-oral-recorder";
import {
  formatFrDate,
  isFileContentKind,
  isTextContentKind,
  isValidHttpUrl,
  MEDIA_KIND_LABELS,
  validateFileForKind,
  validateTextContentBody,
  type MediaKind,
} from "@/lib/academic-content";
import {
  buildTeacherScope,
  hideArchivedStatus,
  isDirectorRole,
  scopedClassOrLevelItemVisible,
} from "@/lib/academy-logic";
import {
  canRetakeExam,
  countCompletedExamAttempts,
  countWritingStats,
  examAttemptsLeft,
  isManualQuestionType,
  studentExamProgressLabel,
} from "@/lib/exam-writing";
import {
  hasOralAudioAnswer,
  isSpeakingQuestionType,
  isWritingOnlyQuestionType,
  ORAL_RUBRIC_LABELS,
  oralRubricFromMeta,
  parseOralAnswer,
} from "@/lib/exam-oral";
import { examCatalogAction } from "@/lib/exam-labels";
import {
  applySuggestionToWritingRubric,
  formatGradeAssistRubric,
  GRADE_ASSIST_NEEDS_TEXT_MESSAGE,
} from "@/lib/grade-assist-ux";
import { AiGradeAssistPanel } from "./ai-grade-assist-panel";
import { ContentAttachmentUploader, type AttachmentDraft } from "./content-attachment-uploader";
import { ExamBuilder } from "./exam-builder";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import { PageHeader, Status, Surface, ProgressLine } from "./primitives";

const EXAM_ID_KEY = "ga_active_exam_id";
const ATTEMPT_ID_KEY = "ga_active_attempt_id";

const SKILL_LABELS: Record<string, string> = {
  lesen: "Lesen",
  hoeren: "Hören",
  schreiben: "Schreiben",
  sprechen: "Expression orale",
  grammatik: "Grammaire",
  wortschatz: "Vocabulaire",
};

const RUBRIC_LABELS: Record<string, string> = {
  ...ORAL_RUBRIC_LABELS,
  task_completion: "Réalisation de la tâche",
  comprehensibility: "Compréhensibilité",
  vocabulary: "Vocabulaire",
  grammar_and_spelling: "Grammaire et orthographe",
};

function persistExamSession(examId: string, attemptId: string) {
  sessionStorage.setItem(EXAM_ID_KEY, examId);
  sessionStorage.setItem(ATTEMPT_ID_KEY, attemptId);
}

function readExamSession() {
  return {
    examId: sessionStorage.getItem(EXAM_ID_KEY),
    attemptId: sessionStorage.getItem(ATTEMPT_ID_KEY),
  };
}

function formatRemaining(expiresAt: string | null | undefined) {
  if (!expiresAt) return "—";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function answerValue(answer: Json | null | undefined): string {
  if (answer === null || answer === undefined) return "";
  if (typeof answer === "string") return answer;
  if (typeof answer === "number" || typeof answer === "boolean") return String(answer);
  return JSON.stringify(answer);
}

function questionMeta(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function formFillAnswer(answer: Json | null | undefined): Record<string, string> {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(answer)) {
    out[key] = value == null ? "" : String(value);
  }
  return out;
}

function shortBankId(bankQuestionId: string | null | undefined, fallback: string) {
  if (!bankQuestionId) return fallback;
  const parts = bankQuestionId.split("-");
  return parts[parts.length - 1] ?? bankQuestionId;
}

function progressTone(label: ReturnType<typeof studentExamProgressLabel>) {
  if (label === "Terminé") return "green" as const;
  if (label === "En cours") return "amber" as const;
  if (label === "En attente de correction") return "amber" as const;
  return "gray" as const;
}

export function StudentExamsPage({ mode }: { mode: string }) {
  if (mode === "mock-exam") return <StudentExamRunner />;
  if (mode === "exam-result") return <StudentExamResult />;
  return <StudentExamCatalog />;
}

function StudentExamCatalog() {
  const { navigate } = useAcademy();
  const examsQuery = usePublishedExams();
  const attemptsQuery = useMyExamAttempts();
  const startExam = useStartExam();
  const accessQuery = useAcademicAccess();

  const latestByExam = useMemo(() => {
    const map = new Map<string, NonNullable<typeof attemptsQuery.data>[number]>();
    for (const attempt of attemptsQuery.data ?? []) {
      if (!map.has(attempt.exam_id)) map.set(attempt.exam_id, attempt);
    }
    return map;
  }, [attemptsQuery]);

  if (accessQuery.data === false) {
    return (
      <>
        <PageHeader title="Examens blancs" subtitle="Examens publiés pour votre niveau." />
        <Surface className="space-y-3 p-6">
          <h2 className="font-semibold">Accès académique indisponible</h2>
          <p className="text-sm text-muted-foreground">
            Un abonnement actif est nécessaire pour passer un examen.
          </p>
          <Button onClick={() => navigate("payments")}>Mes paiements</Button>
        </Surface>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Examens blancs"
        subtitle="Uniquement les examens de votre niveau, avec consignes et documents."
      />
      <QueryState
        isLoading={examsQuery.isLoading || attemptsQuery.isLoading || accessQuery.isLoading}
        isError={examsQuery.isError || attemptsQuery.isError || accessQuery.isError}
        error={(examsQuery.error ?? attemptsQuery.error ?? accessQuery.error) as Error | null}
        isEmpty={!examsQuery.data?.length}
        emptyTitle="Aucun examen disponible"
        emptyMessage="Les examens blancs de votre niveau apparaîtront ici."
        onRetry={() => {
          void examsQuery.refetch();
          void attemptsQuery.refetch();
          void accessQuery.refetch();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {examsQuery.data?.map((exam) => {
            const latest = latestByExam.get(exam.id);
            const hasUngradedWriting =
              latest?.status === "submitted" || latest?.status === "expired";
            const catalog = examCatalogAction({
              latestStatus: latest?.status,
              hasUngradedWriting,
            });
            const progressLabel = catalog.label;
            const maxAttempts = Math.max(1, Number(exam.max_attempts ?? 3));
            const completedAttempts = countCompletedExamAttempts(attemptsQuery.data ?? [], exam.id);
            const attemptsLeft = examAttemptsLeft(completedAttempts, maxAttempts);
            const allowRetake = canRetakeExam({
              latestStatus: latest?.status,
              completedAttempts,
              maxAttempts,
            });
            const launchExam = () => {
              startExam.mutate(exam.id, {
                onSuccess: (attempt) => {
                  persistExamSession(exam.id, attempt.id);
                  navigate("mock-exam");
                },
                onError: (err) => toast.error(err.message),
              });
            };
            return (
              <Surface className="p-6" key={exam.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {exam.level?.code ?? "—"}
                      {exam.class?.name ? ` · ${exam.class.name}` : " · Niveau entier"} ·{" "}
                      {exam.duration_minutes} min
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">{exam.title}</h2>
                    {exam.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">{exam.description}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-muted-foreground">
                      Durée : {exam.duration_minutes} min
                      {exam.starts_at ? ` · Début ${formatFrDate(exam.starts_at)}` : ""}
                      {exam.ends_at ? ` · Fin ${formatFrDate(exam.ends_at)}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tentatives : {completedAttempts}/{maxAttempts}
                      {attemptsLeft > 0
                        ? ` · ${attemptsLeft} restante${attemptsLeft > 1 ? "s" : ""}`
                        : ""}
                    </p>
                  </div>
                  <Status tone={progressTone(progressLabel)}>{progressLabel}</Status>
                </div>
                {latest && (catalog.action === "final" || catalog.action === "provisional") ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {catalog.action === "final" && latest.percentage != null
                      ? `Score : ${Number(latest.percentage).toFixed(0)} %`
                      : catalog.action === "provisional"
                        ? "Score partiel disponible — correction manuelle en attente"
                        : null}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  {(exam.content_url || exam.storage_path) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        void ExamService.getExamMaterialUrl(exam)
                          .then((url) => {
                            window.open(url, "_blank", "noopener,noreferrer");
                          })
                          .catch((err: Error) => toast.error(err.message));
                      }}
                    >
                      Ouvrir le document
                    </Button>
                  )}
                  {catalog.action === "start" ? (
                    <Button disabled={startExam.isPending} onClick={launchExam}>
                      {catalog.cta}
                    </Button>
                  ) : null}
                  {catalog.action === "resume" && latest?.status === "in_progress" ? (
                    <Button
                      disabled={startExam.isPending}
                      onClick={() => {
                        persistExamSession(exam.id, latest.id);
                        navigate("mock-exam");
                      }}
                    >
                      {catalog.cta}
                    </Button>
                  ) : null}
                  {catalog.action === "provisional" || catalog.action === "final" ? (
                    <>
                      {latest ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            persistExamSession(exam.id, latest.id);
                            navigate("exam-result");
                          }}
                        >
                          {catalog.cta}
                        </Button>
                      ) : null}
                      {allowRetake ? (
                        <Button disabled={startExam.isPending} onClick={launchExam}>
                          Repasser le test
                        </Button>
                      ) : (
                        <Button variant="secondary" disabled>
                          Tentatives épuisées
                        </Button>
                      )}
                    </>
                  ) : null}
                </div>
              </Surface>
            );
          })}
        </div>
      </QueryState>
    </>
  );
}

function StudentExamRunner() {
  const { navigate } = useAcademy();
  const session = readExamSession();
  const examQuery = useExam(session.examId);
  const attemptQuery = useExamAttempt(session.attemptId);
  const answersQuery = useExamAnswers(session.attemptId);
  const saveAnswer = useSaveExamAnswer();
  const uploadOral = useUploadOralExamAnswer();
  const submitExam = useSubmitExam();
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [localAnswers, setLocalAnswers] = useState<Record<string, Json>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [oralPreviewUrls, setOralPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const next: Record<string, Json> = {};
    const flags: Record<string, boolean> = {};
    for (const row of answersQuery.data ?? []) {
      next[row.question_id] = row.answer;
      flags[row.question_id] = row.flagged;
    }
    setLocalAnswers(next);
    setFlagged(flags);

    let cancelled = false;
    void (async () => {
      const urls: Record<string, string> = {};
      for (const row of answersQuery.data ?? []) {
        if (!hasOralAudioAnswer(row)) continue;
        try {
          const signed = await ExamService.getAnswerAudioSignedUrl(row);
          if (signed) urls[row.question_id] = signed;
        } catch {
          /* ignore preview errors while typing */
        }
      }
      if (!cancelled) setOralPreviewUrls(urls);
    })();
    return () => {
      cancelled = true;
    };
  }, [answersQuery.data]);

  const questions = useMemo(
    () =>
      (examQuery.data?.sections ?? []).flatMap((section) =>
        (section.questions ?? []).map((q) => ({
          ...q,
          skill: section.skill,
          sectionTitle: section.title,
        })),
      ),
    [examQuery.data],
  );

  const current = questions[index];
  const currentMeta = current ? questionMeta(current.metadata) : {};
  const remaining = formatRemaining(attemptQuery.data?.expires_at);
  const expired =
    attemptQuery.data?.expires_at != null &&
    new Date(attemptQuery.data.expires_at).getTime() <= now;

  useEffect(() => {
    if (!expired || !session.attemptId || submitExam.isPending) return;
    if (attemptQuery.data?.status !== "in_progress") return;
    submitExam.mutate(session.attemptId, {
      onSuccess: () => {
        toast.message("Temps écoulé — examen envoyé");
        navigate("exam-result");
      },
    });
  }, [expired, session.attemptId, attemptQuery.data?.status, submitExam, navigate]);

  const persist = (questionId: string, answer: Json, isFlagged?: boolean) => {
    if (!session.attemptId) return;
    saveAnswer.mutate({
      attemptId: session.attemptId,
      questionId,
      answer,
      flagged: isFlagged ?? flagged[questionId] ?? false,
    });
  };

  const isSpeakingType = current ? isSpeakingQuestionType(current.type) : false;
  const isWritingType = current ? isWritingOnlyQuestionType(current.type) : false;
  const isFormFill = current?.type === "form_fill";
  const writingText = isWritingType && current ? answerValue(localAnswers[current.id]) : "";
  const writingStats = countWritingStats(writingText);
  const formFillDraft = isFormFill && current ? formFillAnswer(localAnswers[current.id]) : {};
  const formFillSerialized = JSON.stringify(formFillDraft);

  useEffect(() => {
    if (!current || !session.attemptId) return;
    if (!isManualQuestionType(current.type)) return;
    const value = localAnswers[current.id];
    if (value === undefined) return;
    const timer = window.setTimeout(() => {
      persist(current.id, value);
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce local draft only
  }, [current?.id, current?.type, writingText, session.attemptId]);

  useEffect(() => {
    if (!current || !session.attemptId || current.type !== "form_fill") return;
    const value = localAnswers[current.id];
    if (value === undefined) return;
    const timer = window.setTimeout(() => {
      persist(current.id, value);
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce form_fill draft
  }, [current?.id, current?.type, formFillSerialized, session.attemptId]);

  if (!session.examId || !session.attemptId) {
    return (
      <Surface className="p-8 text-center">
        <p className="text-muted-foreground">Aucune session d’examen en cours.</p>
        <Button className="mt-4" onClick={() => navigate("exams")}>
          Retour aux examens
        </Button>
      </Surface>
    );
  }

  const instruction =
    typeof currentMeta["instruction"] === "string" ? currentMeta["instruction"] : null;
  const passage = typeof currentMeta["passage"] === "string" ? currentMeta["passage"] : null;
  const audioUrl = typeof currentMeta["audio_url"] === "string" ? currentMeta["audio_url"] : null;
  const requirements = Array.isArray(currentMeta["requirements"])
    ? currentMeta["requirements"].filter((item): item is string => typeof item === "string")
    : [];
  const recommendedWords =
    typeof currentMeta["recommended_words"] === "string" ? currentMeta["recommended_words"] : null;
  const formFields = Array.isArray(currentMeta["fields"])
    ? currentMeta["fields"].filter(
        (field): field is { key: string; points: number } =>
          Boolean(field) &&
          typeof field === "object" &&
          typeof (field as { key?: unknown }).key === "string",
      )
    : [];

  return (
    <QueryState
      isLoading={examQuery.isLoading || attemptQuery.isLoading}
      isError={examQuery.isError || attemptQuery.isError}
      error={(examQuery.error ?? attemptQuery.error) as Error | null}
      isEmpty={!current}
      emptyTitle="Examen indisponible"
      emptyMessage="Cet examen n’a pas encore de questions."
    >
      <div className="mx-auto max-w-5xl">
        <header className="sticky top-0 z-20 mb-6 border-b border-border bg-background/95 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate("exams")}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground"
            >
              <ArrowLeft className="size-4" />
              Quitter
            </button>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="truncate text-sm font-medium">{examQuery.data?.title}</p>
              <p className="text-xs text-muted-foreground">
                {current ? (SKILL_LABELS[current.skill] ?? current.sectionTitle) : ""} · Question{" "}
                {index + 1}/{questions.length}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-md border border-alert/20 bg-alert-soft px-3 py-1.5 text-sm font-medium text-alert">
              <Clock3 className="size-4" />
              {remaining}
            </span>
          </div>
          <ProgressLine
            className="mt-4"
            value={((index + 1) / Math.max(questions.length, 1)) * 100}
          />
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_14rem]">
          <Surface className="p-6 sm:p-8">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {current ? current.sectionTitle : ""}
            </p>
            {instruction ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{instruction}</p>
            ) : null}
            {passage ? (
              <div className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm leading-6">
                {passage}
              </div>
            ) : null}
            <h2 className="mt-4 text-xl font-semibold leading-snug sm:text-2xl">
              {current?.prompt}
            </h2>

            {(current?.type === "listening" || current?.skill === "hoeren") && (
              <div className="mt-5 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Headphones className="size-4" />
                  Audio
                </div>
                {audioUrl ? (
                  <audio
                    key={audioUrl}
                    className="mt-3 w-full"
                    controls
                    src={audioUrl}
                    preload="metadata"
                  >
                    Votre navigateur ne prend pas en charge l’audio.
                  </audio>
                ) : (
                  <p className="mt-2 text-destructive">
                    {typeof currentMeta["audio_error"] === "string"
                      ? currentMeta["audio_error"]
                      : "Audio indisponible pour cette question. Contactez votre professeur."}
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 space-y-3">
              {(current?.type === "single_choice" ||
                current?.type === "true_false" ||
                current?.type === "listening") &&
                current.options.map((option) => {
                  const selected = answerValue(localAnswers[current.id]) === option.value;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition duration-150 ${
                        selected
                          ? "border-primary bg-primary/5 font-medium text-foreground shadow-soft"
                          : "border-border hover:border-primary/40"
                      }`}
                      onClick={() => {
                        setLocalAnswers((prev) => ({ ...prev, [current.id]: option.value }));
                        persist(current.id, option.value);
                      }}
                    >
                      <span
                        className={`grid size-4 shrink-0 place-items-center rounded-full border ${
                          selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                        }`}
                        aria-hidden
                      >
                        {selected ? (
                          <span className="size-1.5 rounded-full bg-primary-foreground" />
                        ) : null}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}

              {current?.type === "form_fill" && (
                <div className="space-y-3">
                  {formFields.map((field) => (
                    <label key={field.key} className="block text-sm">
                      <span className="font-medium">{field.key}</span>
                      <Input
                        className="mt-1"
                        value={formFillDraft[field.key] ?? ""}
                        onChange={(e) => {
                          const next = {
                            ...formFillDraft,
                            [field.key]: e.target.value,
                          };
                          setLocalAnswers((prev) => ({ ...prev, [current.id]: next }));
                        }}
                        onBlur={() => {
                          persist(current.id, formFillAnswer(localAnswers[current.id]));
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}

              {isSpeakingType && current && session.attemptId ? (
                <ExamOralAnswerComposer
                  disabled={expired || attemptQuery.data?.status !== "in_progress"}
                  hasAudio={hasOralAudioAnswer({
                    answer: localAnswers[current.id],
                    answer_media_path:
                      (answersQuery.data ?? []).find((row) => row.question_id === current.id)
                        ?.answer_media_path ?? null,
                  })}
                  previewUrl={oralPreviewUrls[current.id] ?? null}
                  uploading={uploadOral.isPending}
                  onUpload={async (file) => {
                    const saved = await uploadOral.mutateAsync({
                      attemptId: session.attemptId!,
                      questionId: current.id,
                      file,
                      flagged: flagged[current.id] ?? false,
                    });
                    setLocalAnswers((prev) => ({ ...prev, [current.id]: saved.answer }));
                    try {
                      const signed = await ExamService.getAnswerAudioSignedUrl(saved);
                      if (signed) {
                        setOralPreviewUrls((prev) => ({ ...prev, [current.id]: signed }));
                      }
                    } catch {
                      /* preview optional */
                    }
                    toast.success("Audio oral enregistré");
                  }}
                />
              ) : null}

              {isWritingType && current && (
                <div>
                  {requirements.length > 0 ? (
                    <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {requirements.map((req) => (
                        <li key={req}>{req}</li>
                      ))}
                    </ul>
                  ) : null}
                  {recommendedWords ? (
                    <p className="mb-3 text-xs text-muted-foreground">
                      Nombre de mots conseillé : {recommendedWords}
                    </p>
                  ) : null}
                  <Textarea
                    className="min-h-52 text-base leading-relaxed"
                    value={answerValue(localAnswers[current.id])}
                    placeholder="Saisissez votre réponse…"
                    onChange={(e) => {
                      const value = e.target.value;
                      setLocalAnswers((prev) => ({ ...prev, [current.id]: value }));
                    }}
                    onBlur={() => {
                      if (!current) return;
                      persist(current.id, localAnswers[current.id] ?? "");
                    }}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {writingStats.words} mot{writingStats.words === 1 ? "" : "s"} ·{" "}
                    {writingStats.characters} caractère
                    {writingStats.characters === 1 ? "" : "s"}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => setIndex((v) => v - 1)}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  disabled={index >= questions.length - 1}
                  onClick={() => setIndex((v) => v + 1)}
                >
                  Suivant
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!current) return;
                    const next = !(flagged[current.id] ?? false);
                    setFlagged((prev) => ({ ...prev, [current.id]: next }));
                    persist(current.id, localAnswers[current.id] ?? null, next);
                  }}
                >
                  <Flag className="size-4" />
                  {flagged[current?.id ?? ""] ? "Marquée" : "Marquer"}
                </Button>
                <Button
                  disabled={submitExam.isPending}
                  onClick={() => {
                    if (!session.attemptId) return;
                    submitExam.mutate(session.attemptId, {
                      onSuccess: () => {
                        toast.success("Examen envoyé");
                        navigate("exam-result");
                      },
                      onError: (err) => toast.error(err.message),
                    });
                  }}
                >
                  Envoyer
                </Button>
              </div>
            </div>
          </Surface>

          <Surface className="h-fit p-4">
            <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Navigation
            </p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-4 lg:grid-cols-3">
              {questions.map((q, i) => {
                const raw = localAnswers[q.id];
                const answered =
                  raw !== undefined &&
                  raw !== null &&
                  (Boolean(parseOralAnswer(raw)) ||
                    (typeof raw === "object" && !Array.isArray(raw)
                      ? Object.values(raw as Record<string, unknown>).some(
                          (v) => String(v ?? "").trim() !== "",
                        )
                      : answerValue(raw) !== ""));
                const isCurrent = i === index;
                const isFlagged = flagged[q.id];
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`grid size-9 place-items-center rounded-md text-xs font-medium ${
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : answered
                          ? "bg-secondary text-primary"
                          : "border border-border text-muted-foreground"
                    } ${isFlagged ? "ring-2 ring-alert/40" : ""}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            {saveAnswer.isPending && (
              <p className="mt-3 text-xs text-muted-foreground">Enregistrement…</p>
            )}
          </Surface>
        </div>
      </div>
    </QueryState>
  );
}

function StudentExamResult() {
  const { navigate } = useAcademy();
  const session = readExamSession();
  const resultQuery = useExamResult(session.attemptId);
  const [showReview, setShowReview] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "correct" | "incorrect">("all");
  const [reviewIndex, setReviewIndex] = useState(0);
  const reviewQuery = useExamAttemptReview(showReview ? session.attemptId : null);

  const skills = resultQuery.data?.skills ?? {};
  const awaiting = resultQuery.data?.awaitingManual ?? false;
  const displayScore = awaiting
    ? (resultQuery.data?.automaticScore ?? 0)
    : (resultQuery.data?.score ?? 0);
  const displayMax = awaiting
    ? (resultQuery.data?.automaticMax ?? 40)
    : (resultQuery.data?.maxScore ?? 50);
  const displayPct = displayMax > 0 ? Math.round((displayScore / displayMax) * 10000) / 100 : 0;

  const objectiveItems = useMemo(
    () => (reviewQuery.data?.items ?? []).filter((item) => !isManualQuestionType(item.type)),
    [reviewQuery.data?.items],
  );
  const writingItems = useMemo(
    () => (reviewQuery.data?.items ?? []).filter((item) => isManualQuestionType(item.type)),
    [reviewQuery.data?.items],
  );
  const filteredObjective = useMemo(() => {
    if (reviewFilter === "correct") return objectiveItems.filter((i) => i.is_correct === true);
    if (reviewFilter === "incorrect") return objectiveItems.filter((i) => i.is_correct === false);
    return objectiveItems;
  }, [objectiveItems, reviewFilter]);

  useEffect(() => {
    setReviewIndex(0);
  }, [reviewFilter, showReview]);

  const currentReview = filteredObjective[reviewIndex] ?? null;

  const formatStudentAnswer = (item: {
    type: string;
    student_answer: Json;
    options: Array<{ value: string; label: string }>;
  }) => {
    if (item.type === "form_fill") {
      const form = formFillAnswer(item.student_answer);
      return Object.keys(form).length
        ? Object.entries(form)
            .map(([k, v]) => `${k}: ${v || "—"}`)
            .join(" · ")
        : "—";
    }
    const raw = answerValue(item.student_answer);
    const option = item.options.find((o) => o.value === raw);
    return option?.label ?? (raw || "—");
  };

  const formatCorrectAnswer = (item: {
    type: string;
    correct_values: string[] | null;
    correct_form: Record<string, string> | null;
    options: Array<{ value: string; label: string }>;
  }) => {
    if (item.type === "form_fill" && item.correct_form) {
      return Object.entries(item.correct_form)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
    }
    if (!item.correct_values?.length) return "—";
    return item.correct_values
      .map((value) => item.options.find((o) => o.value === value)?.label ?? value)
      .join(", ");
  };

  return (
    <QueryState
      isLoading={resultQuery.isLoading}
      isError={resultQuery.isError}
      error={resultQuery.error}
      isEmpty={!resultQuery.data}
      emptyTitle="Résultat indisponible"
      emptyMessage="Envoyez un examen pour voir votre score."
      onRetry={() => void resultQuery.refetch()}
    >
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => navigate("exams")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Examens blancs
        </button>
        <section className="grid items-center gap-8 rounded-2xl bg-primary p-8 text-primary-foreground md:grid-cols-[auto_1fr] md:p-12">
          {awaiting ? (
            <div className="grid size-36 place-items-center rounded-full border-4 border-primary-foreground/20">
              <span className="font-display text-3xl">
                {displayScore}/{displayMax}
              </span>
            </div>
          ) : (
            <div className="grid size-36 place-items-center rounded-full border-4 border-primary-foreground/20">
              <span className="font-display text-4xl">{displayPct.toFixed(0)}%</span>
            </div>
          )}
          <div>
            <p className="text-xs tracking-wide uppercase text-primary-foreground/70">
              {awaiting ? "Résultat provisoire" : "Résultat final"}
            </p>
            <h1 className="mt-2 font-display text-3xl md:text-4xl">
              {awaiting
                ? `Score auto ${displayScore}/${displayMax}`
                : `${displayScore}/${displayMax}`}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-primary-foreground/75">
              {resultQuery.data?.exam?.title}
              {awaiting
                ? " · Les parties objectives sont corrigées ; l’écrit est en attente."
                : ` · ${displayPct.toFixed(0)} %`}
            </p>
          </div>
        </section>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Résultats par compétence
            </h2>
            <div className="mt-5 space-y-4">
              {(["lesen", "hoeren", "schreiben"] as const).map((skill) => {
                const value = skills[skill];
                if (!value && skill !== "schreiben") return null;
                if (skill === "schreiben") {
                  return (
                    <div key={skill} className="space-y-2">
                      <p className="text-sm font-medium">{SKILL_LABELS[skill]}</p>
                      {(resultQuery.data?.schreibenItems ?? []).map((item, idx) => {
                        const label = shortBankId(item.bankQuestionId, `S0${idx + 1}`);
                        return (
                          <div
                            key={item.questionId}
                            className="flex justify-between text-sm text-muted-foreground"
                          >
                            <span>
                              {label}
                              {item.type === "form_fill" ? " (formulaire)" : ""}
                            </span>
                            <span>
                              {item.pending
                                ? "En attente"
                                : `${Number(item.pointsAwarded ?? 0)}/${item.points}`}
                            </span>
                          </div>
                        );
                      })}
                      {value ? (
                        <div className="h-2 rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${value.max > 0 ? Math.round((value.score / value.max) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                }
                const pct =
                  value && value.max > 0 ? Math.round((value.score / value.max) * 100) : 0;
                return (
                  <div key={skill}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{SKILL_LABELS[skill]}</span>
                      <span className="text-muted-foreground">
                        {value?.score ?? 0}/{value?.max ?? 15} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Correction
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Consultez le détail question par question après l’envoi.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowReview(true)}
              disabled={!session.attemptId}
            >
              Voir la correction détaillée
            </Button>
            <Button onClick={() => navigate("courses")}>Continuer les cours</Button>
          </div>
        </div>

        {showReview ? (
          <div className="mt-10 space-y-4">
            <h2 className="text-lg font-semibold">Correction détaillée</h2>
            <QueryState
              isLoading={reviewQuery.isLoading}
              isError={reviewQuery.isError}
              error={reviewQuery.error}
              isEmpty={!reviewQuery.data?.items?.length}
              emptyTitle="Aucune correction"
              emptyMessage="La correction n’est pas encore disponible."
              onRetry={() => void reviewQuery.refetch()}
            >
              <div className="mb-4 flex flex-wrap gap-2">
                {(
                  [
                    ["all", "Toutes"],
                    ["correct", "Correctes"],
                    ["incorrect", "Incorrectes"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={reviewFilter === value ? "default" : "outline"}
                    onClick={() => setReviewFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {filteredObjective.length ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewIndex <= 0}
                      onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
                    >
                      Précédent
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {reviewIndex + 1} / {filteredObjective.length}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewIndex >= filteredObjective.length - 1}
                      onClick={() =>
                        setReviewIndex((i) => Math.min(filteredObjective.length - 1, i + 1))
                      }
                    >
                      Suivant
                    </Button>
                  </div>
                  {currentReview ? (
                    <Surface className="space-y-2 p-4" key={currentReview.question_id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {SKILL_LABELS[currentReview.skill] ?? currentReview.section_title}
                          {currentReview.external_id
                            ? ` · ${shortBankId(currentReview.external_id, "")}`
                            : ""}
                        </p>
                        <Status tone={currentReview.is_correct ? "green" : "amber"}>
                          {currentReview.is_correct ? "Correct" : "Incorrect"}
                        </Status>
                      </div>
                      {currentReview.instruction ? (
                        <p className="text-sm text-muted-foreground">{currentReview.instruction}</p>
                      ) : null}
                      <p className="text-sm font-medium">{currentReview.prompt}</p>
                      <p className="text-sm">
                        Votre réponse :{" "}
                        <span className="text-muted-foreground">
                          {formatStudentAnswer(currentReview)}
                        </span>
                      </p>
                      <p className="text-sm">
                        Bonne réponse :{" "}
                        <span className="text-muted-foreground">
                          {formatCorrectAnswer(currentReview)}
                        </span>
                      </p>
                      {currentReview.explanation ? (
                        <p className="text-sm text-muted-foreground">{currentReview.explanation}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {Number(currentReview.points_awarded ?? 0)}/{currentReview.points} pts
                      </p>
                    </Surface>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune question pour ce filtre.</p>
              )}

              {writingItems.length ? (
                <div className="mt-6 space-y-3">
                  <h3 className="text-base font-semibold">Écriture et oral</h3>
                  {writingItems.map((item) => {
                    const detail =
                      item.grading_detail &&
                      typeof item.grading_detail === "object" &&
                      !Array.isArray(item.grading_detail)
                        ? (item.grading_detail as Record<string, unknown>)
                        : {};
                    const oral = isSpeakingQuestionType(item.type);
                    return (
                      <Surface className="space-y-2 p-4" key={item.question_id}>
                        <p className="text-xs text-muted-foreground">
                          {oral ? "Expression orale" : "Expression écrite"}
                        </p>
                        <p className="text-sm font-medium">{item.prompt}</p>
                        {oral ? (
                          <OralAnswerAudioPlayer
                            answer={{
                              answer: item.student_answer,
                              answer_media_bucket: item.answer_media_bucket ?? null,
                              answer_media_path: item.answer_media_path ?? null,
                            }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {answerValue(item.student_answer) || "—"}
                          </p>
                        )}
                        <p className="text-sm">
                          Score : {Number(item.points_awarded ?? 0)}/{item.points}
                        </p>
                        {Object.keys(detail).length ? (
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {Object.entries(RUBRIC_LABELS).map(([key, label]) =>
                              detail[key] != null ? (
                                <p key={key}>
                                  {label} : {String(detail[key])}
                                </p>
                              ) : null,
                            )}
                          </div>
                        ) : null}
                        {item.teacher_comment ? (
                          <p className="text-sm">Commentaire : {item.teacher_comment}</p>
                        ) : null}
                      </Surface>
                    );
                  })}
                </div>
              ) : null}
            </QueryState>
          </div>
        ) : null}
      </div>
    </QueryState>
  );
}

function OralAnswerAudioPlayer({
  answer,
}: {
  answer: {
    answer: Json;
    answer_media_bucket?: string | null;
    answer_media_path?: string | null;
  };
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    if (!hasOralAudioAnswer(answer)) {
      setError("Aucun audio oral");
      return;
    }
    void ExamService.getAnswerAudioSignedUrl(answer)
      .then((signed) => {
        if (!cancelled) setUrl(signed);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Lecture audio impossible");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [answer.answer, answer.answer_media_bucket, answer.answer_media_path]);

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!url) return <p className="text-sm text-muted-foreground">Chargement audio…</p>;
  return (
    <audio controls src={url} className="w-full">
      Votre navigateur ne lit pas l’audio.
    </audio>
  );
}

export function ExamWritingGradingPanel({ examId }: { examId: string }) {
  const attemptsQuery = useExamAttemptsForExam(examId);
  const examQuery = useExam(examId);
  const gradeWriting = useGradeWritingAnswer();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [aiBusyKey, setAiBusyKey] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, GradeAssistSuggestion | null>>(
    {},
  );
  const [aiMessages, setAiMessages] = useState<Record<string, string | null>>({});

  const writingQuestions = useMemo(() => {
    return (examQuery.data?.sections ?? []).flatMap((section) =>
      (section.questions ?? [])
        .filter((q) => isManualQuestionType(q.type))
        .map((q) => ({ ...q, sectionTitle: section.title })),
    );
  }, [examQuery.data]);

  const gradedAttempts = (attemptsQuery.data ?? []).filter(
    (a) => a.status === "graded" && a.percentage != null,
  );
  const groupAverage =
    gradedAttempts.length > 0
      ? gradedAttempts.reduce((sum, a) => sum + Number(a.percentage ?? 0), 0) /
        gradedAttempts.length
      : null;

  const answersQuery = useExamAnswers(expandedId);
  const levelCode = examQuery.data?.level?.code ?? null;

  useEffect(() => {
    if (!answersQuery.data || !expandedId) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const answer of answersQuery.data) {
        const key = `${expandedId}:${answer.question_id}`;
        if (next[key]) continue;
        const detail =
          answer.grading_detail &&
          typeof answer.grading_detail === "object" &&
          !Array.isArray(answer.grading_detail)
            ? (answer.grading_detail as Record<string, unknown>)
            : {};
        next[key] = {
          ...Object.fromEntries(
            Object.entries(detail)
              .filter(([k]) => k !== "comment")
              .map(([k, v]) => [k, v != null ? String(v) : ""]),
          ),
          comment: answer.teacher_comment ?? "",
        };
      }
      return next;
    });
  }, [answersQuery.data, expandedId]);

  const studentName = (attempt: NonNullable<typeof attemptsQuery.data>[number]) => {
    const p = attempt.student?.profile;
    if (!p) return "Étudiant";
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    return name || p.email || "Étudiant";
  };

  const attemptStatusLabel = (status: string) => {
    if (status === "submitted") return "à corriger";
    if (status === "graded") return "corrigé";
    if (status === "in_progress") return "en cours";
    return status;
  };

  const requestWritingAi = async (input: {
    key: string;
    attemptId: string;
    questionId: string;
    studentId: string | null;
    prompt: string;
    text: string;
    rubric: Record<string, number>;
    points: number;
  }) => {
    setAiMessages((prev) => ({ ...prev, [input.key]: null }));
    if (!input.text.trim()) {
      setAiSuggestions((prev) => ({ ...prev, [input.key]: null }));
      setAiMessages((prev) => ({ ...prev, [input.key]: GRADE_ASSIST_NEEDS_TEXT_MESSAGE }));
      return;
    }
    setAiBusyKey(input.key);
    try {
      const outcome = await GradeAssistService.suggest({
        level: levelCode,
        subject: "Expression écrite — examen blanc",
        instructions: input.prompt,
        response: input.text,
        rubric: formatGradeAssistRubric(input.rubric),
        maxScore: input.points,
        targetKind: "exam_writing",
        targetId: input.questionId,
        studentId: input.studentId,
      });
      if (!outcome.ok) {
        setAiSuggestions((prev) => ({ ...prev, [input.key]: null }));
        setAiMessages((prev) => ({ ...prev, [input.key]: outcome.message }));
        return;
      }
      setAiSuggestions((prev) => ({ ...prev, [input.key]: outcome.suggestion }));
      setAiMessages((prev) => ({ ...prev, [input.key]: null }));
    } catch (err) {
      setAiSuggestions((prev) => ({ ...prev, [input.key]: null }));
      setAiMessages((prev) => ({
        ...prev,
        [input.key]: err instanceof Error ? err.message : "Suggestion indisponible",
      }));
    } finally {
      setAiBusyKey(null);
    }
  };

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Corrections manuelles (écrit / oral)</h3>
        {groupAverage != null && (
          <p className="text-sm text-muted-foreground">
            Moyenne groupe (corrigés) : {groupAverage.toFixed(1)} %
          </p>
        )}
      </div>
      <QueryState
        isLoading={attemptsQuery.isLoading || examQuery.isLoading}
        isError={attemptsQuery.isError || examQuery.isError}
        error={(attemptsQuery.error ?? examQuery.error) as Error | null}
        isEmpty={!attemptsQuery.data?.length}
        emptyTitle="Aucune tentative"
        emptyMessage="Les copies apparaîtront ici après envoi."
        onRetry={() => {
          void attemptsQuery.refetch();
          void examQuery.refetch();
        }}
      >
        <div className="space-y-2">
          {(attemptsQuery.data ?? []).map((attempt) => {
            const open = expandedId === attempt.id;
            return (
              <div key={attempt.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{studentName(attempt)}</p>
                    <p className="text-xs text-muted-foreground">
                      {attemptStatusLabel(attempt.status)}
                      {attempt.percentage != null
                        ? ` · ${Number(attempt.percentage).toFixed(1)} %`
                        : ""}
                      {attempt.score != null
                        ? ` · ${Number(attempt.score)} / ${Number(attempt.max_score ?? 0)}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={attempt.status === "in_progress"}
                    onClick={() => setExpandedId((id) => (id === attempt.id ? null : attempt.id))}
                  >
                    {open ? "Masquer" : "Corriger"}
                  </Button>
                </div>
                {open && (
                  <div className="mt-3 space-y-4">
                    {answersQuery.isLoading && (
                      <p className="text-sm text-muted-foreground">Chargement des réponses…</p>
                    )}
                    {writingQuestions.length === 0 && !answersQuery.isLoading && (
                      <p className="text-sm text-muted-foreground">
                        Aucune question manuelle (écrit ou oral) sur cet examen.
                      </p>
                    )}
                    {writingQuestions.map((question) => {
                      const answer = (answersQuery.data ?? []).find(
                        (row) => row.question_id === question.id,
                      );
                      const key = `${attempt.id}:${question.id}`;
                      const meta = questionMeta(question.metadata);
                      const requirements = Array.isArray(meta["requirements"])
                        ? meta["requirements"].filter(
                            (item): item is string => typeof item === "string",
                          )
                        : [];
                      const speaking = isSpeakingQuestionType(question.type);
                      const rubric = speaking
                        ? oralRubricFromMeta(meta, question.points)
                        : (() => {
                            const rubricRaw = meta["rubric"];
                            return rubricRaw &&
                              typeof rubricRaw === "object" &&
                              !Array.isArray(rubricRaw)
                              ? (rubricRaw as Record<string, number>)
                              : {
                                  task_completion: 4,
                                  comprehensibility: 2,
                                  vocabulary: 2,
                                  grammar_and_spelling: 2,
                                };
                          })();
                      const rubricKeys = Object.keys(rubric);
                      const draft = drafts[key] ?? {
                        ...Object.fromEntries(rubricKeys.map((k) => [k, ""])),
                        comment: "",
                      };
                      const rubricSum = rubricKeys.reduce(
                        (sum, rubricKey) => sum + Number(draft[rubricKey] || 0),
                        0,
                      );
                      const text = answer ? answerValue(answer.answer) : "";
                      const stats = countWritingStats(speaking ? "" : text);
                      const instruction =
                        typeof meta["instruction"] === "string"
                          ? meta["instruction"]
                          : question.prompt;
                      return (
                        <div key={question.id} className="space-y-3 rounded-md bg-muted/40 p-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {question.sectionTitle} ·{" "}
                            {speaking ? "Expression orale" : "Expression écrite"}
                          </p>
                          <p className="text-sm font-medium">{instruction}</p>
                          {requirements.length > 0 ? (
                            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                              {requirements.map((req) => (
                                <li key={req}>{req}</li>
                              ))}
                            </ul>
                          ) : null}
                          {speaking ? (
                            answer ? (
                              <OralAnswerAudioPlayer answer={answer} />
                            ) : (
                              <p className="text-sm text-muted-foreground">Pas d’audio oral</p>
                            )
                          ) : (
                            <>
                              <p className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
                                {text || "Pas de réponse"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {stats.words} mot{stats.words === 1 ? "" : "s"}
                              </p>
                            </>
                          )}
                          <div className="grid gap-2 sm:grid-cols-2">
                            {rubricKeys.map((rubricKey) => (
                              <label key={rubricKey} className="block text-xs">
                                {RUBRIC_LABELS[rubricKey] ?? rubricKey} (/{rubric[rubricKey] ?? 0})
                                <Input
                                  className="mt-1"
                                  type="number"
                                  min={0}
                                  max={rubric[rubricKey] ?? question.points}
                                  step="0.5"
                                  value={draft[rubricKey] ?? ""}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [key]: { ...draft, [rubricKey]: e.target.value },
                                    }))
                                  }
                                />
                              </label>
                            ))}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Total : {rubricSum} / {question.points}
                          </p>
                          <label className="block text-xs">
                            Commentaire
                            <Input
                              className="mt-1"
                              value={draft["comment"] ?? ""}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [key]: { ...draft, comment: e.target.value },
                                }))
                              }
                            />
                          </label>
                          {!speaking ? (
                            <AiGradeAssistPanel
                              busy={aiBusyKey === key}
                              disabled={gradeWriting.isPending}
                              suggestion={aiSuggestions[key] ?? null}
                              statusMessage={aiMessages[key] ?? null}
                              maxScore={question.points}
                              onRequest={() =>
                                void requestWritingAi({
                                  key,
                                  attemptId: attempt.id,
                                  questionId: question.id,
                                  studentId: attempt.student_id,
                                  prompt: instruction,
                                  text,
                                  rubric,
                                  points: question.points,
                                })
                              }
                              onUse={() => {
                                const suggestion = aiSuggestions[key];
                                if (!suggestion) return;
                                const mapped = applySuggestionToWritingRubric({
                                  suggestedScore: suggestion.suggested_score,
                                  criteriaScores: suggestion.criteria_scores,
                                  rubric,
                                  questionPoints: question.points,
                                });
                                setDrafts((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...draft,
                                    ...mapped,
                                    comment: suggestion.feedback || draft["comment"] || "",
                                  },
                                }));
                                toast.message(
                                  "Proposition appliquée — vérifiez puis enregistrez la correction.",
                                );
                              }}
                              onRegenerate={() =>
                                void requestWritingAi({
                                  key,
                                  attemptId: attempt.id,
                                  questionId: question.id,
                                  studentId: attempt.student_id,
                                  prompt: instruction,
                                  text,
                                  rubric,
                                  points: question.points,
                                })
                              }
                              onIgnore={() => {
                                setAiSuggestions((prev) => ({ ...prev, [key]: null }));
                                setAiMessages((prev) => ({ ...prev, [key]: null }));
                              }}
                            />
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Correction orale manuelle : écoutez l’audio puis saisissez la grille.
                            </p>
                          )}
                          <Button
                            size="sm"
                            disabled={
                              gradeWriting.isPending ||
                              rubricKeys.some((k) => draft[k] === "" || draft[k] == null) ||
                              !Number.isFinite(rubricSum) ||
                              rubricSum > question.points
                            }
                            onClick={() => {
                              if (!Number.isFinite(rubricSum) || rubricSum > question.points) {
                                toast.error("Total de barème invalide");
                                return;
                              }
                              const gradingDetail = Object.fromEntries(
                                rubricKeys.map((k) => [k, Number(draft[k])]),
                              );
                              gradeWriting.mutate(
                                {
                                  attemptId: attempt.id,
                                  questionId: question.id,
                                  points: rubricSum,
                                  comment: draft["comment"] || null,
                                  gradingDetail,
                                },
                                {
                                  onSuccess: () => toast.success("Note enregistrée"),
                                  onError: (err) => toast.error(err.message),
                                },
                              );
                            }}
                          >
                            Enregistrer la note
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </QueryState>
    </div>
  );
}

export function StaffExamsPage() {
  const { role } = useAcademy();
  const classesQuery = useClasses();
  const examsQuery = useAllExams();
  const [gradingExamId, setGradingExamId] = useState<string | null>(null);
  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );
  const exams = useMemo(() => {
    return hideArchivedStatus(examsQuery.data ?? []).filter(
      (exam) => isDirectorRole(role) || scopedClassOrLevelItemVisible(exam, teacherScope),
    );
  }, [examsQuery.data, role, teacherScope]);

  return (
    <>
      <PageHeader title="Examens blancs" subtitle="Examens publiés pour vos groupes." />
      <QueryState
        isLoading={examsQuery.isLoading || classesQuery.isLoading}
        isError={examsQuery.isError || classesQuery.isError}
        error={(examsQuery.error ?? classesQuery.error) as Error | null}
        isEmpty={!exams.length}
        emptyTitle="Aucun examen"
        emptyMessage="Les examens blancs de vos groupes apparaîtront ici."
        onRetry={() => {
          void examsQuery.refetch();
          void classesQuery.refetch();
        }}
      >
        <div className="space-y-3">
          {exams.map((exam) => (
            <Surface className="p-5" key={exam.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{exam.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {exam.level?.code} · {exam.duration_minutes} min · seuil {exam.pass_percentage}{" "}
                    %
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Status tone={exam.status === "published" ? "green" : "amber"}>
                    {exam.status === "published"
                      ? "Publié"
                      : exam.status === "draft"
                        ? "Brouillon"
                        : "Archivé"}
                  </Status>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setGradingExamId((id) => (id === exam.id ? null : exam.id))}
                  >
                    {gradingExamId === exam.id ? "Masquer corrections" : "Corrections"}
                  </Button>
                </div>
              </div>
              {gradingExamId === exam.id ? (
                <>
                  <ExamParticipantRosterPanel examId={exam.id} />
                  <ExamWritingGradingPanel examId={exam.id} />
                </>
              ) : null}
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}

export function DirectorExamsPage() {
  const { role } = useAcademy();
  const examsQuery = useAllExams();
  const levelsQuery = useLevels();
  const classesQuery = useClasses();
  const createExam = useCreateExam();
  const publishExam = usePublishExam();
  const archiveExam = useArchiveExam();
  const isTeacher = role === "teacher";
  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );
  const [builderExamId, setBuilderExamId] = useState<string | null>(null);
  const [gradingExamId, setGradingExamId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [levelId, setLevelId] = useState("");
  const [classId, setClassId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState("60");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [attachment, setAttachment] = useState<AttachmentDraft>({
    kind: "text",
    url: "",
    file: null,
    text: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const classesForLevel = (classesQuery.data ?? []).filter(
    (c) => !levelId || c.levelId === levelId,
  );
  const exams = useMemo(() => {
    return hideArchivedStatus(examsQuery.data ?? []).filter(
      (exam) => isDirectorRole(role) || scopedClassOrLevelItemVisible(exam, teacherScope),
    );
  }, [examsQuery.data, role, teacherScope]);

  useEffect(() => {
    if (!isTeacher || classId || !levelId) return;
    const firstClass = classesForLevel[0];
    if (firstClass) setClassId(firstClass.id);
  }, [isTeacher, classId, levelId, classesForLevel]);

  useEffect(() => {
    if (!isTeacher || classId) return;
    const firstClass = classesQuery.data?.[0];
    if (firstClass) {
      setLevelId(firstClass.levelId ?? "");
      setClassId(firstClass.id);
    }
  }, [isTeacher, classId, classesQuery.data]);

  return (
    <>
      <PageHeader
        title="Examens blancs"
        subtitle={
          isTeacher
            ? "Publiez et partagez des examens blancs avec vos groupes uniquement."
            : "Ciblez un niveau entier ou un groupe de ce niveau."
        }
        action={<Button onClick={() => setOpen(true)}>+ Créer un examen blanc</Button>}
      />
      <QueryState
        isLoading={examsQuery.isLoading}
        isError={examsQuery.isError}
        error={examsQuery.error}
        isEmpty={!exams.length}
        emptyTitle="Aucun examen"
        emptyMessage={
          isTeacher
            ? "Aucun examen blanc pour vos groupes pour le moment."
            : "Créez un examen blanc pour un niveau ou un groupe."
        }
        onRetry={() => void examsQuery.refetch()}
      >
        <div className="space-y-3">
          {exams.map((exam) => (
            <Surface className="p-5" key={exam.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{exam.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {exam.level?.code}{" "}
                    {exam.class?.name ? `· ${exam.class.name}` : "· Niveau entier"} ·{" "}
                    {exam.duration_minutes} min
                    {exam.starts_at ? ` · ${formatFrDate(exam.starts_at)}` : ""}
                    {` · ${MEDIA_KIND_LABELS[exam.content_kind]}`}
                  </p>
                  {exam.instructions || exam.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {exam.instructions || exam.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Status tone={exam.status === "published" ? "green" : "amber"}>
                    {exam.status === "published" ? "Publié" : "Brouillon"}
                  </Status>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setBuilderExamId((id) => (id === exam.id ? null : exam.id))}
                  >
                    {builderExamId === exam.id ? "Masquer QCM" : "Éditer QCM"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setGradingExamId((id) => (id === exam.id ? null : exam.id))}
                  >
                    {gradingExamId === exam.id ? "Masquer corrections" : "Corrections"}
                  </Button>
                  {(exam.content_url || exam.storage_path) &&
                    !isTextContentKind(exam.content_kind) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void ExamService.getExamMaterialUrl(exam)
                          .then((url) => window.open(url, "_blank", "noopener,noreferrer"))
                          .catch((err: Error) => toast.error(err.message));
                      }}
                    >
                      Ouvrir
                    </Button>
                  )}
                  {exam.status !== "published" && (
                    <Button
                      size="sm"
                      disabled={publishExam.isPending}
                      onClick={() =>
                        publishExam.mutate(exam.id, {
                          onSuccess: () => toast.success("Examen publié"),
                          onError: (err) => toast.error(err.message),
                        })
                      }
                    >
                      Publier
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!window.confirm(`Supprimer l’examen « ${exam.title} » ?`)) return;
                      archiveExam.mutate(exam.id, {
                        onSuccess: () => toast.success("Examen archivé"),
                        onError: (err) => toast.error(err.message),
                      });
                    }}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
              {builderExamId === exam.id ? <ExamBuilder examId={exam.id} /> : null}
              {gradingExamId === exam.id ? (
                <>
                  <ExamParticipantRosterPanel examId={exam.id} />
                  <ExamWritingGradingPanel examId={exam.id} />
                </>
              ) : null}
            </Surface>
          ))}
        </div>
      </QueryState>

      {open && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel max-h-[90dvh] space-y-4 overflow-y-auto">
            <h2 className="text-lg font-semibold">Créer un examen blanc</h2>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (facultative)"
            />
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Consignes"
            />
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
              Date et heure de début
              <Input
                className="mt-1"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Durée (minutes)
              <Input
                className="mt-1"
                type="number"
                min={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Tentatives max (attribution d’essais supplémentaires)
              <Input
                className="mt-1"
                type="number"
                min={1}
                max={20}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
              />
            </label>
            <ContentAttachmentUploader
              kinds={["text", "pdf", "document", "image", "link"]}
              value={attachment}
              onChange={setAttachment}
              disabled={saving}
              uploading={saving}
              error={formError}
              requiredFileWhenNew={false}
              textPlaceholder="Sujet d’expression écrite ou consignes textuelles…"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                disabled={
                  !title.trim() ||
                  !levelId ||
                  saving ||
                  createExam.isPending ||
                  (isTeacher && !classId)
                }
                onClick={() => {
                  void (async () => {
                    setFormError(null);
                    if (isTeacher && !classId) {
                      setFormError("Choisissez un de vos groupes pour partager cet examen.");
                      return;
                    }
                    const kind = attachment.kind as MediaKind;
                    if (isTextContentKind(kind)) {
                      const textError = validateTextContentBody(
                        attachment.text || instructions,
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
                      let storageBucket: string | null = null;
                      let storagePath: string | null = null;
                      let mimeType: string | null = null;
                      if (attachment.file && isFileContentKind(kind)) {
                        const uploaded = await ExamService.uploadExamMaterial(attachment.file);
                        storageBucket = uploaded.storageBucket;
                        storagePath = uploaded.storagePath;
                        mimeType = uploaded.mimeType;
                      }
                      const textBody = (attachment.text || instructions).trim();
                      const resolvedInstructions = isTextContentKind(kind)
                        ? textBody
                        : instructions.trim() || null;
                      await createExam.mutateAsync({
                        title: title.trim(),
                        levelId,
                        classId: classId || null,
                        ...(description.trim() ? { description: description.trim() } : {}),
                        ...(resolvedInstructions ? { instructions: resolvedInstructions } : {}),
                        durationMinutes: Number(duration) || 60,
                        maxAttempts: Math.max(1, Number(maxAttempts) || 3),
                        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
                        endsAt: startsAt
                          ? new Date(
                              new Date(startsAt).getTime() + (Number(duration) || 60) * 60_000,
                            ).toISOString()
                          : null,
                        contentKind: kind,
                        contentUrl: kind === "link" ? attachment.url.trim() || null : null,
                        storageBucket: isTextContentKind(kind) ? null : storageBucket,
                        storagePath: isTextContentKind(kind) ? null : storagePath,
                        mimeType: isTextContentKind(kind) ? "text/plain" : mimeType,
                        isMock: true,
                        status: "draft",
                      });
                      toast.success(
                        isTextContentKind(kind)
                          ? "Examen créé (brouillon) — ajoutez les questions puis publiez"
                          : "Examen blanc créé — éditez le QCM puis publiez",
                      );
                      setOpen(false);
                      setTitle("");
                      setDescription("");
                      setInstructions("");
                      setLevelId("");
                      setClassId("");
                      setStartsAt("");
                      setDuration("60");
                      setAttachment({ kind: "text", url: "", file: null, text: "" });
                    } catch (err) {
                      setFormError(err instanceof Error ? err.message : "Création impossible");
                    } finally {
                      setSaving(false);
                    }
                  })();
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
