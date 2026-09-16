import { useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase";
import { useAcademicAccess, useCourses, useClassRoster } from "@/hooks/use-academy-data";
import { SupabaseAssignmentService as Assignments } from "@/services/supabase/assignment-service";
import { SupabaseLiveSessionService } from "@/services/supabase/live-session-service";
import type { Database } from "@/types/database";
import { useAcademy } from "./academy-context";
import { PageHeader, Surface, Status } from "./primitives";
import { QueryState } from "./query-state";

type Assignment = Database["public"]["Tables"]["assignments"]["Row"];
type Submission = Database["public"]["Tables"]["assignment_submissions"]["Row"];

export function StudentLessonPage() {
  const { navigate, user } = useAcademy();
  const search = useSearch({ from: "/app/$role/$page" });
  const courses = useCourses();
  const access = useAcademicAccess();
  const qc = useQueryClient();
  const lessons = (courses.data ?? []).filter((c) => c.status === "published")
    .flatMap((c) => c.modules.filter((m) => m.status === "published" && (!search.moduleId || m.id === search.moduleId)))
    .flatMap((m) => [...m.units].sort((a, b) => a.sort_order - b.sort_order).filter((u) => u.status === "published"))
    .flatMap((u) => [...u.lessons].sort((a, b) => a.sort_order - b.sort_order).filter((l) => l.status === "published"));
  const current = search.lessonId ? lessons.find((l) => l.id === search.lessonId) : lessons[0];
  const progress = useQuery({ queryKey: ["lesson-progress", user?.id], queryFn: async () => {
    const { data, error } = await getSupabase().rpc("current_student_id");
    if (error) throw error;
    if (!data) throw new Error("Profil étudiant introuvable");
    const result = await getSupabase().from("lesson_progress").select("*").eq("student_id", data);
    if (result.error) throw result.error;
    return { studentId: data, rows: result.data };
  } });
  const complete = useMutation({ mutationFn: async (lessonId: string) => {
    if (!progress.data || access.data !== true) throw new Error("Accès non confirmé");
    const { error } = await getSupabase().from("lesson_progress").upsert({
      student_id: progress.data.studentId, lesson_id: lessonId, progress_pct: 100,
      completed_at: new Date().toISOString(),
    }, { onConflict: "student_id,lesson_id" });
    if (error) throw error;
  }, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["lesson-progress"] }); toast.success("Progression enregistrée"); }, onError: (e: Error) => toast.error(e.message) });
  if (access.data === false) return <Surface className="space-y-3 p-6"><p>Votre accès aux cours est suspendu.</p><Button onClick={() => navigate("payments")}>Mes paiements</Button></Surface>;
  const completed = progress.data?.rows.some((r) => r.lesson_id === current?.id && r.progress_pct === 100);
  const next = lessons[lessons.findIndex((l) => l.id === current?.id) + 1];
  return <>
    <Button variant="outline" className="mb-4" onClick={() => navigate("courses")}>← Mes cours</Button>
    <PageHeader title={current?.title ?? "Leçons"} subtitle="Contenu publié par votre académie." />
    <QueryState isLoading={courses.isLoading || access.isLoading || progress.isLoading}
      isError={courses.isError || access.isError || progress.isError} error={courses.error ?? access.error ?? progress.error}
      isEmpty={!current} emptyTitle="Leçon indisponible" emptyMessage="Le contenu sélectionné n’est pas publié ou n’est pas accessible."
      onRetry={() => { void courses.refetch(); void access.refetch(); void progress.refetch(); }}>
      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        <Surface className="space-y-2 p-4">{lessons.map((lesson) => <Button key={lesson.id} className="h-auto w-full justify-start whitespace-normal text-left"
          variant={current?.id === lesson.id ? "default" : "ghost"}
          onClick={() => navigate("lesson", { ...(search.moduleId ? { moduleId: search.moduleId } : {}), lessonId: lesson.id })}>{lesson.title}</Button>)}</Surface>
        <Surface className="space-y-5 p-6">
          <p className="text-sm text-muted-foreground">{current?.description}</p>
          <div className="whitespace-pre-wrap leading-8">{current?.content_markdown || "Aucun texte de leçon n’a été ajouté."}</div>
          <div className="flex flex-wrap gap-3">
            <Button disabled={!current || !current.content_markdown || completed || complete.isPending || access.data !== true}
              onClick={() => current && complete.mutate(current.id)}>{completed ? "Leçon terminée" : "Marquer comme terminée"}</Button>
            {next && <Button variant="outline" onClick={() => navigate("lesson", { ...(search.moduleId ? { moduleId: search.moduleId } : {}), lessonId: next.id })}>Leçon suivante</Button>}
          </div>
        </Surface>
      </div>
    </QueryState>
  </>;
}

export function AssignmentWorkflow({ detail }: { detail: boolean }) {
  const { navigate } = useAcademy();
  const search = useSearch({ from: "/app/$role/$page" });
  const query = useQuery({ queryKey: ["assignment-workflow"], queryFn: () => Assignments.list() });
  const selected = query.data?.find((a) => a.id === search.assignmentId);
  return <>
    {detail && <Button variant="outline" className="mb-4" onClick={() => navigate("assignments")}>← Devoirs</Button>}
    <PageHeader title={detail ? selected?.title ?? "Devoir" : "Mes devoirs"} subtitle="Consignes, remise et correction." />
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error}
      isEmpty={detail ? !selected : !query.data?.length} emptyTitle={detail ? "Devoir introuvable" : "Aucun devoir"}
      emptyMessage="Sélectionnez un devoir accessible depuis la liste." onRetry={() => void query.refetch()}>
      {detail && selected ? <AssignmentSubmission key={selected.id} assignment={selected} /> : <div className="space-y-3">
        {query.data?.map((a) => <Surface key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div><h2 className="font-semibold">{a.title}</h2><p className="text-sm text-muted-foreground">{a.due_at ? new Date(a.due_at).toLocaleString() : "Sans échéance"}</p></div>
          <Button onClick={() => navigate("assignment-detail", { assignmentId: a.id })}>Ouvrir le devoir</Button>
        </Surface>)}
      </div>}
    </QueryState>
  </>;
}

function AssignmentSubmission({ assignment }: { assignment: Assignment }) {
  const { user } = useAcademy();
  const query = useQuery({ queryKey: ["submissions", assignment.id, user?.id], queryFn: async () => {
    const { data: studentId, error } = await getSupabase().rpc("current_student_id");
    if (error) throw error;
    if (!studentId) throw new Error("Profil étudiant introuvable");
    const rows = await Assignments.listSubmissions(assignment.id);
    return { studentId, submission: rows.find((r) => r.student_id === studentId) };
  } });
  return <Surface className="space-y-4 p-6">
    <p className="whitespace-pre-wrap">{assignment.description}</p>
    <p className="whitespace-pre-wrap">{assignment.instructions || "Suivez les consignes données par votre professeur."}</p>
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} onRetry={() => void query.refetch()}>
      {query.data && <SubmissionForm key={query.data.submission?.updated_at ?? "new"} assignment={assignment}
        studentId={query.data.studentId} submission={query.data.submission ?? null} saved={() => query.refetch()} />}
    </QueryState>
  </Surface>;
}

function SubmissionForm({ assignment, studentId, submission, saved }: {
  assignment: Assignment; studentId: string; submission: Submission | null; saved: () => Promise<unknown>;
}) {
  const [text, setText] = useState(submission?.content_text ?? "");
  const closed = assignment.status !== "published" || (assignment.due_at !== null && new Date(assignment.due_at).getTime() < Date.now());
  const locked = closed || submission?.status === "submitted" || submission?.status === "graded";
  const mutation = useMutation({ mutationFn: () => Assignments.upsertSubmission({ assignmentId: assignment.id, studentId, contentText: text.trim() }),
    onSuccess: async () => { await saved(); toast.success("Devoir remis au professeur"); }, onError: (e: Error) => toast.error(e.message) });
  return <div className="space-y-3">
    {submission && <Status>{submission.status}</Status>}
    {submission?.score != null && <p>Note : {submission.score} / {assignment.max_score}</p>}
    {submission?.feedback && <p className="whitespace-pre-wrap">Correction : {submission.feedback}</p>}
    <label className="block text-sm">Votre réponse<Textarea className="mt-2 min-h-48" value={text} disabled={locked || mutation.isPending} onChange={(e) => setText(e.target.value)} /></label>
    {closed && <p className="text-sm text-muted-foreground">La période de remise est terminée.</p>}
    {!locked && <Button disabled={!text.trim() || mutation.isPending} onClick={() => mutation.mutate()}>Remettre mon devoir</Button>}
    {submission?.status === "submitted" && <p>Votre réponse est enregistrée et attend une correction.</p>}
  </div>;
}

export function AssignmentGrading({ assignmentId, classId }: { assignmentId: string; classId: string }) {
  const roster = useClassRoster(classId);
  const query = useQuery({ queryKey: ["submissions", assignmentId], queryFn: () => Assignments.listSubmissions(assignmentId) });
  const assignmentQuery = useQuery({ queryKey: ["assignment-grading", assignmentId], queryFn: async () => {
    const { data, error } = await getSupabase().from("assignments").select("max_score").eq("id", assignmentId).single();
    if (error) throw error; return data;
  } });
  return <QueryState isLoading={query.isLoading || assignmentQuery.isLoading || roster.isLoading}
    isError={query.isError || assignmentQuery.isError || roster.isError} error={query.error ?? assignmentQuery.error ?? roster.error}
    isEmpty={!query.data?.length} emptyTitle="Aucune remise" emptyMessage="Les réponses des étudiants apparaîtront ici."
    onRetry={() => { void query.refetch(); void assignmentQuery.refetch(); void roster.refetch(); }}>
    <div className="mt-4 space-y-4">{query.data?.filter((s) => s.status !== "draft").map((s) => <GradeForm key={`${s.id}-${s.updated_at}`}
      submission={s} maxScore={assignmentQuery.data?.max_score ?? 100} name={roster.data?.find((r) => r.id === s.student_id)?.name ?? "Étudiant"}
      saved={() => query.refetch()} />)}</div>
  </QueryState>;
}

function GradeForm({ submission, maxScore, name, saved }: { submission: Submission; maxScore: number; name: string; saved: () => Promise<unknown> }) {
  const { user } = useAcademy();
  const [score, setScore] = useState(submission.score?.toString() ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const save = useMutation({ mutationFn: () => Assignments.grade({ submissionId: submission.id, score: Number(score), feedback, gradedBy: user?.id ?? null }),
    onSuccess: async () => { await saved(); toast.success("Correction enregistrée"); }, onError: (e: Error) => toast.error(e.message) });
  return <div className="space-y-3 rounded-md border p-4"><h3 className="font-semibold">{name} · {submission.status}</h3>
    <p className="whitespace-pre-wrap">{submission.content_text || "Aucune réponse textuelle"}</p>
    <label className="block text-sm">Note / {maxScore}<Input type="number" min={0} max={maxScore} value={score} onChange={(e) => setScore(e.target.value)} /></label>
    <label className="block text-sm">Retour au participant<Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} /></label>
    <Button disabled={!score.trim() || !Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > maxScore || save.isPending} onClick={() => save.mutate()}>Enregistrer la correction</Button>
  </div>;
}

export function AcademyCalendar() {
  const { navigate, role } = useAcademy();
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState<"week" | "month">("week");
  const live = useQuery({ queryKey: ["calendar", "live"], queryFn: () => SupabaseLiveSessionService.list() });
  const assignments = useQuery({ queryKey: ["calendar", "assignments"], queryFn: () => Assignments.list() });
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), mode === "month" ? 1 : anchor.getDate() - (anchor.getDay() + 6) % 7);
  const end = new Date(start); mode === "month" ? end.setMonth(end.getMonth() + 1) : end.setDate(end.getDate() + 7);
  const events = [...(live.data ?? []).filter((s) => s.status !== "cancelled").map((s) => ({ id: s.id, date: s.starts_at, title: s.title, kind: "live" })),
    ...(assignments.data ?? []).filter((a) => a.due_at).map((a) => ({ id: a.id, date: a.due_at!, title: a.title, kind: "assignment" }))]
    .filter((e) => new Date(e.date) >= start && new Date(e.date) < end).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const move = (direction: number) => { const next = new Date(anchor); mode === "month" ? next.setMonth(next.getMonth() + direction, 1) : next.setDate(next.getDate() + direction * 7); setAnchor(next); };
  return <><PageHeader title="Calendrier" subtitle={`${start.toLocaleDateString()} — ${new Date(end.getTime() - 1).toLocaleDateString()}`} />
    <div className="mb-5 flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => move(-1)}>← Précédent</Button><Button variant="outline" onClick={() => setAnchor(new Date())}>Aujourd’hui</Button><Button variant="outline" onClick={() => move(1)}>Suivant →</Button>
      <Button variant={mode === "week" ? "default" : "outline"} onClick={() => setMode("week")}>Semaine</Button><Button variant={mode === "month" ? "default" : "outline"} onClick={() => setMode("month")}>Mois</Button>
    </div>
    <QueryState isLoading={live.isLoading || assignments.isLoading} isError={live.isError || assignments.isError} error={live.error ?? assignments.error}
      isEmpty={!events.length} emptyTitle="Aucun événement sur cette période" emptyMessage="Les séances planifiées et les échéances des devoirs apparaissent ici."
      onRetry={() => { void live.refetch(); void assignments.refetch(); }}>
      <div className="space-y-3">{events.map((e) => <Surface key={`${e.kind}-${e.id}`} className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div><p className="text-sm text-muted-foreground">{new Date(e.date).toLocaleString()}</p><h2 className="font-semibold">{e.title}</h2><p>{e.kind === "live" ? "Séance en direct" : "Échéance du devoir"}</p></div>
        <Button variant="outline" onClick={() => e.kind === "live" ? navigate("live") : role === "student" ? navigate("assignment-detail", { assignmentId: e.id }) : navigate("assignments")}>Consulter</Button>
      </Surface>)}</div>
    </QueryState></>;
}

export function AuditPage() {
  const query = useQuery({ queryKey: ["audit-log"], queryFn: async () => {
    const { data, error } = await getSupabase().from("audit_logs").select("id, actor_id, action, entity_type, created_at").order("created_at", { ascending: false }).limit(100);
    if (error) throw error; return data;
  } });
  return <><PageHeader title="Journal d’activité" subtitle="Les 100 dernières actions enregistrées par le serveur." />
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} isEmpty={!query.data?.length} emptyTitle="Aucune action enregistrée" onRetry={() => void query.refetch()}>
      <Surface className="divide-y">{query.data?.map((row) => <div key={row.id} className="p-4"><p>{row.action} · {row.entity_type}</p><p className="text-sm text-muted-foreground">{new Date(row.created_at).toLocaleString()} · {row.actor_id ?? "Système"}</p></div>)}</Surface>
    </QueryState></>;
}
