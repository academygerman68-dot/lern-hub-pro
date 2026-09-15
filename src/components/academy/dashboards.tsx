import { CalendarDays, ChevronRight, ClipboardCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useClasses,
  useClassRoster,
  useEnrollmentsByStudent,
  useStudents,
  useTeachers,
} from "@/hooks/use-academy-data";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import { Eyebrow, Status } from "./premium-kit";
import { Surface } from "./primitives";

export function PremiumStudentDashboard() {
  const { navigate, user, l } = useAcademy();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const studentsQuery = useStudents();
  const myStudent = (studentsQuery.data ?? []).find(
    (row) => row.email.toLowerCase() === (user?.email ?? "").toLowerCase(),
  );
  const enrollmentsQuery = useEnrollmentsByStudent(myStudent?.id);
  const activeEnrollment = (enrollmentsQuery.data ?? []).find((row) => row.status === "active");
  const level = myStudent?.level ?? "—";
  const className = myStudent?.className || activeEnrollment?.class?.name || null;

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{l("Bienvenue", "مرحبًا")}</p>
          <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
            Bonjour, {firstName}.
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("courses")}>
            {l("Mes cours", "دروسي")}
          </Button>
          <Button onClick={() => navigate("exams")}>{l("Examens", "الامتحانات")}</Button>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-2xl bg-brand p-7 text-brand-foreground sm:p-8">
          <Eyebrow>{l("Niveau actuel", "المستوى الحالي")}</Eyebrow>
          <div className="mt-4 flex items-end gap-3">
            <span className="font-display text-6xl">{level}</span>
            <span className="mb-2 text-sm text-brand-foreground/65">
              {className
                ? l(`Classe · ${className}`, `القسم · ${className}`)
                : l("Parcours allemand", "مسار الألمانية")}
            </span>
          </div>
          <p className="mt-5 max-w-md text-sm leading-6 text-brand-foreground/70">
            {l(
              "Votre inscription, vos cours et vos examens sont liés à votre compte académie.",
              "تسجيلك ودروسك وامتحاناتك مرتبطة بحساب الأكاديمية.",
            )}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate("courses")}>
              {l("Continuer l’apprentissage", "متابعة التعلّم")}
            </Button>
            <Button
              variant="ghost"
              className="text-brand-foreground hover:bg-brand-foreground/10"
              onClick={() => navigate("progress")}
            >
              {l("Voir la progression", "عرض التقدّم")}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <Eyebrow>{l("Votre parcours", "مسارك")}</Eyebrow>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <span className="text-muted-foreground">{l("Classe", "القسم")}</span>
              <span className="font-medium">{className ?? l("Non assignée", "غير معيّن")}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <span className="text-muted-foreground">{l("Statut", "الحالة")}</span>
              <Status tone="green">{l("Actif", "نشط")}</Status>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{l("Accès", "الوصول")}</span>
              <Status tone="green">{l("Actif", "نشط")}</Status>
            </div>
          </div>
          <Button className="mt-6 w-full" variant="outline" onClick={() => navigate("profile")}>
            {l("Mon profil", "ملفي")}
          </Button>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {(
          [
            [
              l("Cours & leçons", "الدروس"),
              l(
                "Accédez aux modules publiés pour votre niveau.",
                "ادخل إلى الوحدات المنشورة لمستواك.",
              ),
              "courses",
            ],
            [
              l("Devoirs", "الواجبات"),
              l("Travaux publiés par votre enseignant.", "أعمال ينشرها أستاذك."),
              "assignments",
            ],
            [
              l("Examens blancs", "امتحانات تجريبية"),
              l("Entraînez-vous avec les mocks A1–B2.", "تدرّب على اختبارات A1–B2."),
              "exams",
            ],
          ] as const
        ).map(([title, body, page]) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            <button
              type="button"
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary"
              onClick={() => navigate(page)}
            >
              {l("Ouvrir", "فتح")} <ChevronRight className="size-4" />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

export function PremiumTeacherDashboard() {
  const { navigate, l } = useAcademy();
  const classesQuery = useClasses();
  const primaryClass = classesQuery.data?.[0];
  const rosterQuery = useClassRoster(primaryClass?.id);

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">{l("Espace enseignant", "مساحة الأستاذ")}</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {l("Priorités du jour", "أولويات اليوم")}
        </h1>
      </div>

      <QueryState
        isLoading={classesQuery.isLoading}
        isError={classesQuery.isError}
        error={classesQuery.error}
        isEmpty={!classesQuery.data?.length}
        emptyTitle={l("Aucune classe assignée", "لا توجد أقسام معيّنة")}
        emptyMessage={l(
          "Votre emploi du temps apparaîtra dès qu’un admin vous assigne une classe.",
          "سيظهر جدولك عندما يعيّن لك المشرف قسمًا.",
        )}
        onRetry={() => void classesQuery.refetch()}
      >
        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Eyebrow>{l("Classe principale", "القسم الرئيسي")}</Eyebrow>
                <h2 className="mt-3 font-display text-2xl">{primaryClass?.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {primaryClass?.schedule} · {primaryClass?.room}
                </p>
              </div>
              <CalendarDays className="size-5 text-primary" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => navigate("attendance")}>{l("Présence", "الحضور")}</Button>
              <Button variant="outline" onClick={() => navigate("classes")}>
                {l("Ouvrir la classe", "فتح القسم")}
              </Button>
              <Button variant="outline" onClick={() => navigate("exams")}>
                {l("Examens", "الامتحانات")}
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Eyebrow>{l("Étudiants inscrits", "الطلاب المسجّلون")}</Eyebrow>
            <p className="mt-4 font-display text-4xl">{rosterQuery.data?.length ?? 0}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {l("Dans votre classe principale", "في قسمك الرئيسي")}
            </p>
            <Button className="mt-6" variant="outline" onClick={() => navigate("students")}>
              <Users className="size-4" /> {l("Voir la liste", "عرض القائمة")}
            </Button>
          </div>
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
              l("Présence", "الحضور"),
              l("Marquer la présence de la séance.", "تسجيل حضور الحصة."),
              "attendance",
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

  const loading = studentsQuery.isLoading || teachersQuery.isLoading || classesQuery.isLoading;
  const error = studentsQuery.isError || teachersQuery.isError || classesQuery.isError;
  const activeStudents = studentsQuery.data?.length ?? 0;

  return (
    <div className="animate-fade-in space-y-8">
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
        error={(studentsQuery.error ?? teachersQuery.error ?? classesQuery.error) as Error | null}
        onRetry={() => {
          void studentsQuery.refetch();
          void teachersQuery.refetch();
          void classesQuery.refetch();
        }}
      >
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [l("Étudiants actifs", "طلاب نشطون"), activeStudents, "students"],
              [l("Enseignants", "أساتذة"), teachersQuery.data?.length ?? 0, "teachers"],
              [l("Classes", "أقسام"), classesQuery.data?.length ?? 0, "classes"],
              [l("Total étudiants", "إجمالي الطلاب"), studentsQuery.data?.length ?? 0, "students"],
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
      </QueryState>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Surface className="p-6">
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
              <p className="py-6 text-sm text-muted-foreground">
                {l("Aucune classe créée.", "لا توجد أقسام بعد.")}
              </p>
            )}
          </div>
        </Surface>
        <Surface className="p-6">
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
    </div>
  );
}
