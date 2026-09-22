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
import { useAllExams, useAssignmentRows, useClasses } from "@/hooks/use-academy-data";
import { useAcademy } from "./academy-context";
import { ExamWritingGradingPanel } from "./exam-pages";
import { PageHeader, Status, Surface } from "./primitives";
import { QueryState } from "./query-state";
import { AssignmentGrading } from "./workflow-pages";

type CorrectionItem = {
  id: string;
  kind: "assignment" | "exam";
  title: string;
  subtitle: string;
  count: number;
  assignmentId?: string;
  examId?: string;
  classId?: string | null;
};

export function CorrectionsCenter() {
  const { role } = useAcademy();
  const classesQuery = useClasses();
  const assignmentsQuery = useAssignmentRows();
  const examsQuery = useAllExams();
  const [tab, setTab] = useState<"all" | "assignments" | "exams">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const teacherScope = useMemo(
    () => buildTeacherScope(classesQuery.data ?? []),
    [classesQuery.data],
  );
  const isAdmin = isDirectorRole(role);

  const scopedAssignments = useMemo(() => {
    return (assignmentsQuery.data ?? []).filter(
      (row) =>
        row.status === "published" &&
        Boolean(row.class_id) &&
        (isAdmin || scopedClassOrLevelItemVisible(row, teacherScope)),
    );
  }, [assignmentsQuery.data, isAdmin, teacherScope]);

  const scopedExams = useMemo(() => {
    return (examsQuery.data ?? []).filter(
      (exam) =>
        exam.status === "published" &&
        (isAdmin || scopedClassOrLevelItemVisible(exam, teacherScope)),
    );
  }, [examsQuery.data, isAdmin, teacherScope]);

  const correctionsQuery = useQuery({
    queryKey: [
      ...queryKeys.corrections.all,
      role,
      scopedAssignments.map((a) => a.id).join(","),
      scopedExams.map((e) => e.id).join(","),
    ],
    queryFn: async (): Promise<CorrectionItem[]> => {
      const assignmentItems = (
        await Promise.all(
          scopedAssignments.map(async (assignment) => {
            const submissions = await AssignmentService.listSubmissions(assignment.id);
            const pending = submissions.filter((s) => s.status === "submitted");
            if (!pending.length) return null;
            return {
              id: `assignment:${assignment.id}`,
              kind: "assignment" as const,
              title: assignment.title,
              subtitle: `${assignment.class?.name ?? "Groupe"} · ${pending.length} remise${pending.length > 1 ? "s" : ""} à corriger`,
              count: pending.length,
              assignmentId: assignment.id,
              classId: assignment.class_id,
            };
          }),
        )
      ).filter((item): item is NonNullable<typeof item> => Boolean(item));

      const examItems = (
        await Promise.all(
          scopedExams.map(async (exam) => {
            const attempts = await ExamService.listAttemptsForExam(exam.id);
            const pending = attempts.filter(
              (a) => a.status === "submitted" || a.status === "expired",
            );
            if (!pending.length) return null;
            return {
              id: `exam:${exam.id}`,
              kind: "exam" as const,
              title: exam.title,
              subtitle: `${exam.level?.code ?? "—"} · ${pending.length} copie${pending.length > 1 ? "s" : ""} à corriger`,
              count: pending.length,
              examId: exam.id,
              classId: exam.class_id,
            };
          }),
        )
      ).filter((item): item is NonNullable<typeof item> => Boolean(item));

      return [...assignmentItems, ...examItems].sort((a, b) => b.count - a.count);
    },
    enabled: !classesQuery.isLoading && !assignmentsQuery.isLoading && !examsQuery.isLoading,
  });

  const items = correctionsQuery.data ?? [];
  const filtered =
    tab === "all"
      ? items
      : tab === "assignments"
        ? items.filter((i) => i.kind === "assignment")
        : items.filter((i) => i.kind === "exam");

  return (
    <>
      <PageHeader
        title="Corrections"
        subtitle="Devoirs et écrits d’examens en attente de correction."
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="assignments">Devoirs</TabsTrigger>
          <TabsTrigger value="exams">Examens/Writing</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-5">
          <QueryState
            isLoading={
              classesQuery.isLoading ||
              assignmentsQuery.isLoading ||
              examsQuery.isLoading ||
              correctionsQuery.isLoading
            }
            isError={
              classesQuery.isError ||
              assignmentsQuery.isError ||
              examsQuery.isError ||
              correctionsQuery.isError
            }
            error={
              classesQuery.error ??
              assignmentsQuery.error ??
              examsQuery.error ??
              correctionsQuery.error
            }
            isEmpty={!filtered.length}
            emptyTitle="Rien à corriger"
            emptyMessage="Les remises et écrits en attente apparaîtront ici."
            onRetry={() => {
              void classesQuery.refetch();
              void assignmentsQuery.refetch();
              void examsQuery.refetch();
              void correctionsQuery.refetch();
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
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={open ? "outline" : "default"}
                        onClick={() => setOpenId(open ? null : item.id)}
                      >
                        {open ? "Masquer" : "Corriger"}
                      </Button>
                    </div>
                    {open && item.kind === "assignment" && item.assignmentId && item.classId ? (
                      <AssignmentGrading
                        assignmentId={item.assignmentId}
                        classId={item.classId}
                      />
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
