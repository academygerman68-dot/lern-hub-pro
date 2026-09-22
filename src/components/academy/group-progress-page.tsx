import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useClasses,
  useGroupProgress,
  useMarkGroupUnitCompleted,
  useUnlockGroupUnit,
} from "@/hooks/use-academy-data";
import { groupProgressSummary } from "@/lib/group-progress";
import { buildTeacherScope, isDirectorRole } from "@/lib/academy-logic";
import { useAcademy } from "./academy-context";
import { PageHeader, Status, Surface } from "./primitives";
import { QueryState } from "./query-state";

export function GroupProgressPage() {
  const { role, user } = useAcademy();
  const classesQuery = useClasses();
  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );
  const scopedClasses = useMemo(() => {
    const rows = classesQuery.data ?? [];
    if (isDirectorRole(role)) return rows;
    return rows.filter((row) => teacherScope.classIds.has(row.id));
  }, [classesQuery.data, role, teacherScope]);

  const [classId, setClassId] = useState("");
  const selected = scopedClasses.find((row) => row.id === classId) ?? scopedClasses[0] ?? null;
  const effectiveClassId = selected?.id ?? "";
  const progressQuery = useGroupProgress(effectiveClassId || undefined, selected?.level ?? null);
  const markCompleted = useMarkGroupUnitCompleted();
  const unlockUnit = useUnlockGroupUnit();

  const summary = useMemo(
    () => groupProgressSummary(progressQuery.data ?? []),
    [progressQuery.data],
  );

  return (
    <>
      <PageHeader
        title="Progression des groupes"
        subtitle="Niveau du catalogue ≠ avancement réel du groupe. Marquez un chapitre terminé pour débloquer le suivant."
      />
      <Surface className="mb-5 space-y-3 p-5">
        <label className="block text-sm">
          Groupe
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={effectiveClassId}
            onChange={(e) => setClassId(e.target.value)}
          >
            {scopedClasses.length === 0 ? <option value="">Aucun groupe</option> : null}
            {scopedClasses.map((row) => (
              <option key={row.id} value={row.id}>
                {(row.reference || row.name) + (row.level ? ` · ${row.level}` : "")}
                {row.teacher && row.teacher !== "—" ? ` · ${row.teacher}` : ""}
              </option>
            ))}
          </select>
        </label>
        {selected ? (
          <p className="text-sm text-muted-foreground">
            Niveau catalogue : <strong>{selected.level || "—"}</strong> · Progression groupe :{" "}
            <strong>
              {summary.completed}/{summary.total} chapitres ({summary.percent} %)
            </strong>
          </p>
        ) : null}
      </Surface>

      <QueryState
        isLoading={progressQuery.isLoading || classesQuery.isLoading}
        isError={progressQuery.isError || classesQuery.isError}
        error={(progressQuery.error ?? classesQuery.error) as Error | null}
        isEmpty={!effectiveClassId || !(progressQuery.data ?? []).length}
        emptyTitle="Aucun chapitre"
        emptyMessage="Publiez des unités de cours pour ce niveau, puis revenez ici."
        onRetry={() => {
          void classesQuery.refetch();
          void progressQuery.refetch();
        }}
      >
        <div className="space-y-2">
          {(progressQuery.data ?? []).map((row, index) => (
            <Surface
              key={row.unitId}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {index + 1}. {row.title}
                  </p>
                  <Status
                    tone={
                      row.status === "completed"
                        ? "green"
                        : row.status === "unlocked"
                          ? "blue"
                          : "gray"
                    }
                  >
                    {row.status === "completed"
                      ? "Terminé"
                      : row.status === "unlocked"
                        ? "Débloqué"
                        : "Verrouillé"}
                  </Status>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.courseTitle} · {row.moduleTitle}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.status === "locked" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={unlockUnit.isPending}
                    onClick={() => {
                      unlockUnit.mutate(
                        {
                          classId: effectiveClassId,
                          unitId: row.unitId,
                          levelCode: selected?.level ?? null,
                          updatedBy: user?.id ?? null,
                        },
                        {
                          onSuccess: () => toast.success("Chapitre débloqué"),
                          onError: (err) => toast.error(err.message),
                        },
                      );
                    }}
                  >
                    Débloquer
                  </Button>
                ) : null}
                {row.status === "unlocked" ? (
                  <Button
                    size="sm"
                    disabled={markCompleted.isPending}
                    onClick={() => {
                      markCompleted.mutate(
                        {
                          classId: effectiveClassId,
                          unitId: row.unitId,
                          levelCode: selected?.level ?? null,
                          updatedBy: user?.id ?? null,
                        },
                        {
                          onSuccess: () =>
                            toast.success("Chapitre terminé — suivant débloqué si disponible"),
                          onError: (err) => toast.error(err.message),
                        },
                      );
                    }}
                  >
                    Marquer terminé
                  </Button>
                ) : null}
              </div>
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}
