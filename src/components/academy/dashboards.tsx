import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, ClipboardCheck, MessageSquare, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useAssignments,
  useClasses,
  useClassRoster,
  useConversations,
  useEnrollmentsByStudent,
  useLiveSessions,
  useMyExamAttempts,
  usePayments,
  usePendingProfiles,
  usePublishedExams,
  useRecordings,
  useStudents,
  useTeachers,
} from "@/hooks/use-academy-data";
import { queryKeys } from "@/lib/query-keys";
import { formatLiveDate, formatLiveTime, liveStatusLabel } from "@/lib/live-meeting";
import { AssignmentService } from "@/services/academy-services";
import { useAcademy } from "./academy-context";
import { paymentStatusLabel } from "./finance-pages";
import { QueryState } from "./query-state";
import { Eyebrow, Status } from "./premium-kit";
import { GroupBadge, LevelBadge, Surface } from "./primitives";

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PremiumStudentDashboard() {
  const { navigate, user, l, profile } = useAcademy();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const studentsQuery = useStudents();
  const myStudent = (studentsQuery.data ?? []).find(
    (row) => row.email.toLowerCase() === (user?.email ?? "").toLowerCase(),
  );
  const enrollmentsQuery = useEnrollmentsByStudent(myStudent?.id);
  const sessionsQuery = useLiveSessions(myStudent?.classId);
  const conversationsQuery = useConversations();
  const recordingsQuery = useRecordings(myStudent?.classId);
  const examsQuery = usePublishedExams();
  const attemptsQuery = useMyExamAttempts();
  const assignmentsQuery = useQuery({
    queryKey: myStudent?.classId
      ? queryKeys.assignments.byClass(myStudent.classId)
      : (["assignments", "student-dashboard", "none"] as const),
    queryFn: () => AssignmentService.list(myStudent!.classId!),
    enabled: Boolean(myStudent?.classId),
  });

  const activeEnrollment = (enrollmentsQuery.data ?? []).find((row) => row.status === "active");
  const level = myStudent?.level ?? "—";
  const className = myStudent?.className || activeEnrollment?.class?.name || null;
  const now = Date.now();
  const nextSession = (sessionsQuery.data ?? [])
    .filter((s) => new Date(s.starts_at).getTime() >= now && s.status !== "cancelled")
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
  const upcomingAssignments = (assignmentsQuery.data ?? []).slice(0, 3);
  const levelExams = (examsQuery.data ?? [])
    .filter((exam) => !exam.level?.code || exam.level.code === level)
    .slice(0, 3);
  const recentAttempt = (attemptsQuery.data ?? [])[0];

  return (
    <div className="animate-fade-in space-y-6">
      {profile?.status === "restricted" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Votre accès aux cours, ressources, devoirs, examens et classes en direct est actuellement
          restreint. Veuillez contacter l’administration.
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{l("Bienvenue", "مرحبًا")}</p>
          <h1 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">
            Bonjour, {firstName}.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {l("Votre prochaine étape d’apprentissage.", "خطوتك التالية في التعلم.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("courses")}>
            {l("Mes cours", "دروسي")}
          </Button>
          <Button onClick={() => navigate("exams")}>{l("Examens", "الامتحانات")}</Button>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-2xl bg-brand p-5 text-brand-foreground sm:p-7 md:p-8">
          <Eyebrow>{l("Prochain cours", "الحصة القادمة")}</Eyebrow>
          {nextSession ? (
            <>
              <h2 className="mt-4 font-display text-2xl">{nextSession.title}</h2>
              <p className="mt-2 text-sm text-brand-foreground/70">
                {formatLiveDate(nextSession.starts_at)} · {formatLiveTime(nextSession.starts_at)}
                {nextSession.class?.name ? ` · ${nextSession.class.name}` : ""}
              </p>
              <Button
                className="mt-5"
                variant="secondary"
                onClick={() => navigate(nextSession.status === "live" ? "meeting" : "live")}
              >
                {nextSession.status === "live"
                  ? l("Rejoindre", "انضم")
                  : l("Voir le planning", "عرض الجدول")}
              </Button>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm text-brand-foreground/70">
                {l("Aucune séance planifiée pour l’instant.", "لا توجد حصة مجدولة حاليًا.")}
              </p>
              <Button className="mt-5" variant="secondary" onClick={() => navigate("calendar")}>
                {l("Calendrier", "التقويم")}
              </Button>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-soft">
          <Eyebrow>{l("Votre parcours", "مسارك")}</Eyebrow>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <span className="text-muted-foreground">{l("Niveau", "المستوى")}</span>
              <LevelBadge code={level === "—" ? null : String(level)} />
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <span className="text-muted-foreground">{l("Groupe", "المجموعة")}</span>
              <GroupBadge label={className ?? null} />
            </div>
            {recentAttempt ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{l("Dernier examen", "آخر امتحان")}</span>
                <span className="font-semibold tabular-nums">
                  {Number(recentAttempt.percentage ?? 0).toFixed(0)} %
                </span>
              </div>
            ) : null}
          </div>
          <Button className="mt-6 w-full" variant="outline" onClick={() => navigate("profile")}>
            {l("Mon profil", "ملفي")}
          </Button>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Surface className="p-5">
          <Eyebrow>{l("Devoirs", "الواجبات")}</Eyebrow>
          <QueryState
            isLoading={assignmentsQuery.isLoading}
            isError={assignmentsQuery.isError}
            error={assignmentsQuery.error}
            isEmpty={!upcomingAssignments.length}
            emptyMessage={l("Aucun devoir publié.", "لا توجد واجبات منشورة.")}
            onRetry={() => void assignmentsQuery.refetch()}
          >
            <ul className="mt-3 space-y-2 text-sm">
              {upcomingAssignments.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="shrink-0 text-muted-foreground">{item.due}</span>
                </li>
              ))}
            </ul>
          </QueryState>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
            onClick={() => navigate("assignments")}
          >
            {l("Tous les devoirs", "كل الواجبات")} <ChevronRight className="size-4" />
          </button>
        </Surface>

        <Surface className="p-5">
          <Eyebrow>{l("Examens", "الامتحانات")}</Eyebrow>
          <QueryState
            isLoading={examsQuery.isLoading}
            isError={examsQuery.isError}
            error={examsQuery.error}
            isEmpty={!levelExams.length}
            emptyMessage={l("Aucun examen publié.", "لا توجد امتحانات منشورة.")}
            onRetry={() => void examsQuery.refetch()}
          >
            <ul className="mt-3 space-y-2 text-sm">
              {levelExams.map((exam) => (
                <li key={exam.id} className="font-medium">
                  {exam.title}
                </li>
              ))}
            </ul>
          </QueryState>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
            onClick={() => navigate("exams")}
          >
            {l("Entraînement", "تدرّب")} <ChevronRight className="size-4" />
          </button>
        </Surface>

        <Surface className="p-5">
          <Eyebrow>{l("Messages", "الرسائل")}</Eyebrow>
          <p className="mt-3 font-display text-3xl">{(conversationsQuery.data ?? []).length}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {l("Conversations actives", "محادثات نشطة")}
          </p>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
            onClick={() => navigate("messages")}
          >
            {l("Ouvrir la messagerie", "فتح المراسلة")} <MessageSquare className="size-4" />
          </button>
        </Surface>

        <Surface className="p-5">
          <Eyebrow>{l("Rediffusions", "التسجيلات")}</Eyebrow>
          <p className="mt-3 font-display text-3xl">{recordingsQuery.data?.length ?? 0}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {l("Enregistrements de votre groupe", "تسجيلات قسمك")}
          </p>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
            onClick={() => navigate("recordings")}
          >
            {l("Voir les rediffusions", "عرض التسجيلات")} <Video className="size-4" />
          </button>
        </Surface>
      </section>
    </div>
  );
}

export function PremiumTeacherDashboard() {
  const { navigate, l, user } = useAcademy();
  const classesQuery = useClasses();
  const teachersQuery = useTeachers();
  const sessionsQuery = useLiveSessions();
  const assignmentsQuery = useAssignments();

  const me = (teachersQuery.data ?? []).find(
    (teacher) => teacher.email.toLowerCase() === (user?.email ?? "").toLowerCase(),
  );
  const myClasses = useMemo(
    () => (classesQuery.data ?? []).filter((item) => item.teacherId === me?.id),
    [classesQuery.data, me?.id],
  );
  const primaryClass = myClasses[0] ?? classesQuery.data?.[0];
  const rosterQuery = useClassRoster(primaryClass?.id);
  const classIds = useMemo(() => new Set(myClasses.map((item) => item.id)), [myClasses]);

  const mySessions = useMemo(
    () =>
      (sessionsQuery.data ?? []).filter(
        (session) => classIds.has(session.class_id) && session.status !== "cancelled",
      ),
    [sessionsQuery.data, classIds],
  );
  const todaySessions = mySessions.filter(
    (session) => dayKey(new Date(session.starts_at)) === dayKey(new Date()),
  );
  const nextMeeting = mySessions
    .filter((session) => new Date(session.starts_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
  const myAssignments = (assignmentsQuery.data ?? []).filter(
    (item) => !item.classId || classIds.has(item.classId),
  );
  const publishedAssignments = myAssignments.filter((item) => item.status === "Publié");

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{l("Espace enseignant", "مساحة الأستاذ")}</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {l("Priorités du jour", "أولويات اليوم")}
        </h1>
      </div>

      <QueryState
        isLoading={classesQuery.isLoading || teachersQuery.isLoading}
        isError={classesQuery.isError || teachersQuery.isError}
        error={(classesQuery.error ?? teachersQuery.error) as Error | null}
        isEmpty={!primaryClass}
        emptyTitle={l("Aucune classe assignée", "لا توجد أقسام معيّنة")}
        emptyMessage={l(
          "Votre emploi du temps apparaîtra dès qu’un admin vous assigne une classe.",
          "سيظهر جدولك عندما يعيّن لك المشرف قسمًا.",
        )}
        onRetry={() => {
          void classesQuery.refetch();
          void teachersQuery.refetch();
        }}
      >
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Surface className="p-5">
            <Eyebrow>{l("Cours aujourd’hui", "حصص اليوم")}</Eyebrow>
            <p className="mt-3 font-display text-4xl">{todaySessions.length}</p>
            {todaySessions[0] ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {formatLiveTime(todaySessions[0].starts_at)} · {todaySessions[0].title}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{l("Aucune séance", "لا حصة")}</p>
            )}
          </Surface>
          <Surface className="p-5">
            <Eyebrow>{l("Devoirs à corriger", "واجبات للتصحيح")}</Eyebrow>
            <p className="mt-3 font-display text-4xl">{publishedAssignments.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {l("Devoirs publiés dans vos groupes", "واجبات منشورة في أقسامك")}
            </p>
          </Surface>
          <Surface className="p-5">
            <Eyebrow>{l("Étudiants", "الطلاب")}</Eyebrow>
            <p className="mt-3 font-display text-4xl">{rosterQuery.data?.length ?? 0}</p>
            <p className="mt-2 text-sm text-muted-foreground">{primaryClass?.name}</p>
          </Surface>
          <Surface className="p-5">
            <Eyebrow>{l("Prochaine séance", "الحصة القادمة")}</Eyebrow>
            {nextMeeting ? (
              <>
                <p className="mt-3 text-sm font-medium">{nextMeeting.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatLiveDate(nextMeeting.starts_at)} · {formatLiveTime(nextMeeting.starts_at)}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {l("Rien de planifié", "لا شيء")}
              </p>
            )}
          </Surface>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Surface className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Eyebrow>{l("Classe principale", "القسم الرئيسي")}</Eyebrow>
                <h2 className="mt-3 font-display text-2xl">{primaryClass?.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {primaryClass?.schedule} · {primaryClass?.size}/{primaryClass?.capacity}{" "}
                  {l("inscrits", "مسجّل")}
                </p>
              </div>
              <CalendarDays className="size-5 text-primary" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => navigate("classes")}>
                {l("Ouvrir la classe", "فتح القسم")}
              </Button>
              <Button variant="outline" onClick={() => navigate("assignments")}>
                {l("Devoirs", "الواجبات")}
              </Button>
              <Button variant="outline" onClick={() => navigate("live")}>
                {l("Cours en direct", "حصص مباشرة")}
              </Button>
            </div>
          </Surface>
          <Surface className="p-6">
            <Eyebrow>{l("Séances du jour", "حصص اليوم")}</Eyebrow>
            <div className="mt-4 space-y-3">
              {todaySessions.length ? (
                todaySessions.map((session) => (
                  <div key={session.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">{session.title}</p>
                    <p className="mt-1 text-muted-foreground">
                      {formatLiveTime(session.starts_at)} · {liveStatusLabel(session.status)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {l("Aucune séance aujourd’hui.", "لا حصة اليوم.")}
                </p>
              )}
            </div>
          </Surface>
        </section>
      </QueryState>

      <section className="grid gap-4 md:grid-cols-3">
        {(
          [
            [
              l("Devoirs", "الواجبات"),
              l("Corriger les remises des étudiants.", "تصحيح تسليمات الطلاب."),
              "assignments",
              ClipboardCheck,
            ],
            [
              l("Cours en direct", "الحصص المباشرة"),
              l("Lancer ou rejoindre une séance.", "بدء أو الانضمام إلى حصة."),
              "live",
              CalendarDays,
            ],
            [
              l("Examens", "الامتحانات"),
              l("Préparer et publier les évaluations.", "تحضير ونشر التقييمات."),
              "exams",
              ClipboardCheck,
            ],
          ] as const
        ).map(([title, body, page, Icon]) => {
          const ItemIcon = Icon;
          return (
            <button
              key={title}
              type="button"
              onClick={() => navigate(page)}
              className="rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/30 hover:bg-soft-blue/40"
            >
              <ItemIcon className="size-4 text-primary" />
              <h2 className="mt-4 text-sm font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </button>
          );
        })}
      </section>
    </div>
  );
}

export function PremiumDirectorDashboard() {
  const { navigate, l } = useAcademy();
  const studentsQuery = useStudents();
  const teachersQuery = useTeachers();
  const classesQuery = useClasses();
  const pendingQuery = usePendingProfiles();
  const paymentsQuery = usePayments();
  const sessionsQuery = useLiveSessions();
  const assignmentsQuery = useAssignments();

  const loading =
    studentsQuery.isLoading ||
    teachersQuery.isLoading ||
    classesQuery.isLoading ||
    pendingQuery.isLoading ||
    paymentsQuery.isLoading ||
    sessionsQuery.isLoading ||
    assignmentsQuery.isLoading;
  const error =
    studentsQuery.isError ||
    teachersQuery.isError ||
    classesQuery.isError ||
    pendingQuery.isError ||
    paymentsQuery.isError ||
    sessionsQuery.isError ||
    assignmentsQuery.isError;

  const activeStudents = studentsQuery.data?.length ?? 0;
  const overduePayments = (paymentsQuery.data ?? []).filter((row) => row.status === "overdue");
  const todaySessions = (sessionsQuery.data ?? []).filter(
    (session) =>
      dayKey(new Date(session.starts_at)) === dayKey(new Date()) && session.status !== "cancelled",
  );
  const upcomingMeetings = (sessionsQuery.data ?? [])
    .filter(
      (session) =>
        new Date(session.starts_at).getTime() >= Date.now() && session.status !== "cancelled",
    )
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 5);
  const recentAssignments = (assignmentsQuery.data ?? []).slice(0, 5);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{l("Vue d’ensemble", "نظرة عامة")}</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">
            {l("Direction", "الإدارة")}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("students")}>
            {l("Étudiants", "الطلاب")}
          </Button>
          <Button onClick={() => navigate("classes")}>{l("Classes", "الأقسام")}</Button>
        </div>
      </div>

      <QueryState
        isLoading={loading}
        isError={error}
        error={
          (studentsQuery.error ??
            teachersQuery.error ??
            classesQuery.error ??
            pendingQuery.error ??
            paymentsQuery.error ??
            sessionsQuery.error ??
            assignmentsQuery.error) as Error | null
        }
        onRetry={() => {
          void studentsQuery.refetch();
          void teachersQuery.refetch();
          void classesQuery.refetch();
          void pendingQuery.refetch();
          void paymentsQuery.refetch();
          void sessionsQuery.refetch();
          void assignmentsQuery.refetch();
        }}
      >
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [l("Étudiants actifs", "طلاب نشطون"), activeStudents, "students"],
              [
                l("Comptes en attente", "حسابات قيد الانتظار"),
                pendingQuery.data?.length ?? 0,
                "students",
              ],
              [l("Paiements en retard", "مدفوعات متأخرة"), overduePayments.length, "payments"],
              [l("Séances aujourd’hui", "حصص اليوم"), todaySessions.length, "calendar"],
            ] as const
          ).map(([label, value, page]) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(page)}
              className="rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/25"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-3 font-display text-4xl">{value}</p>
            </button>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <Surface className="p-5">
            <Eyebrow>{l("Prochaines séances", "الحصص القادمة")}</Eyebrow>
            <div className="mt-4 divide-y divide-border">
              {upcomingMeetings.length ? (
                upcomingMeetings.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-soft-blue/30"
                    onClick={() => navigate("calendar")}
                  >
                    <div>
                      <p className="text-sm font-medium">{session.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatLiveDate(session.starts_at)} · {formatLiveTime(session.starts_at)}
                        {session.class?.name ? ` · ${session.class.name}` : ""}
                      </p>
                    </div>
                    <Status tone={session.status === "live" ? "green" : "amber"}>
                      {liveStatusLabel(session.status)}
                    </Status>
                  </button>
                ))
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  {l("Aucune séance à venir.", "لا حصة قادمة.")}
                </p>
              )}
            </div>
          </Surface>

          <Surface className="p-5">
            <Eyebrow>{l("Paiements en retard", "مدفوعات متأخرة")}</Eyebrow>
            <div className="mt-4 divide-y divide-border">
              {overduePayments.length ? (
                overduePayments.slice(0, 5).map((payment) => (
                  <button
                    key={payment.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-soft-blue/30"
                    onClick={() => navigate("payments")}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {payment.student?.profile
                          ? `${payment.student.profile.first_name} ${payment.student.profile.last_name}`.trim()
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Number(payment.amount).toLocaleString("fr-FR")} MAD
                      </p>
                    </div>
                    <Status tone="red">{paymentStatusLabel(payment.status)}</Status>
                  </button>
                ))
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  {l("Aucun retard de paiement.", "لا تأخر في الدفع.")}
                </p>
              )}
            </div>
          </Surface>

          <Surface className="p-5">
            <Eyebrow>{l("Devoirs récents", "واجبات حديثة")}</Eyebrow>
            <div className="mt-4 divide-y divide-border">
              {recentAssignments.length ? (
                recentAssignments.map((assignment) => (
                  <button
                    key={assignment.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-soft-blue/30"
                    onClick={() => navigate("assignments")}
                  >
                    <div>
                      <p className="text-sm font-medium">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">Échéance · {assignment.due}</p>
                    </div>
                    <Status tone={assignment.status === "Publié" ? "green" : "amber"}>
                      {assignment.status}
                    </Status>
                  </button>
                ))
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  {l("Aucun devoir publié.", "لا واجبات منشورة.")}
                </p>
              )}
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Surface className="p-5">
            <Eyebrow>{l("Classes", "الأقسام")}</Eyebrow>
            <div className="mt-4 divide-y divide-border">
              {(classesQuery.data ?? []).slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-soft-blue/30"
                  onClick={() => navigate("classes")}
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.teacher} · {item.schedule}
                    </p>
                  </div>
                  <Status tone="blue">{item.level}</Status>
                </button>
              ))}
              {!classesQuery.data?.length && (
                <p className="py-4 text-sm text-muted-foreground">
                  {l("Aucune classe créée.", "لا توجد أقسام بعد.")}
                </p>
              )}
            </div>
          </Surface>
          <Surface className="p-5">
            <Eyebrow>{l("Actions rapides", "إجراءات سريعة")}</Eyebrow>
            <div className="mt-4 grid gap-2">
              {(
                [
                  [l("Gérer les étudiants", "إدارة الطلاب"), "students"],
                  [l("Gérer les enseignants", "إدارة الأساتذة"), "teachers"],
                  [l("Bibliothèque", "المكتبة"), "materials"],
                  [l("Examens", "الامتحانات"), "exams"],
                ] as const
              ).map(([label, page]) => (
                <Button
                  key={page}
                  variant="outline"
                  className="justify-between"
                  onClick={() => navigate(page)}
                >
                  {label}
                  <ChevronRight className="size-4 opacity-50" />
                </Button>
              ))}
            </div>
          </Surface>
        </section>
      </QueryState>
    </div>
  );
}
