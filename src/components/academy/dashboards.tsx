import { CalendarDays, ChevronRight, ClipboardCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClasses, useClassRoster, useStudents, useTeachers } from "@/hooks/use-academy-data";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import { Eyebrow, Status } from "./premium-kit";
import { Surface } from "./primitives";

export function PremiumStudentDashboard() {
  const { navigate, user } = useAcademy();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
            Bonjour, {firstName}.
          </h1>
        </div>
        <Button onClick={() => navigate("live")}>Join live class</Button>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-2xl bg-brand p-7 text-brand-foreground sm:p-8">
          <Eyebrow>Current level</Eyebrow>
          <div className="mt-4 flex items-end gap-3">
            <span className="font-display text-6xl">A2</span>
            <span className="mb-2 text-sm text-brand-foreground/65">Intermediate German</span>
          </div>
          <p className="mt-5 max-w-md text-sm leading-6 text-brand-foreground/70">
            Your enrolled class and learning path stay connected to your real academy record.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate("lesson")}>
              Continue learning
            </Button>
            <Button
              variant="ghost"
              className="text-brand-foreground hover:bg-brand-foreground/10"
              onClick={() => navigate("progress")}
            >
              View progress
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <Eyebrow>Learning progress</Eyebrow>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Data will appear as you complete lessons.
          </p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[6%] rounded-full bg-primary" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 text-sm">
            <div>
              <p className="text-muted-foreground">Next lesson</p>
              <p className="mt-1 font-medium">Not scheduled yet</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment</p>
              <div className="mt-1">
                <Status tone="green">Active</Status>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {[
          ["Upcoming live", "Live sessions linked to your enrollment will show here.", "live"],
          [
            "Assignments",
            "Pending work appears after your teacher publishes tasks.",
            "assignments",
          ],
          ["Next milestone", "Complete your first A2 module to unlock exam practice.", "exams"],
        ].map(([title, body, page]) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            <button
              type="button"
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary"
              onClick={() => navigate(page as "live" | "assignments" | "exams")}
            >
              Open <ChevronRight className="size-4" />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

export function PremiumTeacherDashboard() {
  const { navigate } = useAcademy();
  const classesQuery = useClasses();
  const primaryClass = classesQuery.data?.[0];
  const rosterQuery = useClassRoster(primaryClass?.id);

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Teacher studio</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">Today’s focus</h1>
      </div>

      <QueryState
        isLoading={classesQuery.isLoading}
        isError={classesQuery.isError}
        error={classesQuery.error}
        isEmpty={!classesQuery.data?.length}
        emptyTitle="No classes assigned"
        emptyMessage="Your teaching schedule will appear once an admin assigns a class."
        onRetry={() => void classesQuery.refetch()}
      >
        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Eyebrow>Today’s class</Eyebrow>
                <h2 className="mt-3 font-display text-2xl">{primaryClass?.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {primaryClass?.schedule} · {primaryClass?.room}
                </p>
              </div>
              <CalendarDays className="size-5 text-primary" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => navigate("attendance")}>Take attendance</Button>
              <Button variant="outline" onClick={() => navigate("classes")}>
                Open class
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Eyebrow>Assigned students</Eyebrow>
            <p className="mt-4 font-display text-4xl">{rosterQuery.data?.length ?? 0}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Currently enrolled in your primary class
            </p>
            <Button className="mt-6" variant="outline" onClick={() => navigate("students")}>
              <Users className="size-4" /> View roster
            </Button>
          </div>
        </section>
      </QueryState>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          [
            "Pending assignments",
            "Review submissions when students send work.",
            "assignments",
            ClipboardCheck,
          ],
          ["Attendance", "Mark presence for today’s session.", "attendance", CalendarDays],
          ["Exams", "Prepare upcoming assessments.", "exams", ClipboardCheck],
        ].map(([title, body, page, Icon]) => {
          const ItemIcon = Icon as typeof ClipboardCheck;
          return (
            <button
              key={String(title)}
              type="button"
              onClick={() => navigate(page as "assignments" | "attendance" | "exams")}
              className="rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/30 hover:bg-soft-blue/40"
            >
              <ItemIcon className="size-4 text-primary" />
              <h2 className="mt-4 text-sm font-semibold">{String(title)}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{String(body)}</p>
            </button>
          );
        })}
      </section>
    </div>
  );
}

export function PremiumDirectorDashboard() {
  const { navigate } = useAcademy();
  const studentsQuery = useStudents();
  const teachersQuery = useTeachers();
  const classesQuery = useClasses();

  const loading = studentsQuery.isLoading || teachersQuery.isLoading || classesQuery.isLoading;
  const error = studentsQuery.isError || teachersQuery.isError || classesQuery.isError;

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Academy overview</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">Direction</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("students")}>
            Students
          </Button>
          <Button onClick={() => navigate("classes")}>Manage classes</Button>
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
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["Active students", studentsQuery.data?.length ?? 0, "students"],
            ["Teachers", teachersQuery.data?.length ?? 0, "teachers"],
            ["Classes", classesQuery.data?.length ?? 0, "classes"],
          ].map(([label, value, page]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() => navigate(page as "students" | "teachers" | "classes")}
              className="rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/25"
            >
              <p className="text-sm text-muted-foreground">{String(label)}</p>
              <p className="mt-3 font-display text-4xl">{Number(value)}</p>
            </button>
          ))}
        </section>
      </QueryState>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Surface className="p-6">
          <Eyebrow>Upcoming classes</Eyebrow>
          <div className="mt-4 divide-y divide-border">
            {(classesQuery.data ?? []).slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.teacher} · {item.schedule}
                  </p>
                </div>
                <Status tone="blue">{item.level}</Status>
              </div>
            ))}
            {!classesQuery.data?.length && (
              <p className="py-6 text-sm text-muted-foreground">No classes created yet.</p>
            )}
          </div>
        </Surface>
        <Surface className="p-6">
          <Eyebrow>Alerts</Eyebrow>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="rounded-xl bg-soft-blue/70 px-4 py-3">
              Payments module still uses mock data until the next migration.
            </li>
            <li className="rounded-xl bg-alert-soft/70 px-4 py-3">
              Keep enrollments synced after creating new classes.
            </li>
          </ul>
          <Button className="mt-5 w-full" variant="outline" onClick={() => navigate("reports")}>
            Open reports
          </Button>
        </Surface>
      </section>
    </div>
  );
}
