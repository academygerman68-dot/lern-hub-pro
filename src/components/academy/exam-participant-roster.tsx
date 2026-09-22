import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useExamParticipantRoster } from "@/hooks/use-academy-data";
import {
  countExamParticipantStatuses,
  examParticipantStatusLabel,
  type ExamParticipantStatus,
} from "@/lib/exam-participant-status";
import { QueryState } from "./query-state";
import { Status, Surface } from "./primitives";

const FILTERS: Array<{ id: "all" | ExamParticipantStatus; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "not_started", label: "Non commencés" },
  { id: "in_progress", label: "En cours" },
  { id: "awaiting_grade", label: "À corriger" },
  { id: "graded", label: "Corrigés" },
  { id: "no_show", label: "Non présentés" },
];

function toneForStatus(status: ExamParticipantStatus): "gray" | "amber" | "blue" | "green" | "red" {
  if (status === "graded") return "green";
  if (status === "awaiting_grade" || status === "submitted") return "amber";
  if (status === "in_progress") return "blue";
  if (status === "no_show") return "red";
  return "gray";
}

export function ExamParticipantRosterPanel({ examId }: { examId: string }) {
  const rosterQuery = useExamParticipantRoster(examId);
  const [filter, setFilter] = useState<"all" | ExamParticipantStatus>("all");

  const counts = useMemo(
    () => countExamParticipantStatuses(rosterQuery.data ?? []),
    [rosterQuery.data],
  );

  const rows = useMemo(() => {
    const all = rosterQuery.data ?? [];
    if (filter === "all") return all;
    return all.filter((row) => row.status === filter);
  }, [rosterQuery.data, filter]);

  return (
    <Surface className="mt-4 space-y-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Suivi des participants</h3>
          <p className="text-xs text-muted-foreground">
            Tous les étudiants ciblés, y compris ceux qui n’ont rien commencé.
          </p>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {rosterQuery.data?.length ?? 0} étudiant
          {(rosterQuery.data?.length ?? 0) > 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const count =
            item.id === "all" ? (rosterQuery.data?.length ?? 0) : counts[item.id];
          return (
            <Button
              key={item.id}
              size="sm"
              variant={filter === item.id ? "default" : "outline"}
              onClick={() => setFilter(item.id)}
            >
              {item.label} ({count})
            </Button>
          );
        })}
      </div>

      <QueryState
        isLoading={rosterQuery.isLoading}
        isError={rosterQuery.isError}
        error={rosterQuery.error}
        isEmpty={!rows.length}
        emptyTitle="Aucun étudiant dans ce filtre"
        emptyMessage="Changez de filtre ou vérifiez le ciblage (groupe / niveau) de l’examen."
        onRetry={() => void rosterQuery.refetch()}
      >
        <div className="divide-y divide-border rounded-md border border-border">
          {rows.map((row) => (
            <div
              key={row.studentId}
              className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.displayName}</p>
                {row.email ? (
                  <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Status tone={toneForStatus(row.status)}>
                  {examParticipantStatusLabel(row.status)}
                </Status>
                {row.percentage != null ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {Math.round(row.percentage)} %
                    {row.score != null && row.maxScore != null
                      ? ` · ${row.score}/${row.maxScore}`
                      : ""}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </QueryState>
    </Surface>
  );
}
