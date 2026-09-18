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
} from "@/hooks/use-academy-data";
import { ExamService } from "@/services/academy-services";
import type { Json } from "@/types/database";
import {
  formatFrDate,
  isValidHttpUrl,
  MEDIA_KIND_LABELS,
  validateFileForKind,
  type MediaKind,
} from "@/lib/academic-content";
import {
  buildTeacherScope,
  hideArchivedStatus,
  isDirectorRole,
  scopedClassOrLevelItemVisible,
} from "@/lib/academy-logic";
import { ContentAttachmentUploader, type AttachmentDraft } from "./content-attachment-uploader";
import { ExamBuilder } from "./exam-builder";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import { PageHeader, Status, Surface, ProgressLine } from "./primitives";

const EXAM_ID_KEY = "ga_active_exam_id";
const ATTEMPT_ID_KEY = "ga_active_attempt_id";

const SKILL_LABELS: Record<string, string> = {
  lesen: "Lecture",
  hoeren: "Écoute",
  schreiben: "Écriture",
  sprechen: "Expression orale",
  grammatik: "Grammaire",
  wortschatz: "Vocabulaire",
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
        isLoading={examsQuery.isLoading}
        isError={examsQuery.isError}
        error={examsQuery.error}
        isEmpty={!examsQuery.data?.length}
        emptyTitle="Aucun examen"
        emptyMessage="Les examens blancs de votre niveau apparaîtront ici."
        onRetry={() => void examsQuery.refetch()}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {examsQuery.data?.map((exam) => {
            const latest = latestByExam.get(exam.id);
            return (
              <Surface className="p-6" key={exam.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {exam.level?.code ?? "—"}
                      {exam.class?.name ? ` · ${exam.class.name}` : " · Niveau entier"} ·{" "}
                      {exam.duration_minutes} min · {MEDIA_KIND_LABELS[exam.content_kind]}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">{exam.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {exam.starts_at
                        ? `Début ${formatFrDate(exam.starts_at)}`
                        : "Horaire non précisé"}
                      {exam.ends_at ? ` · Fin ${formatFrDate(exam.ends_at)}` : ""}
                    </p>
                    {exam.instructions || exam.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {exam.instructions || exam.description}
                      </p>
                    ) : null}
                  </div>
                  <Status tone="green">
                    {exam.status === "published" ? "Publié" : exam.status}
                  </Status>
                </div>
                {latest && latest.status !== "in_progress" && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Dernier résultat : {Number(latest.percentage ?? 0).toFixed(0)} % ·{" "}
                    {latest.status === "submitted"
                      ? "Remis"
                      : latest.status === "graded"
                        ? "Corrigé"
                        : latest.status}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {(exam.content_url || exam.storage_path) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        void ExamService.getExamMaterialUrl(exam)
                          .then((url) => {
                            if (exam.content_kind === "link") {
                              window.open(url, "_blank", "noopener,noreferrer");
                              return;
                            }
                            window.open(url, "_blank", "noopener,noreferrer");
                          })
                          .catch((err: Error) => toast.error(err.message));
                      }}
                    >
                      Ouvrir le document
                    </Button>
                  )}
                  <Button
                    disabled={startExam.isPending}
                    onClick={() => {
                      startExam.mutate(exam.id, {
                        onSuccess: (attempt) => {
                          persistExamSession(exam.id, attempt.id);
                          navigate("mock-exam");
                        },
                        onError: (err) => toast.error(err.message),
                      });
                    }}
                  >
                    {latest?.status === "in_progress" ? "Continuer" : "Commencer"}
                  </Button>
                  {latest && latest.status !== "in_progress" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        persistExamSession(exam.id, latest.id);
                        navigate("exam-result");
                      }}
                    >
                      Voir le résultat
                    </Button>
                  )}
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
  const submitExam = useSubmitExam();
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [localAnswers, setLocalAnswers] = useState<Record<string, Json>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

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

  const writingText =
    current &&
    (current.type === "writing" || current.type === "text" || current.type === "speaking")
      ? answerValue(localAnswers[current.id])
      : "";
  const writingWordCount = writingText.trim()
    ? writingText.trim().split(/\s+/).filter(Boolean).length
    : 0;

  useEffect(() => {
    if (!current || !session.attemptId) return;
    if (current.type !== "writing" && current.type !== "text" && current.type !== "speaking") {
      return;
    }
    const value = localAnswers[current.id];
    if (value === undefined) return;
    const timer = window.setTimeout(() => {
      persist(current.id, value);
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce local draft only
  }, [current?.id, current?.type, writingText, session.attemptId]);

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
                {examQuery.data?.level?.code} · Question {index + 1}/{questions.length}
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
              {current ? (SKILL_LABELS[current.skill] ?? current.sectionTitle) : ""}
            </p>
            <h2 className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">
              {current?.prompt}
            </h2>

            {current?.type === "listening" && (
              <div className="mt-5 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Headphones className="size-4" />
                  Audio
                </div>
                <p className="mt-2">
                  {current.media_path
                    ? "Fichier audio disponible."
                    : "Aucun fichier audio — répondez à partir de la consigne."}
                </p>
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

              {(current?.type === "writing" ||
                current?.type === "text" ||
                current?.type === "speaking") && (
                <div>
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
                    {writingWordCount} mot{writingWordCount === 1 ? "" : "s"} · {writingText.length}{" "}
                    caractère{writingText.length === 1 ? "" : "s"}
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
                const answered =
                  localAnswers[q.id] !== undefined &&
                  localAnswers[q.id] !== null &&
                  answerValue(localAnswers[q.id]) !== "";
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

  const skills = resultQuery.data?.skills ?? {};
  const percentage = resultQuery.data?.percentage ?? 0;

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
          <div className="grid size-36 place-items-center rounded-full border-4 border-primary-foreground/20">
            <span className="font-display text-4xl">{percentage.toFixed(0)}%</span>
          </div>
          <div>
            <p className="text-xs tracking-wide uppercase text-primary-foreground/70">
              Votre résultat
            </p>
            <h1 className="mt-2 font-display text-3xl md:text-4xl">
              {resultQuery.data?.passed ? "Réussi" : "À améliorer"}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-primary-foreground/75">
              {resultQuery.data?.exam?.title} · {resultQuery.data?.correct}/
              {resultQuery.data?.totalObjective} questions objectives correctes. L’écrit et l’oral
              peuvent attendre une correction du professeur.
            </p>
          </div>
        </section>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Résultats par compétence
            </h2>
            <div className="mt-5 space-y-4">
              {Object.keys(skills).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun détail par compétence pour le moment.
                </p>
              )}
              {Object.entries(skills).map(([skill, value]) => {
                const pct = value.max > 0 ? Math.round((value.score / value.max) * 100) : 0;
                return (
                  <div key={skill}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{SKILL_LABELS[skill] ?? skill}</span>
                      <span className="text-muted-foreground">
                        {value.score}/{value.max} · {pct}%
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
                Prochaine étape
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Revenez sur les compétences les plus faibles, puis entraînez-vous à l’écrit avec les
                retours de votre professeur.
              </p>
            </div>
            <Button onClick={() => navigate("courses")}>Continuer les cours</Button>
          </div>
        </div>
      </div>
    </QueryState>
  );
}

function ExamWritingGradingPanel({ examId }: { examId: string }) {
  const attemptsQuery = useExamAttemptsForExam(examId);
  const examQuery = useExam(examId);
  const gradeWriting = useGradeWritingAnswer();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { points: string; comment: string }>>({});

  const writingQuestions = useMemo(() => {
    return (examQuery.data?.sections ?? []).flatMap((section) =>
      (section.questions ?? [])
        .filter((q) => q.type === "writing" || q.type === "text" || q.type === "speaking")
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

  useEffect(() => {
    if (!answersQuery.data || !expandedId) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const answer of answersQuery.data) {
        const key = `${expandedId}:${answer.question_id}`;
        if (next[key]) continue;
        next[key] = {
          points: answer.points_awarded != null ? String(answer.points_awarded) : "",
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

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Corrections écrites</h3>
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
                        Aucune question d’écriture sur cet examen.
                      </p>
                    )}
                    {writingQuestions.map((question) => {
                      const answer = (answersQuery.data ?? []).find(
                        (row) => row.question_id === question.id,
                      );
                      const key = `${attempt.id}:${question.id}`;
                      const draft = drafts[key] ?? {
                        points: "",
                        comment: "",
                      };
                      return (
                        <div key={question.id} className="space-y-2 rounded-md bg-muted/40 p-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {question.sectionTitle}
                          </p>
                          <p className="text-sm font-medium">{question.prompt}</p>
                          <p className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
                            {answer ? answerValue(answer.answer) || "—" : "Pas de réponse"}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
                            <label className="block text-xs">
                              Points (/{question.points})
                              <Input
                                className="mt-1"
                                type="number"
                                min={0}
                                max={question.points}
                                step="0.5"
                                value={draft.points}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [key]: { ...draft, points: e.target.value },
                                  }))
                                }
                              />
                            </label>
                            <label className="block text-xs">
                              Commentaire
                              <Input
                                className="mt-1"
                                value={draft.comment}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [key]: { ...draft, comment: e.target.value },
                                  }))
                                }
                              />
                            </label>
                            <div className="flex items-end">
                              <Button
                                size="sm"
                                disabled={gradeWriting.isPending || draft.points === ""}
                                onClick={() => {
                                  const points = Number(draft.points);
                                  if (!Number.isFinite(points)) {
                                    toast.error("Points invalides");
                                    return;
                                  }
                                  gradeWriting.mutate(
                                    {
                                      attemptId: attempt.id,
                                      questionId: question.id,
                                      points,
                                      comment: draft.comment.trim() || null,
                                    },
                                    {
                                      onSuccess: () => toast.success("Note enregistrée"),
                                      onError: (err) => toast.error(err.message),
                                    },
                                  );
                                }}
                              >
                                Enregistrer
                              </Button>
                            </div>
                          </div>
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
              {gradingExamId === exam.id ? <ExamWritingGradingPanel examId={exam.id} /> : null}
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
  const [attachment, setAttachment] = useState<AttachmentDraft>({
    kind: "pdf",
    url: "",
    file: null,
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
                  {(exam.content_url || exam.storage_path) && (
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
              {gradingExamId === exam.id ? <ExamWritingGradingPanel examId={exam.id} /> : null}
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
            <ContentAttachmentUploader
              kinds={["pdf", "document", "image", "link"]}
              value={attachment}
              onChange={setAttachment}
              disabled={saving}
              uploading={saving}
              error={formError}
              requiredFileWhenNew={false}
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
                    if (kind === "link" && attachment.url && !isValidHttpUrl(attachment.url)) {
                      setFormError("Saisissez une URL valide.");
                      return;
                    }
                    if (attachment.file) {
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
                      if (attachment.file && kind !== "link") {
                        const uploaded = await ExamService.uploadExamMaterial(attachment.file);
                        storageBucket = uploaded.storageBucket;
                        storagePath = uploaded.storagePath;
                        mimeType = uploaded.mimeType;
                      }
                      await createExam.mutateAsync({
                        title: title.trim(),
                        levelId,
                        classId: classId || null,
                        ...(description.trim() ? { description: description.trim() } : {}),
                        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
                        durationMinutes: Number(duration) || 60,
                        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
                        endsAt: startsAt
                          ? new Date(
                              new Date(startsAt).getTime() + (Number(duration) || 60) * 60_000,
                            ).toISOString()
                          : null,
                        contentKind: kind,
                        contentUrl: kind === "link" ? attachment.url.trim() || null : null,
                        storageBucket,
                        storagePath,
                        mimeType,
                        isMock: true,
                        status: "published",
                      });
                      toast.success("Examen blanc publié");
                      setOpen(false);
                      setTitle("");
                      setDescription("");
                      setInstructions("");
                      setLevelId("");
                      setClassId("");
                      setStartsAt("");
                      setDuration("60");
                      setAttachment({ kind: "pdf", url: "", file: null });
                    } catch (err) {
                      setFormError(err instanceof Error ? err.message : "Création impossible");
                    } finally {
                      setSaving(false);
                    }
                  })();
                }}
              >
                Publier
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </>
  );
}
