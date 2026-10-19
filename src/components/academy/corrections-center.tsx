import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildTeacherScope,
  isDirectorRole,
  scopedClassOrLevelItemVisible,
} from "@/lib/academy-logic";
import { queryKeys } from "@/lib/query-keys";
import { AssignmentService, ExamService } from "@/services/academy-services";
import {
  useAllExams,
  useAssignmentRows,
  useClasses,
  useTeachers,
} from "@/hooks/use-academy-data";
import { useAcademy } from "./academy-context";
import { ExamWritingGradingPanel } from "./exam-pages";
import { FilterBar, PageHeader, Status, Surface } from "./primitives";
import { QueryState } from "./query-state";
import { AssignmentGrading } from "./workflow-pages";

type QueueMode = "pending" | "history";
type KindTab = "all" | "assignments" | "exams";

type CorrectionItem = {
  id: string;
  kind: "assignment" | "exam";
  title: string;
  subtitle: string;
  count: number;
  assignmentId?: string;
  examId?: string;
  classId?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
  groupName?: string | null;
  /** Newest activity timestamp for history sort */
  sortAt: number;
};

export function CorrectionsCenter() {
  const { role } = useAcademy();
  const classesQuery = useClasses();
  const teachersQuery = useTeachers(isDirectorRole(role));
  const assignmentsQuery = useAssignmentRows();
  const examsQuery = useAllExams();

  const [kindTab, setKindTab] = useState<KindTab>("all");
  const [queueMode, setQueueMode] = useState<QueueMode>("pending");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const isAdmin = isDirectorRole(role);

  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );

  const classesById = useMemo(() => {
    type ClassRow = NonNullable<typeof classesQuery.data>[number];
    const map = new Map<string, ClassRow>();
    for (const row of classesQuery.data ?? []) {
      map.set(row.id, row);
    }
    return map;
  }, [classesQuery.data]);

  const groupsForFilter = useMemo(() => {
    const rows = classesQuery.data ?? [];
    if (isAdmin) {
      if (!teacherFilter) return rows;
      return rows.filter((row) => row.teacherId === teacherFilter);
    }
    return rows.filter((row) => teacherScope.classIds.has(row.id));
  }, [classesQuery.data, isAdmin, teacherFilter, teacherScope.classIds]);

  const scopedAssignments = useMemo(() => {
    return (assignmentsQuery.data ?? []).filter((row) => {
      if (row.status !== "published" || !row.class_id) return false;
      if (!isAdmin && !scopedClassOrLevelItemVisible(row, teacherScope)) return false;
      if (classFilter && row.class_id !== classFilter) return false;
      if (isAdmin && teacherFilter) {
        const klass = classesById.get(row.class_id);
        if (!klass || klass.teacherId !== teacherFilter) return false;
      }
      return true;
    });
  }, [
    assignmentsQuery.data,
    isAdmin,
    teacherScope,
    classFilter,
    teacherFilter,
    classesById,
  ]);

  const scopedExams = useMemo(() => {
    return (examsQuery.data ?? []).filter((exam) => {
      if (exam.status !== "published") return false;
      if (!isAdmin && !scopedClassOrLevelItemVisible(exam, teacherScope)) return false;
      if (classFilter) {
        if (exam.class_id !== classFilter) return false;
      }
      if (isAdmin && teacherFilter) {
        if (!exam.class_id) return false;
        const klass = classesById.get(exam.class_id);
        if (!klass || klass.teacherId !== teacherFilter) return false;
      }
      return true;
    });
  }, [examsQuery.data, isAdmin, teacherScope, classFilter, teacherFilter, classesById]);

  const correctionsQuery = useQuery({
    queryKey: [
      ...queryKeys.corrections.all,
      role,
      queueMode,
      teacherFilter,
      classFilter,
      scopedAssignments.map((a) => a.id).join(","),
      scopedExams.map((e) => e.id).join(","),
    ],
    queryFn: async (): Promise<CorrectionItem[]> => {
      const assignmentItems = (
        await Promise.all(
          scopedAssignments.map(async (assignment) => {
            const submissions = await AssignmentService.listSubmissions(assignment.id);
            const relevant =
              queueMode === "pending"
                ? submissions.filter((s) => s.status === "submitted")
                : submissions.filter((s) => s.status === "graded");
            if (!relevant.length) return null;

            const klass = assignment.class_id ? classesById.get(assignment.class_id) : null;
            const groupName = assignment.class?.name ?? klass?.name ?? "Groupe";
            const teacherName = klass?.teacher && klass.teacher !== "—" ? klass.teacher : null;
            const sortAt = relevant.reduce((max, row) => {
              const ts = Date.parse(
                row.graded_at || row.submitted_at || row.updated_at || row.created_at || "",
              );
              return Number.isFinite(ts) ? Math.max(max, ts) : max;
            }, 0);

            return {
              id: `assignment:${assignment.id}:${queueMode}`,
              kind: "assignment" as const,
              title: assignment.title,
              subtitle:
                queueMode === "pending"
                  ? `${groupName}${teacherName ? ` · ${teacherName}` : ""} · ${relevant.length} remise${relevant.length > 1 ? "s" : ""} à corriger`
                  : `${groupName}${teacherName ? ` · ${teacherName}` : ""} · ${relevant.length} corrigée${relevant.length > 1 ? "s" : ""}`,
              count: relevant.length,
              assignmentId: assignment.id,
              classId: assignment.class_id,
              teacherId: klass?.teacherId ?? null,
              teacherName,
              groupName,
              sortAt: sortAt || Date.parse(assignment.due_at || assignment.created_at || "") || 0,
            };
          }),
        )
      ).filter((item): item is NonNullable<typeof item> => Boolean(item));

      const examItems = (
        await Promise.all(
          scopedExams.map(async (exam) => {
            const attempts = await ExamService.listAttemptsForExam(exam.id);
            const relevant =
              queueMode === "pending"
                ? attempts.filter((a) => a.status === "submitted" || a.status === "expired")
                : attempts.filter((a) => a.status === "graded");
            if (!relevant.length) return null;

            const klass = exam.class_id ? classesById.get(exam.class_id) : null;
            const groupName = klass?.name ?? exam.level?.code ?? "—";
            const teacherName = klass?.teacher && klass.teacher !== "—" ? klass.teacher : null;
            const sortAt = relevant.reduce((max, row) => {
              const ts = Date.parse(row.submitted_at || row.updated_at || row.created_at || "");
              return Number.isFinite(ts) ? Math.max(max, ts) : max;
            }, 0);

            return {
              id: `exam:${exam.id}:${queueMode}`,
              kind: "exam" as const,
              title: exam.title,
              subtitle:
                queueMode === "pending"
                  ? `${groupName}${teacherName ? ` · ${teacherName}` : ""} · ${relevant.length} copie${relevant.length > 1 ? "s" : ""} à corriger`
                  : `${groupName}${teacherName ? ` · ${teacherName}` : ""} · ${relevant.length} corrigée${relevant.length > 1 ? "s" : ""}`,
              count: relevant.length,
              examId: exam.id,
              classId: exam.class_id,
              teacherId: klass?.teacherId ?? null,
              teacherName,
              groupName,
              sortAt: sortAt || Date.parse(exam.created_at || "") || 0,
            };
          }),
        )
      ).filter((item): item is NonNullable<typeof item> => Boolean(item));

      const merged = [...assignmentItems, ...examItems];
      if (queueMode === "history") {
        return merged.sort((a, b) => b.sortAt - a.sortAt);
      }
      return merged.sort((a, b) => b.count - a.count);
    },
    enabled: !classesQuery.isLoading && !assignmentsQuery.isLoading && !examsQuery.isLoading,
  });

  const items = correctionsQuery.data ?? [];
  const filtered =
    kindTab === "all"
      ? items
      : kindTab === "assignments"
        ? items.filter((i) => i.kind === "assignment")
        : items.filter((i) => i.kind === "exam");

  const emptyTitle =
    queueMode === "history" ? "Aucun historique" : "Rien à corriger";
  const emptyMessage =
    queueMode === "history"
      ? "Les devoirs et examens déjà corrigés apparaîtront ici."
      : "Les remises et écrits en attente apparaîtront ici.";

  return (
    <>
      <PageHeader
        title="Corrections"
        subtitle={
          isAdmin
            ? "Devoirs remis et écrits d’examens — filtrez par professeur ou groupe, consultez l’historique."
            : "Devoirs remis de vos groupes — filtrez par groupe et consultez l’historique."
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={queueMode === "pending" ? "default" : "outline"}
            onClick={() => {
              setQueueMode("pending");
              setOpenId(null);
            }}
          >
            À corriger
          </Button>
          <Button
            size="sm"
            variant={queueMode === "history" ? "default" : "outline"}
            onClick={() => {
              setQueueMode("history");
              setOpenId(null);
            }}
          >
            Historique
          </Button>
        </div>

        <FilterBar>
          {isAdmin ? (
            <select
              aria-label="Professeur"
              className="h-10 min-w-[10rem] flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none"
              value={teacherFilter}
              onChange={(e) => {
                const next = e.target.value;
                setTeacherFilter(next);
                setOpenId(null);
                if (next && classFilter) {
                  const stillValid = (classesQuery.data ?? []).some(
                    (row) => row.id === classFilter && row.teacherId === next,
                  );
                  if (!stillValid) setClassFilter("");
                }
              }}
            >
              <option value="">Tous les professeurs</option>
              {(teachersQuery.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : null}
          <select
            aria-label="Groupe"
            className="h-10 min-w-[10rem] flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none"
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setOpenId(null);
            }}
          >
            <option value="">Tous les groupes</option>
            {groupsForFilter.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference || c.name}
                {isAdmin && c.teacher && c.teacher !== "—" ? ` · ${c.teacher}` : ""}
              </option>
            ))}
          </select>
        </FilterBar>
      </div>

      <Tabs
        value={kindTab}
        onValueChange={(v) => {
          setKindTab(v as KindTab);
          setOpenId(null);
        }}
      >
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="assignments">Devoirs</TabsTrigger>
          <TabsTrigger value="exams">Examens/Writing</TabsTrigger>
        </TabsList>
        <TabsContent value={kindTab} className="mt-5">
          <QueryState
            isLoading={
              classesQuery.isLoading ||
              assignmentsQuery.isLoading ||
              examsQuery.isLoading ||
              correctionsQuery.isLoading ||
              (isAdmin && teachersQuery.isLoading)
            }
            isError={
              classesQuery.isError ||
              assignmentsQuery.isError ||
              examsQuery.isError ||
              correctionsQuery.isError ||
              (isAdmin && teachersQuery.isError)
            }
            error={
              classesQuery.error ??
              assignmentsQuery.error ??
              examsQuery.error ??
              correctionsQuery.error ??
              teachersQuery.error
            }
            isEmpty={!filtered.length}
            emptyTitle={emptyTitle}
            emptyMessage={emptyMessage}
            onRetry={() => {
              void classesQuery.refetch();
              void assignmentsQuery.refetch();
              void examsQuery.refetch();
              void correctionsQuery.refetch();
              if (isAdmin) void teachersQuery.refetch();
            }}
          >
            <div className="space-y-3">
              {filtered.map((item) => {
                const open = openId === item.id;
                return (
                  <Surface key={item.id} className="space-y-3 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{item.title}</h3>
                          <Status tone={item.kind === "assignment" ? "blue" : "amber"}>
                            {item.kind === "assignment" ? "Devoir" : "Examen"}
                          </Status>
                          {queueMode === "history" ? (
                            <Status tone="green">Corrigé</Status>
                          ) : (
                            <Status tone="amber">À corriger</Status>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
                        {queueMode === "history" && item.sortAt > 0 ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Dernière activité :{" "}
                            {new Date(item.sortAt).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant={open ? "outline" : "default"}
                        onClick={() => setOpenId(open ? null : item.id)}
                      >
                        {open
                          ? "Masquer"
                          : queueMode === "history"
                            ? "Voir"
                            : "Corriger"}
                      </Button>
                    </div>
                    {open && item.kind === "assignment" && item.assignmentId && item.classId ? (
                      <AssignmentGrading assignmentId={item.assignmentId} classId={item.classId} />
                    ) : null}
                    {open && item.kind === "exam" && item.examId ? (
                      <ExamWritingGradingPanel examId={item.examId} />
                    ) : null}
                  </Surface>
                );
              })}
            </div>
          </QueryState>
        </TabsContent>
      </Tabs>
    </>
  );
}
