import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Flag, Headphones } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAllExams,
  useCreateExam,
  useExam,
  useExamAnswers,
  useExamAttempt,
  useExamResult,
  useLevels,
  useMyExamAttempts,
  usePublishExam,
  usePublishedExams,
  useSaveExamAnswer,
  useStartExam,
  useSubmitExam,
} from "@/hooks/use-academy-data";
import type { Json } from "@/types/database";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import { PageHeader, Status, Surface } from "./primitives";

const EXAM_ID_KEY = "ga_active_exam_id";
const ATTEMPT_ID_KEY = "ga_active_attempt_id";

const SKILL_LABELS: Record<string, string> = {
  lesen: "Lesen",
  hoeren: "Hören",
  schreiben: "Schreiben",
  sprechen: "Sprechen",
  grammatik: "Grammatik",
  wortschatz: "Wortschatz",
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

  const latestByExam = useMemo(() => {
    const map = new Map<string, NonNullable<typeof attemptsQuery.data>[number]>();
    for (const attempt of attemptsQuery.data ?? []) {
      if (!map.has(attempt.exam_id)) map.set(attempt.exam_id, attempt);
    }
    return map;
  }, [attemptsQuery.data]);

  return (
    <>
      <PageHeader
        title="Exams"
        subtitle="Published mock exams for your level. Timer and scoring are server-backed."
      />
      <QueryState
        isLoading={examsQuery.isLoading}
        isError={examsQuery.isError}
        error={examsQuery.error}
        isEmpty={!examsQuery.data?.length}
        emptyTitle="No exams available"
        emptyMessage="Published exams for your level will appear here."
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
                      {exam.level?.code ?? "—"} · {exam.duration_minutes} min
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">{exam.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {exam.description ?? "Mock examination"}
                    </p>
                  </div>
                  <Status tone="green">{exam.status}</Status>
                </div>
                {latest && latest.status !== "in_progress" && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Last result: {Number(latest.percentage ?? 0).toFixed(0)}% · {latest.status}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
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
                    {latest?.status === "in_progress" ? "Continue exam" : "Start exam"}
                  </Button>
                  {latest && latest.status !== "in_progress" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        persistExamSession(exam.id, latest.id);
                        navigate("exam-result");
                      }}
                    >
                      View result
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
        (section.questions ?? []).map((q) => ({ ...q, skill: section.skill, sectionTitle: section.title })),
      ),
    [examQuery.data],
  );

  const current = questions[index];
  const remaining = formatRemaining(attemptQuery.data?.expires_at);
  const expired =
    attemptQuery.data?.expires_at != null && new Date(attemptQuery.data.expires_at).getTime() <= now;

  useEffect(() => {
    if (!expired || !session.attemptId || submitExam.isPending) return;
    if (attemptQuery.data?.status !== "in_progress") return;
    submitExam.mutate(session.attemptId, {
      onSuccess: () => {
        toast.message("Time is up — exam submitted");
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

  if (!session.examId || !session.attemptId) {
    return (
      <Surface className="p-8 text-center">
        <p className="text-muted-foreground">No active exam session.</p>
        <Button className="mt-4" onClick={() => navigate("exams")}>
          Back to exams
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
      emptyTitle="Exam unavailable"
      emptyMessage="This exam has no questions yet."
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
              Exit
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
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((index + 1) / Math.max(questions.length, 1)) * 100}%` }}
            />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_14rem]">
          <Surface className="p-6 sm:p-8">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {current ? SKILL_LABELS[current.skill] ?? current.sectionTitle : ""}
            </p>
            <h2 className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">{current?.prompt}</h2>

            {current?.type === "listening" && (
              <div className="mt-5 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Headphones className="size-4" />
                  Audio
                </div>
                <p className="mt-2">
                  {current.media_path
                    ? "Audio available for this item."
                    : "Audio file not uploaded yet — answer based on the prompt to continue the demo."}
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
                      className={`flex w-full rounded-md border px-4 py-3 text-left text-sm transition ${
                        selected
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border hover:border-primary/40"
                      }`}
                      onClick={() => {
                        setLocalAnswers((prev) => ({ ...prev, [current.id]: option.value }));
                        persist(current.id, option.value);
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}

              {(current?.type === "writing" || current?.type === "text" || current?.type === "speaking") && (
                <Textarea
                  className="min-h-40"
                  value={answerValue(localAnswers[current.id])}
                  placeholder="Write your answer…"
                  onChange={(e) => {
                    const value = e.target.value;
                    setLocalAnswers((prev) => ({ ...prev, [current.id]: value }));
                  }}
                  onBlur={() => {
                    if (!current) return;
                    persist(current.id, localAnswers[current.id] ?? "");
                  }}
                />
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button variant="outline" disabled={index === 0} onClick={() => setIndex((v) => v - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={index >= questions.length - 1}
                  onClick={() => setIndex((v) => v + 1)}
                >
                  Next
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
                  {flagged[current?.id ?? ""] ? "Flagged" : "Flag"}
                </Button>
                <Button
                  disabled={submitExam.isPending}
                  onClick={() => {
                    if (!session.attemptId) return;
                    submitExam.mutate(session.attemptId, {
                      onSuccess: () => {
                        toast.success("Exam submitted");
                        navigate("exam-result");
                      },
                      onError: (err) => toast.error(err.message),
                    });
                  }}
                >
                  Submit
                </Button>
              </div>
            </div>
          </Surface>

          <Surface className="h-fit p-4">
            <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Navigator
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
              <p className="mt-3 text-xs text-muted-foreground">Saving…</p>
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
      emptyTitle="Result unavailable"
      emptyMessage="Submit an exam to see your score."
      onRetry={() => void resultQuery.refetch()}
    >
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => navigate("exams")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Exams
        </button>
        <section className="grid items-center gap-8 rounded-2xl bg-primary p-8 text-primary-foreground md:grid-cols-[auto_1fr] md:p-12">
          <div className="grid size-36 place-items-center rounded-full border-4 border-primary-foreground/20">
            <span className="font-display text-4xl">{percentage.toFixed(0)}%</span>
          </div>
          <div>
            <p className="text-xs tracking-wide uppercase text-primary-foreground/70">Your result</p>
            <h1 className="mt-2 font-display text-3xl md:text-4xl">
              {resultQuery.data?.passed ? "Passed" : "Needs improvement"}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-primary-foreground/75">
              {resultQuery.data?.exam?.title} · {resultQuery.data?.correct}/
              {resultQuery.data?.totalObjective} objective items correct. Writing/speaking may await
              teacher review.
            </p>
          </div>
        </section>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Performance by skill
            </h2>
            <div className="mt-5 space-y-4">
              {Object.keys(skills).length === 0 && (
                <p className="text-sm text-muted-foreground">No skill breakdown yet.</p>
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
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Next focus
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Review weaker objective skills, then practice writing with your teacher feedback when
                available.
              </p>
            </div>
            <Button onClick={() => navigate("courses")}>Continue learning</Button>
          </div>
        </div>
      </div>
    </QueryState>
  );
}

export function StaffExamsPage() {
  const examsQuery = useAllExams();
  return (
    <>
      <PageHeader title="Exams" subtitle="Assessments available to your classes." />
      <QueryState
        isLoading={examsQuery.isLoading}
        isError={examsQuery.isError}
        error={examsQuery.error}
        isEmpty={!examsQuery.data?.length}
        emptyTitle="No exams"
        emptyMessage="Admin can publish mock exams for each level."
        onRetry={() => void examsQuery.refetch()}
      >
        <div className="space-y-3">
          {examsQuery.data?.map((exam) => (
            <Surface className="flex flex-wrap items-center justify-between gap-3 p-5" key={exam.id}>
              <div>
                <h2 className="font-semibold">{exam.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {exam.level?.code} · {exam.duration_minutes} min · pass {exam.pass_percentage}%
                </p>
              </div>
              <Status tone={exam.status === "published" ? "green" : "amber"}>{exam.status}</Status>
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}

export function DirectorExamsPage() {
  const examsQuery = useAllExams();
  const levelsQuery = useLevels();
  const createExam = useCreateExam();
  const publishExam = usePublishExam();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [levelId, setLevelId] = useState("");

  return (
    <>
      <PageHeader
        title="Exam Management"
        subtitle="Create, publish and manage academy assessments."
        action={<Button onClick={() => setOpen(true)}>+ Create exam</Button>}
      />
      <QueryState
        isLoading={examsQuery.isLoading}
        isError={examsQuery.isError}
        error={examsQuery.error}
        isEmpty={!examsQuery.data?.length}
        emptyTitle="No exams yet"
        emptyMessage="Seeded mock exams should appear after Wave 3 migration."
        onRetry={() => void examsQuery.refetch()}
      >
        <div className="space-y-3">
          {examsQuery.data?.map((exam) => (
            <Surface className="flex flex-wrap items-center justify-between gap-3 p-5" key={exam.id}>
              <div>
                <h2 className="font-semibold">{exam.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {exam.level?.code} · {exam.duration_minutes} min ·{" "}
                  {exam.is_mock ? "Mock" : "Official"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Status tone={exam.status === "published" ? "green" : "amber"}>{exam.status}</Status>
                {exam.status !== "published" && (
                  <Button
                    size="sm"
                    disabled={publishExam.isPending}
                    onClick={() =>
                      publishExam.mutate(exam.id, {
                        onSuccess: () => toast.success("Exam published"),
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <Surface className="w-full max-w-lg space-y-4 p-6">
            <h2 className="text-lg font-semibold">Create exam</h2>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Exam title" />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
            >
              <option value="">Select level</option>
              {(levelsQuery.data ?? []).map((level) => (
                <option key={level.id} value={level.id}>
                  {level.code} · {level.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!title.trim() || !levelId || createExam.isPending}
                onClick={() => {
                  createExam.mutate(
                    { title: title.trim(), levelId },
                    {
                      onSuccess: () => {
                        toast.success("Exam created as draft");
                        setOpen(false);
                        setTitle("");
                        setLevelId("");
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
