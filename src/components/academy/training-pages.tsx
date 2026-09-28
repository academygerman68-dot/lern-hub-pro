import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  PageHeader,
  Status,
  Surface,
  TableScroll,
} from "@/components/academy/primitives";
import { QueryState } from "@/components/academy/query-state";
import { useAcademy } from "@/components/academy/academy-context";
import { TrainingModuleRunner } from "@/components/academy/training/training-runner";
import { TrainingService, type TrainingAnswerRow } from "@/services/supabase/training-service";
import { queryKeys } from "@/lib/query-keys";
import {
  TRAINING_SKILL_LABELS,
  persistTrainingNav,
  readTrainingNav,
  type StudentTrainingDefinition,
} from "@/lib/training-runner-ux";

function useTrainingCode(fallback?: string | null) {
  return useMemo(() => {
    const nav = readTrainingNav();
    return fallback ?? nav.code;
  }, [fallback]);
}

export function StudentTrainingCatalogPage() {
  const { navigate, role } = useAcademy();
  const catalogQuery = useQuery({
    queryKey: queryKeys.training.catalog,
    queryFn: () => TrainingService.listModulesForCatalog(),
  });

  const isStaff = role === "teacher" || role === "director";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entraînement"
        subtitle="Modules de pratique (ga_training_module_v1) — distincts des examens blancs. Pas de chronomètre Goethe ni de certificat."
        action={
          isStaff ? (
            <Button variant="outline" onClick={() => navigate("training-preview")}>
              Aperçu staff
            </Button>
          ) : null
        }
      />
      <QueryState
        isLoading={catalogQuery.isLoading}
        isError={catalogQuery.isError}
        error={catalogQuery.error as Error | null}
        isEmpty={!catalogQuery.data?.length}
        emptyTitle="Aucun module publié"
        emptyMessage={
          isStaff
            ? "Les brouillons restent invisibles aux étudiants. Utilisez l’aperçu staff pour GA-A1-M01."
            : "Les modules d’entraînement apparaîtront ici dès publication."
        }
        onRetry={() => void catalogQuery.refetch()}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(catalogQuery.data ?? []).map((mod) => (
            <Surface key={mod.id} className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {mod.code} · {mod.level_code}
                  </p>
                  <h2 className="font-display text-lg font-medium">{mod.title}</h2>
                </div>
                <Status tone={mod.status === "published" ? "green" : "amber"}>
                  {mod.status === "published" ? "Publié" : "Brouillon"}
                </Status>
              </div>
              {mod.theme ? <p className="text-sm text-muted-foreground">{mod.theme}</p> : null}
              <p className="text-xs text-muted-foreground">≈ {mod.estimated_minutes} min</p>
              <Button
                className="min-h-11"
                onClick={() => {
                  const isDraft = mod.status !== "published";
                  persistTrainingNav({
                    code: mod.code,
                    preview: isDraft && isStaff,
                  });
                  navigate(isDraft && isStaff ? "training-module" : "training-module");
                }}
              >
                <BookOpen className="mr-2 size-4" />
                Voir le module
              </Button>
            </Surface>
          ))}
        </div>
      </QueryState>
    </div>
  );
}

export function TrainingModuleOverviewPage({ preview = false }: { preview?: boolean }) {
  const { navigate } = useAcademy();
  const code = useTrainingCode();
  const [running, setRunning] = useState(false);
  const moduleQuery = useQuery({
    queryKey: queryKeys.training.module(code ?? "none", preview),
    queryFn: () => TrainingService.getModuleForLearner(code!, preview),
    enabled: Boolean(code),
  });

  if (!code) {
    return (
      <EmptyState
        title="Aucun module sélectionné"
        message="Choisissez un module dans le catalogue d’entraînement."
        action={
          <Button onClick={() => navigate(preview ? "training-preview" : "training")}>
            Retour
          </Button>
        }
      />
    );
  }

  const def = moduleQuery.data?.definition as StudentTrainingDefinition | undefined;

  if (running) {
    return (
      <TrainingModuleRunner
        code={code}
        preview={preview}
        onExit={() => {
          setRunning(false);
          navigate(preview ? "training-preview" : "training");
        }}
      />
    );
  }

  return (
    <QueryState
      isLoading={moduleQuery.isLoading}
      isError={moduleQuery.isError}
      error={moduleQuery.error as Error | null}
      onRetry={() => void moduleQuery.refetch()}
    >
      {preview ? (
        <div
          className="mb-4 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          MODE APERÇU — BROUILLON
        </div>
      ) : null}
      <PageHeader
        title={def?.title ?? code}
        subtitle={`${code} · ${def?.level ?? ""} · module d’entraînement`}
        action={
          <Button variant="ghost" onClick={() => navigate(preview ? "training-preview" : "training")}>
            Catalogue
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Surface className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">{def?.theme}</p>
          {def?.subtitle ? <p className="text-sm">{def.subtitle}</p> : null}
          <div>
            <h3 className="text-sm font-semibold">Objectifs</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {(def?.learning_objectives ?? []).map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Prérequis</h3>
            {(def?.prerequisites ?? []).length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {(def?.prerequisites ?? []).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Aucun prérequis.</p>
            )}
          </div>
          <Button className="min-h-11" onClick={() => setRunning(true)}>
            <Play className="mr-2 size-4" />
            Commencer ou reprendre
          </Button>
        </Surface>
        <Surface className="space-y-3 p-5 text-sm">
          <p>
            <span className="font-medium">Durée estimée :</span> {def?.estimated_minutes ?? "—"} min
          </p>
          <p>
            <span className="font-medium">Compétences :</span>{" "}
            {(def?.skills ?? [])
              .map((s) => TRAINING_SKILL_LABELS[s] ?? s)
              .join(", ")}
          </p>
          <p>
            <span className="font-medium">Activités :</span> {def?.activities?.length ?? 0}
          </p>
          <p className="text-muted-foreground">
            Progression et reprise sont enregistrées côté serveur. Une tentative active est reprise,
            jamais dupliquée.
          </p>
        </Surface>
      </div>
    </QueryState>
  );
}

export function StaffTrainingPreviewPage() {
  const { navigate } = useAcademy();
  const catalogQuery = useQuery({
    queryKey: queryKeys.training.catalog,
    queryFn: () => TrainingService.listModulesForCatalog(),
  });
  const drafts = (catalogQuery.data ?? []).filter((m) => m.status !== "archived");

  return (
    <div className="space-y-6">
      <div
        className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
        role="status"
      >
        MODE APERÇU — BROUILLON · tentatives `preview` isolées
      </div>
      <PageHeader
        title="Aperçu modules d’entraînement"
        subtitle="Testez le runner réel sans publier. Les étudiants ne voient pas les brouillons."
      />
      <QueryState
        isLoading={catalogQuery.isLoading}
        isError={catalogQuery.isError}
        error={catalogQuery.error as Error | null}
        isEmpty={!drafts.length}
        emptyTitle="Aucun module"
        emptyMessage="Seed GA-A1-M01 manquant ?"
        onRetry={() => void catalogQuery.refetch()}
      >
        <div className="grid gap-3">
          {drafts.map((mod) => (
            <Surface key={mod.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {mod.code} — {mod.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mod.level_code} · {mod.status} · ≈ {mod.estimated_minutes} min
                </p>
              </div>
              <Button
                className="min-h-11"
                onClick={() => {
                  persistTrainingNav({ code: mod.code, preview: true });
                  navigate("training-module");
                }}
              >
                Ouvrir l’aperçu
              </Button>
            </Surface>
          ))}
        </div>
      </QueryState>
    </div>
  );
}

function TeacherTrainingGradePanel({
  answer,
  onDone,
}: {
  answer: TrainingAnswerRow;
  onDone: () => void;
}) {
  const [points, setPoints] = useState(String(answer.points_awarded ?? 0));
  const [comment, setComment] = useState(answer.teacher_comment ?? "");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const gradeMutation = useMutation({
    mutationFn: (finalize: boolean) =>
      TrainingService.gradeManual({
        answerId: answer.id,
        points: Number(points) || 0,
        teacherComment: comment,
        finalize,
      }),
    onSuccess: () => onDone(),
  });

  return (
    <Surface className="mt-3 space-y-3 p-4">
      <p className="text-sm font-medium">
        {answer.activity_type} · {answer.activity_id}
      </p>
      <pre className="max-h-40 overflow-auto rounded-lg bg-muted/40 p-3 text-xs whitespace-pre-wrap">
        {JSON.stringify(answer.answer, null, 2)}
      </pre>
      {answer.answer_media_bucket && answer.answer_media_path ? (
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void TrainingService.getOralSignedUrl(
                answer.answer_media_bucket!,
                answer.answer_media_path!,
              ).then(setAudioUrl);
            }}
          >
            Écouter (URL signée)
          </Button>
          {audioUrl ? <audio className="w-full" controls src={audioUrl} /> : null}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`pts-${answer.id}`}>Points</Label>
          <Input
            id={`pts-${answer.id}`}
            type="number"
            min={0}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`cmt-${answer.id}`}>Commentaire enseignant</Label>
        <Textarea
          id={`cmt-${answer.id}`}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={gradeMutation.isPending}
          onClick={() => gradeMutation.mutate(false)}
        >
          Brouillon feedback
        </Button>
        <Button disabled={gradeMutation.isPending} onClick={() => gradeMutation.mutate(true)}>
          Finaliser
        </Button>
      </div>
    </Surface>
  );
}

export function TeacherTrainingCorrectionsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);

  const attemptsQuery = useQuery({
    queryKey: queryKeys.training.teacherAttempts,
    queryFn: () => TrainingService.listLiveAttemptsForTeacher(),
  });

  const answersQuery = useQuery({
    queryKey: queryKeys.training.answers(openAttemptId ?? "none"),
    queryFn: () => TrainingService.listAnswers(openAttemptId!),
    enabled: Boolean(openAttemptId),
  });

  const filtered = (attemptsQuery.data ?? []).filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (moduleFilter !== "all" && a.module?.code !== moduleFilter) return false;
    return true;
  });

  const moduleCodes = [
    ...new Set((attemptsQuery.data ?? []).map((a) => a.module?.code).filter(Boolean)),
  ] as string[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corrections entraînement"
        subtitle="Schreibens et Sprechens des modules GA — classes autorisées uniquement."
      />
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Statut{" "}
          <select
            className="ml-2 min-h-11 rounded-md border border-border bg-background px-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tous</option>
            <option value="in_progress">En cours</option>
            <option value="pending_review">En attente</option>
            <option value="completed">Terminé</option>
          </select>
        </label>
        <label className="text-sm">
          Module{" "}
          <select
            className="ml-2 min-h-11 rounded-md border border-border bg-background px-2"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            <option value="all">Tous</option>
            {moduleCodes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <QueryState
        isLoading={attemptsQuery.isLoading}
        isError={attemptsQuery.isError}
        error={attemptsQuery.error as Error | null}
        isEmpty={!filtered.length}
        emptyTitle="Aucune tentative"
        emptyMessage="Les tentatives live de vos classes apparaîtront ici."
        onRetry={() => void attemptsQuery.refetch()}
      >
        <TableScroll>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">Module</th>
                <th className="p-2">Statut</th>
                <th className="p-2">Mis à jour</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="p-2">{a.module?.code ?? "—"}</td>
                  <td className="p-2">{a.status}</td>
                  <td className="p-2">{new Date(a.updated_at ?? a.started_at).toLocaleString("fr-FR")}</td>
                  <td className="p-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenAttemptId((id) => (id === a.id ? null : a.id))}
                    >
                      {openAttemptId === a.id ? "Masquer" : "Ouvrir"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        {openAttemptId ? (
          <div className="space-y-2">
            {(answersQuery.data ?? [])
              .filter((ans) => ans.activity_type === "writing" || ans.activity_type === "speaking")
              .map((ans) => (
                <TeacherTrainingGradePanel
                  key={ans.id}
                  answer={ans}
                  onDone={() => {
                    void qc.invalidateQueries({
                      queryKey: queryKeys.training.answers(openAttemptId),
                    });
                    void qc.invalidateQueries({ queryKey: queryKeys.training.teacherAttempts });
                  }}
                />
              ))}
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}

export function TrainingPages({
  mode,
}: {
  mode: "catalog" | "module" | "preview" | "corrections";
}) {
  const nav = readTrainingNav();
  if (mode === "catalog") return <StudentTrainingCatalogPage />;
  if (mode === "preview") return <StaffTrainingPreviewPage />;
  if (mode === "corrections") return <TeacherTrainingCorrectionsPage />;
  return <TrainingModuleOverviewPage preview={nav.preview} />;
}

