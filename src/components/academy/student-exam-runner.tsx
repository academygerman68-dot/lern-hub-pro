import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock3, Flag, Headphones } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAllExams,
  useExam,
  useExamAnswers,
  useExamAttempt,
  useSaveExamAnswer,
  useSubmitExam,
  useUploadOralExamAnswer,
} from "@/hooks/use-academy-data";
import { isB1ModelltestCode } from "@/lib/b1-exam-readiness";
import {
  formatStudentFacingText,
  isStudentSafeQuestion,
} from "@/lib/b1-student-content";
import { countWritingStats, isManualQuestionType } from "@/lib/exam-writing";
import {
  hasOralAudioAnswer,
  isSpeakingQuestionType,
  isWritingOnlyQuestionType,
  parseOralAnswer,
} from "@/lib/exam-oral";
import {
  isChoiceQuestionType,
  loadPreviewDraft,
  pedagogicalQuestionLabel,
  questionTeil,
  savePreviewDraft,
  stableHorenAudioKey,
} from "@/lib/exam-runner-ux";
import { ExamService } from "@/services/academy-services";
import type { Json } from "@/types/database";
import { useAcademy } from "./academy-context";
import { ExamOralAnswerComposer } from "./exam-oral-recorder";
import { QueryState } from "./query-state";
import { ProgressLine, Surface } from "./primitives";

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

const SKILL_ORDER = ["lesen", "hoeren", "schreiben", "sprechen"] as const;

function readExamSession() {
  if (typeof sessionStorage === "undefined") {
    return { examId: null, attemptId: null };
  }
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

function readSearchParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key)?.trim() || "";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type RunnerMode = "live" | "preview";

export function StudentExamRunner({ mode = "live" }: { mode?: RunnerMode }) {
  const { navigate, role } = useAcademy();
  const isPreview = mode === "preview";
  const isStaff = role === "director" || role === "teacher";

  const liveSession = readExamSession();
  const examsQuery = useAllExams();
  const examIdFromSearch = readSearchParam("examId");
  const examCodeFromSearch = readSearchParam("examCode");

  const previewExamId = useMemo(() => {
    if (!isPreview) return "";
    if (examIdFromSearch) return examIdFromSearch;
    if (!examCodeFromSearch) return "";
    const hit = (examsQuery.data ?? []).find(
      (e) => e.code?.toUpperCase() === examCodeFromSearch.toUpperCase(),
    );
    return hit?.id ?? "";
  }, [isPreview, examIdFromSearch, examCodeFromSearch, examsQuery.data]);

  const examId = isPreview ? previewExamId : liveSession.examId;
  const attemptId = isPreview ? null : liveSession.attemptId;

  const examQuery = useExam(examId || undefined);
  const attemptQuery = useExamAttempt(isPreview ? null : attemptId);
  const answersQuery = useExamAnswers(isPreview ? null : attemptId);
  const saveAnswer = useSaveExamAnswer();
  const uploadOral = useUploadOralExamAnswer();
  const submitExam = useSubmitExam();

  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [localAnswers, setLocalAnswers] = useState<Record<string, Json>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [oralPreviewUrls, setOralPreviewUrls] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const dirtyRef = useRef<Set<string>>(new Set());
  const hydratedAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isPreview || !examId) return;
    const draft = loadPreviewDraft(examId);
    setLocalAnswers(draft.answers);
    setFlagged(draft.flagged);
    setIndex(draft.index);
  }, [isPreview, examId]);

  useEffect(() => {
    if (!isPreview || !examId) return;
    savePreviewDraft(examId, { answers: localAnswers, flagged, index });
  }, [isPreview, examId, localAnswers, flagged, index]);

  useEffect(() => {
    if (isPreview) return;
    const rows = answersQuery.data ?? [];
    const attemptKey = attemptId ?? "";
    if (hydratedAttemptRef.current !== attemptKey) {
      hydratedAttemptRef.current = attemptKey;
      dirtyRef.current = new Set();
      const next: Record<string, Json> = {};
      const flags: Record<string, boolean> = {};
      for (const row of rows) {
        next[row.question_id] = row.answer;
        flags[row.question_id] = row.flagged;
      }
      setLocalAnswers(next);
      setFlagged(flags);
    } else {
      setLocalAnswers((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (dirtyRef.current.has(row.question_id)) continue;
          next[row.question_id] = row.answer;
        }
        return next;
      });
      setFlagged((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (dirtyRef.current.has(row.question_id)) continue;
          next[row.question_id] = row.flagged;
        }
        return next;
      });
    }

    let cancelled = false;
    void (async () => {
      const urls: Record<string, string> = {};
      for (const row of rows) {
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
  }, [answersQuery.data, attemptId, isPreview]);

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

  const skillNav = useMemo(() => {
    const firstBySkill = new Map<string, number>();
    questions.forEach((q, i) => {
      if (!firstBySkill.has(q.skill)) firstBySkill.set(q.skill, i);
    });
    return SKILL_ORDER.filter((s) => firstBySkill.has(s)).map((skill) => ({
      skill,
      index: firstBySkill.get(skill)!,
      label: SKILL_LABELS[skill] ?? skill,
    }));
  }, [questions]);

  const teilNav = useMemo(() => {
    const current = questions[index];
    if (!current) return [] as Array<{ teil: number; index: number }>;
    const skill = current.skill;
    const firstByTeil = new Map<number, number>();
    questions.forEach((q, i) => {
      if (q.skill !== skill) return;
      const teil = questionTeil(q.metadata);
      if (teil == null) return;
      if (!firstByTeil.has(teil)) firstByTeil.set(teil, i);
    });
    return [...firstByTeil.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([teil, idx]) => ({ teil, index: idx }));
  }, [questions, index]);

  const current = questions[index];
  const currentMeta = current ? questionMeta(current.metadata) : {};
  const remaining = isPreview ? "Aperçu" : formatRemaining(attemptQuery.data?.expires_at);
  const expired =
    !isPreview &&
    attemptQuery.data?.expires_at != null &&
    new Date(attemptQuery.data.expires_at).getTime() <= now;

  useEffect(() => {
    if (isPreview || !expired || !attemptId || submitExam.isPending || submitting) return;
    if (attemptQuery.data?.status !== "in_progress") return;
    submitExam.mutate(attemptId, {
      onSuccess: () => {
        toast.message("Temps écoulé — examen envoyé");
        navigate("exam-result");
      },
      onError: (err) => toast.error(err.message),
    });
  }, [
    expired,
    attemptId,
    attemptQuery.data?.status,
    submitExam,
    navigate,
    isPreview,
    submitting,
  ]);

  const persist = (questionId: string, answer: Json, isFlagged?: boolean) => {
    dirtyRef.current.add(questionId);
    if (isPreview || !attemptId) return;
    saveAnswer.mutate(
      {
        attemptId,
        questionId,
        answer,
        flagged: isFlagged ?? flagged[questionId] ?? false,
      },
      {
        onSuccess: () => {
          dirtyRef.current.delete(questionId);
        },
        onError: (err) => {
          toast.error(err.message || "Échec de l’enregistrement");
        },
      },
    );
  };

  const flushPendingWrites = async () => {
    if (isPreview || !attemptId || !current) return;
    if (
      isWritingOnlyQuestionType(current.type) ||
      current.type === "form_fill" ||
      isManualQuestionType(current.type)
    ) {
      const value = localAnswers[current.id];
      if (value !== undefined) {
        try {
          await ExamService.saveAnswer({
            attemptId,
            questionId: current.id,
            answer: value,
            flagged: flagged[current.id] ?? false,
          });
          dirtyRef.current.delete(current.id);
        } catch (err) {
          throw err instanceof Error ? err : new Error("Échec de l’enregistrement");
        }
      }
    }
    let waits = 0;
    while (saveAnswer.isPending && waits < 40) {
      await sleep(100);
      waits += 1;
    }
  };

  const isSpeakingType = current ? isSpeakingQuestionType(current.type) : false;
  const isWritingType = current ? isWritingOnlyQuestionType(current.type) : false;
  const isFormFill = current?.type === "form_fill";
  const writingText = isWritingType && current ? answerValue(localAnswers[current.id]) : "";
  const writingStats = countWritingStats(writingText);
  const formFillDraft = isFormFill && current ? formFillAnswer(localAnswers[current.id]) : {};
  const formFillSerialized = JSON.stringify(formFillDraft);

  useEffect(() => {
    if (isPreview || !current || !attemptId) return;
    if (!isManualQuestionType(current.type)) return;
    const value = localAnswers[current.id];
    if (value === undefined) return;
    const timer = window.setTimeout(() => {
      persist(current.id, value);
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce local draft only
  }, [current?.id, current?.type, writingText, attemptId, isPreview]);

  useEffect(() => {
    if (isPreview || !current || !attemptId || current.type !== "form_fill") return;
    const value = localAnswers[current.id];
    if (value === undefined) return;
    const timer = window.setTimeout(() => {
      persist(current.id, value);
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce form_fill draft
  }, [current?.id, current?.type, formFillSerialized, attemptId, isPreview]);

  useEffect(() => {
    if (isPreview) return;
    const inProgress = attemptQuery.data?.status === "in_progress";
    if (!inProgress) return;

    const hasWritingOrSpeakingDraft = Object.entries(localAnswers).some(([questionId, raw]) => {
      const q = questions.find((item) => item.id === questionId);
      if (!q) return false;
      if (isWritingOnlyQuestionType(q.type)) {
        return typeof raw === "string" ? raw.trim().length > 0 : Boolean(raw);
      }
      if (isSpeakingQuestionType(q.type)) {
        return hasOralAudioAnswer({ answer: raw }) || Boolean(parseOralAnswer(raw));
      }
      return false;
    });

    if (!hasWritingOrSpeakingDraft) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [attemptQuery.data?.status, localAnswers, questions, isPreview]);

  if (isPreview && !isStaff) {
    return (
      <Surface className="p-8 text-center">
        <p className="text-muted-foreground">Aperçu réservé au personnel.</p>
        <Button className="mt-4" onClick={() => navigate("exams")}>
          Retour aux examens
        </Button>
      </Surface>
    );
  }

  if (!isPreview && (!examId || !attemptId)) {
    return (
      <Surface className="p-8 text-center">
        <p className="text-muted-foreground">Aucune session d’examen en cours.</p>
        <Button className="mt-4" onClick={() => navigate("exams")}>
          Retour aux examens
        </Button>
      </Surface>
    );
  }

  if (isPreview && !examId) {
    return (
      <Surface className="p-8 text-center">
        <p className="text-muted-foreground">Sélectionnez un examen pour l’aperçu.</p>
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
  const sprechenRole =
    typeof currentMeta["role"] === "string" && currentMeta["role"].trim()
      ? currentMeta["role"].trim()
      : null;
  const formFields = Array.isArray(currentMeta["fields"])
    ? currentMeta["fields"].filter(
        (field): field is { key: string; points: number } =>
          Boolean(field) &&
          typeof field === "object" &&
          typeof (field as { key?: unknown }).key === "string",
      )
    : [];

  const currentTeil = current ? questionTeil(current.metadata) : null;
  const audioPlayerKey = current
    ? stableHorenAudioKey({
        skill: current.skill,
        type: current.type,
        metadata: current.metadata,
        audioUrl,
        questionId: current.id,
      })
    : "none";
  const showModuleNav = skillNav.length > 1 || teilNav.length > 1;
  const isB1 = isB1ModelltestCode(examQuery.data?.code);
  const indexInSkill = current
    ? questions.filter((q) => q.skill === current.skill).findIndex((q) => q.id === current.id)
    : 0;
  const skillQuestionCount = current
    ? questions.filter((q) => q.skill === current.skill).length
    : 0;
  const pedLabel = current
    ? pedagogicalQuestionLabel({
        skill: current.skill,
        sortOrder: current.sort_order,
        metadata: current.metadata,
        indexInSkill: Math.max(0, indexInSkill),
      })
    : "";
  const contentSafe =
    !current ||
    !isB1 ||
    isPreview ||
    isStudentSafeQuestion({ prompt: current.prompt, metadata: current.metadata });
  const displayPrompt =
    current && contentSafe
      ? isB1
        ? formatStudentFacingText(current.prompt)
        : current.prompt
      : "";
  const displayInstruction =
    instruction && contentSafe
      ? isB1
        ? formatStudentFacingText(instruction)
        : instruction
      : null;
  const prevPassage =
    index > 0 && questions[index - 1]
      ? (() => {
          const prev = questions[index - 1]!;
          const prevMeta = questionMeta(prev.metadata);
          return typeof prevMeta["passage"] === "string" ? prevMeta["passage"] : null;
        })()
      : null;
  const displayPassage =
    passage && contentSafe && passage !== prevPassage
      ? isB1
        ? formatStudentFacingText(passage)
        : passage
      : null;

  return (
    <QueryState
      isLoading={examQuery.isLoading || (!isPreview && attemptQuery.isLoading)}
      isError={examQuery.isError || (!isPreview && attemptQuery.isError)}
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
              <p className="truncate text-sm font-medium">
                {examQuery.data?.title}
                {isPreview ? (
                  <span className="ml-2 rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-200">
                    Aperçu
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {current ? (SKILL_LABELS[current.skill] ?? current.sectionTitle) : ""}
                {currentTeil != null ? ` · Teil ${currentTeil}` : ""} · {pedLabel}
                {skillQuestionCount > 0
                  ? ` (${indexInSkill + 1}/${skillQuestionCount} dans le module)`
                  : ""}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-md border border-alert/20 bg-alert-soft px-3 py-1.5 text-sm font-medium text-alert">
              <Clock3 className="size-4" />
              {remaining}
            </span>
          </div>
          {showModuleNav ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {skillNav.map((item) => (
                <button
                  key={item.skill}
                  type="button"
                  onClick={() => setIndex(item.index)}
                  className={`rounded-md border px-2.5 py-1 text-xs ${
                    current?.skill === item.skill
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {teilNav.map((item) => (
                <button
                  key={`teil-${item.teil}`}
                  type="button"
                  onClick={() => setIndex(item.index)}
                  className={`rounded-md border px-2.5 py-1 text-xs ${
                    currentTeil === item.teil
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  Teil {item.teil}
                </button>
              ))}
            </div>
          ) : null}
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
            {!contentSafe ? (
              <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
                <p className="font-medium text-foreground">{pedLabel} — contenu indisponible</p>
                <p className="mt-1 text-muted-foreground">
                  Cette question n’est pas encore prête pour les étudiants (transcription à
                  vérifier). Elle reste comptée dans l’examen ; contactez votre professeur.
                </p>
              </div>
            ) : null}
            {displayInstruction ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{displayInstruction}</p>
            ) : null}
            {displayPassage ? (
              <div className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm leading-6">
                {displayPassage}
              </div>
            ) : null}
            {contentSafe ? (
              <h2 className="mt-4 text-xl font-semibold leading-snug sm:text-2xl">
                {displayPrompt}
              </h2>
            ) : null}

            {isSpeakingType && sprechenRole ? (
              <p className="mt-3 text-sm font-medium text-foreground">
                Rôle : Kandidat {sprechenRole}
              </p>
            ) : null}

            {isSpeakingType && isB1 && currentMeta["support_only"] === true ? (
              <p className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Support candidat — utilisez le rôle indiqué ; ne présentez pas les deux sujets sauf
                consigne contraire.
              </p>
            ) : null}

            {(current?.type === "listening" || current?.skill === "hoeren") && (
              <div className="mt-5 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Headphones className="size-4" />
                  Audio{currentTeil != null ? ` · Teil ${currentTeil}` : ""}
                </div>
                {audioUrl ? (
                  <audio
                    key={audioPlayerKey}
                    className="mt-3 w-full"
                    controls
                    src={audioUrl}
                    preload="metadata"
                  >
                    Votre navigateur ne prend pas en charge l’audio.
                  </audio>
                ) : (
                  <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <p className="font-medium">Audio Hören indisponible</p>
                    <p className="mt-1 text-destructive/90">
                      {typeof currentMeta["audio_error"] === "string"
                        ? currentMeta["audio_error"]
                        : "Aucun fichier audio n’est associé à cette question. Impossible de démarrer l’écoute — contactez votre professeur."}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 space-y-3">
              {contentSafe && current && isChoiceQuestionType(current.type) &&
                (current.options ?? []).map((option) => {
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

              {contentSafe && current?.type === "form_fill" && (
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
                          dirtyRef.current.add(current.id);
                        }}
                        onBlur={() => {
                          persist(current.id, formFillAnswer(localAnswers[current.id]));
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}

              {contentSafe && isSpeakingType && current && (isPreview || attemptId) ? (
                <ExamOralAnswerComposer
                  disabled={
                    isPreview
                      ? false
                      : expired || attemptQuery.data?.status !== "in_progress"
                  }
                  hasAudio={
                    isPreview
                      ? Boolean(oralPreviewUrls[current.id])
                      : hasOralAudioAnswer({
                          answer: localAnswers[current.id],
                          answer_media_path:
                            (answersQuery.data ?? []).find((row) => row.question_id === current.id)
                              ?.answer_media_path ?? null,
                        })
                  }
                  previewUrl={oralPreviewUrls[current.id] ?? null}
                  uploading={uploadOral.isPending}
                  onUpload={async (file) => {
                    if (isPreview) {
                      const url = URL.createObjectURL(file);
                      setOralPreviewUrls((prev) => ({ ...prev, [current.id]: url }));
                      setLocalAnswers((prev) => ({
                        ...prev,
                        [current.id]: { preview: true, name: file.name },
                      }));
                      toast.message("Aperçu — audio non enregistré sur le serveur");
                      return;
                    }
                    const saved = await uploadOral.mutateAsync({
                      attemptId: attemptId!,
                      questionId: current.id,
                      file,
                      flagged: flagged[current.id] ?? false,
                    });
                    dirtyRef.current.delete(current.id);
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

              {contentSafe && isWritingType && current && (
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
                      dirtyRef.current.add(current.id);
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
                  onClick={() => {
                    void flushPendingWrites()
                      .then(() => setIndex((v) => v - 1))
                      .catch((err: Error) => toast.error(err.message));
                  }}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  disabled={index >= questions.length - 1}
                  onClick={() => {
                    void flushPendingWrites()
                      .then(() => setIndex((v) => v + 1))
                      .catch((err: Error) => toast.error(err.message));
                  }}
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
                {isPreview ? (
                  <Button variant="secondary" onClick={() => navigate("exams")}>
                    Fermer l’aperçu
                  </Button>
                ) : (
                  <Button
                    disabled={submitExam.isPending || submitting || saveAnswer.isPending}
                    onClick={() => {
                      if (!attemptId) return;
                      setSubmitting(true);
                      void flushPendingWrites()
                        .then(
                          () =>
                            new Promise<void>((resolve, reject) => {
                              submitExam.mutate(attemptId, {
                                onSuccess: () => resolve(),
                                onError: (err) => reject(err),
                              });
                            }),
                        )
                        .then(() => {
                          toast.success("Examen envoyé");
                          navigate("exam-result");
                        })
                        .catch((err: Error) => {
                          toast.error(err.message || "Remise impossible");
                        })
                        .finally(() => setSubmitting(false));
                    }}
                  >
                    Envoyer
                  </Button>
                )}
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
                    onClick={() => {
                      void flushPendingWrites()
                        .then(() => setIndex(i))
                        .catch((err: Error) => toast.error(err.message));
                    }}
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
            {!isPreview && saveAnswer.isPending ? (
              <p className="mt-3 text-xs text-muted-foreground">Enregistrement…</p>
            ) : null}
            {!isPreview && saveAnswer.isError ? (
              <p className="mt-3 text-xs text-destructive">Échec d’enregistrement</p>
            ) : null}
            {isPreview ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Mode aperçu — aucune tentative officielle.
              </p>
            ) : null}
          </Surface>
        </div>
      </div>
    </QueryState>
  );
}

export function StudentExamStaffPreview() {
  return <StudentExamRunner mode="preview" />;
}
