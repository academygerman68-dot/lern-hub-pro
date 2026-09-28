import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, Status, Surface } from "@/components/academy/primitives";
import { QueryState } from "@/components/academy/query-state";
import { useAcademy } from "@/components/academy/academy-context";
import {
  TrainingActivityRenderer,
  type ActivityAnswerValue,
} from "@/components/academy/training/training-activity-views";
import { TrainingService } from "@/services/supabase/training-service";
import { queryKeys } from "@/lib/query-keys";
import {
  TRAINING_ANSWER_STATUS_LABELS,
  TRAINING_SAVE_STATUS_LABELS,
  TRAINING_SKILL_LABELS,
  activityStatusFromAnswer,
  isManualActivityType,
  isObjectiveActivityType,
  persistTrainingNav,
  progressPercent,
  type StudentTrainingDefinition,
  type TrainingSaveStatus,
} from "@/lib/training-runner-ux";

type Props = {
  code: string;
  preview?: boolean;
  onExit?: () => void;
};

function parseStoredAnswer(raw: unknown): ActivityAnswerValue | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as ActivityAnswerValue;
}

export function TrainingModuleRunner({ code, preview = false, onExit }: Props) {
  const { navigate, role } = useAcademy();
  const qc = useQueryClient();
  const [activityIndex, setActivityIndex] = useState(0);
  const [localAnswer, setLocalAnswer] = useState<ActivityAnswerValue | null>(null);
  const [saveStatus, setSaveStatus] = useState<TrainingSaveStatus>("idle");
  const [dirty, setDirty] = useState(false);
  const [screen, setScreen] = useState<"run" | "recap" | "done">("run");
  const saveSeq = useRef(0);
  const autosaveTimer = useRef<number | null>(null);
  const inFlight = useRef(false);

  const moduleQuery = useQuery({
    queryKey: queryKeys.training.module(code, preview),
    queryFn: () => TrainingService.getModuleForLearner(code, preview),
  });

  const attemptQuery = useQuery({
    queryKey: queryKeys.training.attempt(code, preview),
    queryFn: () => TrainingService.startOrResume(code, preview ? "preview" : "live"),
    enabled: Boolean(moduleQuery.data),
    staleTime: Infinity,
  });

  const attemptId = attemptQuery.data?.id ?? null;

  const answersQuery = useQuery({
    queryKey: queryKeys.training.answers(attemptId ?? "none"),
    queryFn: () => TrainingService.listAnswers(attemptId!),
    enabled: Boolean(attemptId),
  });

  const definition = moduleQuery.data?.definition as StudentTrainingDefinition | undefined;
  const activities = useMemo(
    () =>
      [...(definition?.activities ?? [])].sort((a, b) => a.order - b.order),
    [definition],
  );

  const activity = activities[activityIndex] ?? null;
  const answerMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof answersQuery.data>[number]>();
    for (const row of answersQuery.data ?? []) map.set(row.activity_id, row);
    return map;
  }, [answersQuery.data]);

  const [oralMedia, setOralMedia] = useState<{
    bucket: string;
    path: string;
    mimeType: string;
  } | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    persistTrainingNav({ code, attemptId, preview });
  }, [attemptId, code, preview]);

  useEffect(() => {
    if (!attemptQuery.data?.current_activity_id || !activities.length) return;
    const idx = activities.findIndex((a) => a.id === attemptQuery.data!.current_activity_id);
    if (idx >= 0) setActivityIndex(idx);
  }, [attemptQuery.data?.current_activity_id, activities]);

  useEffect(() => {
    if (!activity) return;
    const row = answerMap.get(activity.id);
    setLocalAnswer(parseStoredAnswer(row?.answer ?? null));
    setDirty(false);
    setSaveStatus("idle");
  }, [activity?.id, answerMap]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const persistDraft = useCallback(
    async (answer: ActivityAnswerValue, activityId: string, activityType: string) => {
      if (!attemptId) return;
      if (inFlight.current) return;
      const seq = ++saveSeq.current;
      inFlight.current = true;
      setSaveStatus("saving");
      try {
        await TrainingService.saveDraft({
          attemptId,
          activityId,
          activityType,
          answer: answer as never,
          currentActivityId: activityId,
        });
        if (seq !== saveSeq.current) return;
        setSaveStatus("saved");
        setDirty(false);
        await qc.invalidateQueries({ queryKey: queryKeys.training.answers(attemptId) });
      } catch {
        if (seq !== saveSeq.current) return;
        setSaveStatus("error");
      } finally {
        inFlight.current = false;
      }
    },
    [attemptId, qc],
  );

  const scheduleAutosave = useCallback(
    (answer: ActivityAnswerValue) => {
      if (!activity) return;
      setLocalAnswer(answer);
      setDirty(true);
      setSaveStatus("idle");
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      const isChoice =
        activity.activity_type === "single_choice" ||
        activity.activity_type === "multiple_choice" ||
        activity.activity_type === "true_false" ||
        activity.activity_type === "listening";
      const delay = isChoice ? 0 : 900;
      autosaveTimer.current = window.setTimeout(() => {
        void persistDraft(answer, activity.id, activity.activity_type);
      }, delay);
    },
    [activity, persistDraft],
  );

  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!attemptId || !activity || !localAnswer) throw new Error("Réponse manquante");
      if (dirty) await persistDraft(localAnswer, activity.id, activity.activity_type);
      return TrainingService.validateObjective({
        attemptId,
        activityId: activity.id,
        answer: localAnswer as never,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.training.answers(attemptId!) });
    },
  });

  const submitManualMutation = useMutation({
    mutationFn: async () => {
      if (!attemptId || !activity || !localAnswer) throw new Error("Réponse manquante");
      if (dirty) await persistDraft(localAnswer, activity.id, activity.activity_type);
      const row = answerMap.get(activity.id);
      const mediaFromAnswer =
        localAnswer && "media" in localAnswer && localAnswer.media
          ? localAnswer.media
          : null;
      return TrainingService.submitManual({
        attemptId,
        activityId: activity.id,
        activityType: activity.activity_type as "writing" | "speaking",
        answer: localAnswer as never,
        mediaBucket: oralMedia?.bucket ?? mediaFromAnswer?.bucket ?? row?.answer_media_bucket ?? null,
        mediaPath: oralMedia?.path ?? mediaFromAnswer?.path ?? row?.answer_media_path ?? null,
        mimeType: oralMedia?.mimeType ?? row?.answer_mime_type ?? null,
        durationSeconds: row?.answer_duration_seconds ?? null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.training.answers(attemptId!) });
      await qc.invalidateQueries({ queryKey: queryKeys.training.attempt(code, preview) });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!attemptId) throw new Error("Tentative manquante");
      return TrainingService.completeAttempt(attemptId);
    },
    onSuccess: async () => {
      setScreen("done");
      await qc.invalidateQueries({ queryKey: queryKeys.training.attempt(code, preview) });
    },
  });

  const doneCount = activities.filter((a) => {
    const st = activityStatusFromAnswer(answerMap.get(a.id) ?? null);
    return (
      st === "validated" ||
      st === "answered" ||
      st === "pending_review" ||
      st === "review"
    );
  }).length;

  const goExit = () => {
    if (dirty && !window.confirm("Des réponses ne sont pas encore enregistrées. Quitter quand même ?")) {
      return;
    }
    if (onExit) onExit();
    else if (role === "student") navigate("training");
    else navigate(preview ? "training-preview" : "training");
  };

  if (attemptQuery.data?.status === "completed" && screen === "run") {
    // keep run until user opens recap
  }

  return (
    <QueryState
      isLoading={moduleQuery.isLoading || attemptQuery.isLoading}
      isError={moduleQuery.isError || attemptQuery.isError}
      error={(moduleQuery.error || attemptQuery.error) as Error | null}
      onRetry={() => {
        void moduleQuery.refetch();
        void attemptQuery.refetch();
      }}
    >
      {!definition || !activity ? (
        <Surface className="p-6">
          <p className="text-sm text-muted-foreground">Module sans activités.</p>
        </Surface>
      ) : (
        <div className="space-y-4">
          {preview ? (
            <div
              className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              MODE APERÇU — BROUILLON · aucune progression étudiante officielle
            </div>
          ) : null}

          <PageHeader
            title={definition.title}
            subtitle={`${definition.module_id} · ${definition.level} · entraînement (pas un examen)`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                {saveStatus !== "idle" ? (
                  <span
                    className={`text-xs ${
                      saveStatus === "error" ? "text-destructive" : "text-muted-foreground"
                    }`}
                    aria-live="polite"
                  >
                    {TRAINING_SAVE_STATUS_LABELS[saveStatus]}
                  </span>
                ) : null}
                {saveStatus === "error" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (localAnswer && activity) {
                        void persistDraft(localAnswer, activity.id, activity.activity_type);
                      }
                    }}
                  >
                    Réessayer
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={goExit}>
                  Quitter
                </Button>
              </div>
            }
          />

          {screen === "run" ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Activité {activityIndex + 1} / {activities.length}
                  </span>
                  <span>{progressPercent(doneCount, activities.length)} %</span>
                </div>
                <Progress value={progressPercent(doneCount, activities.length)} />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Activités">
                {activities.map((a, i) => {
                  const st = activityStatusFromAnswer(answerMap.get(a.id) ?? null);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="listitem"
                      className={`min-h-11 shrink-0 rounded-lg border px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        i === activityIndex ? "border-primary bg-primary/10" : "border-border"
                      }`}
                      onClick={() => {
                        if (dirty && localAnswer && activity) {
                          void persistDraft(localAnswer, activity.id, activity.activity_type);
                        }
                        setActivityIndex(i);
                      }}
                    >
                      {a.order}. {TRAINING_ANSWER_STATUS_LABELS[st]}
                    </button>
                  );
                })}
              </div>

              <Surface className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Status tone="blue">
                    {TRAINING_SKILL_LABELS[activity.skill] ?? activity.skill}
                  </Status>
                  <Status>
                    {TRAINING_ANSWER_STATUS_LABELS[
                      activityStatusFromAnswer(answerMap.get(activity.id) ?? null)
                    ]}
                  </Status>
                </div>
                <p className="text-sm text-muted-foreground">{activity.instruction}</p>
                <h2 className="font-display text-xl font-medium" lang="de">
                  {activity.prompt}
                </h2>
                <TrainingActivityRenderer
                  activity={activity}
                  disabled={
                    validateMutation.isPending ||
                    submitManualMutation.isPending ||
                    answerMap.get(activity.id)?.status === "pending_review"
                  }
                  value={localAnswer}
                  onChange={scheduleAutosave}
                  feedback={{
                    isCorrect: answerMap.get(activity.id)?.is_correct ?? null,
                    explanation: answerMap.get(activity.id)?.explanation ?? null,
                    positive: answerMap.get(activity.id)?.positive_feedback ?? null,
                    commonError: answerMap.get(activity.id)?.common_error ?? null,
                    teacherComment: answerMap.get(activity.id)?.teacher_comment ?? null,
                  }}
                  onUploadOral={async (file) => {
                    if (!attemptId) throw new Error("Tentative manquante");
                    const existing = answerMap.get(activity.id);
                    const uploaded = await TrainingService.uploadOral({
                      attemptId,
                      activityId: activity.id,
                      file,
                      mimeType: file.type || "audio/webm",
                      previousPath:
                        oralMedia?.path ??
                        existing?.answer_media_path ??
                        (localAnswer && "media" in localAnswer
                          ? localAnswer.media?.path
                          : null) ??
                        null,
                    });
                    setOralMedia(uploaded);
                    const next: ActivityAnswerValue = {
                      media: { bucket: uploaded.bucket, path: uploaded.path },
                    };
                    setLocalAnswer(next);
                    await persistDraft(next, activity.id, activity.activity_type);
                  }}
                />

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    disabled={activityIndex === 0}
                    onClick={() => setActivityIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="mr-1 size-4" />
                    Précédent
                  </Button>
                  {isObjectiveActivityType(activity.activity_type) ? (
                    <Button
                      className="min-h-11"
                      disabled={!localAnswer || validateMutation.isPending}
                      onClick={() => validateMutation.mutate()}
                    >
                      Valider
                    </Button>
                  ) : null}
                  {isManualActivityType(activity.activity_type) ? (
                    <Button
                      className="min-h-11"
                      disabled={!localAnswer || submitManualMutation.isPending}
                      onClick={() => submitManualMutation.mutate()}
                    >
                      Envoyer pour correction
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    className="min-h-11"
                    disabled={activityIndex >= activities.length - 1}
                    onClick={() =>
                      setActivityIndex((i) => Math.min(activities.length - 1, i + 1))
                    }
                  >
                    Suivant
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                  {activityIndex === activities.length - 1 ? (
                    <Button
                      variant="outline"
                      className="min-h-11"
                      onClick={() => setScreen("recap")}
                    >
                      <Flag className="mr-1 size-4" />
                      Récapitulatif
                    </Button>
                  ) : null}
                </div>
                {validateMutation.isError ? (
                  <p className="text-sm text-destructive">
                    {(validateMutation.error as Error).message}
                  </p>
                ) : null}
              </Surface>
            </>
          ) : null}

          {screen === "recap" || screen === "done" ? (
            <Surface className="space-y-4 p-5">
              <h2 className="font-display text-xl font-medium">
                {screen === "done" ? "Module terminé" : "Récapitulatif"}
              </h2>
              <ul className="space-y-2 text-sm">
                {activities.map((a) => {
                  const row = answerMap.get(a.id);
                  const st = activityStatusFromAnswer(row ?? null);
                  return (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <span>
                        {a.order}. {TRAINING_SKILL_LABELS[a.skill] ?? a.skill}
                      </span>
                      <Status
                        {...(st === "validated"
                          ? { tone: "green" as const }
                          : st === "review"
                            ? { tone: "amber" as const }
                            : st === "pending_review"
                              ? { tone: "blue" as const }
                              : {})}
                      >
                        {TRAINING_ANSWER_STATUS_LABELS[st]}
                      </Status>
                    </li>
                  );
                })}
              </ul>
              {screen === "done" ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Acquis : activités validées. Erreurs : activités « à revoir ». Les Schreibens /
                    Sprechens restent sans score automatique trompeur.
                  </p>
                  <p>
                    Recommandation : révisez le vocabulaire de présentation et réécoutez le dialogue
                    Hören si besoin.
                  </p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {screen === "recap" ? (
                  <>
                    <Button variant="outline" onClick={() => setScreen("run")}>
                      Continuer
                    </Button>
                    <Button
                      disabled={completeMutation.isPending}
                      onClick={() => completeMutation.mutate()}
                    >
                      Terminer le module
                    </Button>
                  </>
                ) : (
                  <Button onClick={goExit}>Retour à l’entraînement</Button>
                )}
              </div>
            </Surface>
          ) : null}
        </div>
      )}
    </QueryState>
  );
}

