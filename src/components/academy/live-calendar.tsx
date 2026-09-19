import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getLiveSessionJoinState } from "@/lib/jitsi-config";
import { setLiveSessionId } from "@/lib/live-class-session";
import {
  joinLiveSession,
  videoProviderLabel,
  liveStatusLabel,
  isLiveSessionExpired,
  isZoomActive,
  zoomMeetingDurationMinutes,
  formatLiveDate,
} from "@/lib/live-meeting";
import {
  calendarFilterVisibility,
  filterClassesByLevelCode,
  pickStudentCalendarClass,
  resolveCalendarTeacherId,
  sessionBelongsToEnrolledClasses,
  studentCalendarContextLabel,
  studentScopeClassId,
} from "@/lib/live-calendar-scope";
import { calendarDayKey, calendarStatusTone } from "@/lib/live-calendar-layout";
import { LiveSessionService } from "@/services/academy-services";
import {
  useClasses,
  useLevels,
  useLiveSessions,
  useTeachers,
  useUpdateLiveSessionStatus,
} from "@/hooks/use-academy-data";
import { FilterBar, GroupBadge, LevelBadge, PageHeader, Status, Surface } from "./primitives";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import { canEditLiveSession, EditLiveSessionModal } from "./live/edit-session-modal";
import { CalendarToolbar } from "./live/calendar/calendar-toolbar";
import { CalendarWeekView } from "./live/calendar/calendar-week-view";
import { CalendarMonthView } from "./live/calendar/calendar-month-view";
import { CalendarAgendaView } from "./live/calendar/calendar-agenda-view";
import type { LiveSessionListItem } from "@/services/supabase/live-session-service";

/** Isolates calendar render failures so Live / Calendar routes stay usable. */
export class LiveCalendarErrorBoundary extends Component<
  { children: ReactNode; title?: string },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("LiveCalendar crashed", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <Surface className="space-y-3 p-5">
          <h3 className="font-semibold">{this.props.title ?? "Calendrier indisponible"}</h3>
          <p className="text-sm text-muted-foreground">
            Le planning n’a pas pu s’afficher. Le reste de la page reste utilisable.
          </p>
          <p className="text-xs text-muted-foreground">{this.state.error.message}</p>
          <Button size="sm" variant="outline" onClick={() => this.setState({ error: null })}>
            Réessayer
          </Button>
        </Surface>
      );
    }
    return this.props.children;
  }
}

export type LiveCalendarProps = {
  /** When true, skip PageHeader (for embedding inside Live). */
  embedded?: boolean;
  /** Skip duplicate realtime subscription when parent already subscribed. */
  skipRealtime?: boolean;
};

/**
 * Reusable week/month live schedule. Safe to embed in Live or use as Calendar route body.
 * Does not import live-pages (avoids circular module graph via staff/student pages).
 */
export function LiveCalendar({ embedded = false }: LiveCalendarProps) {
  const { navigate, role, user, profile } = useAcademy();
  const filterVisibility = calendarFilterVisibility(role);
  const classesQuery = useClasses();
  const teachersQuery = useTeachers(filterVisibility.teacher);
  const levelsQuery = useLevels(filterVisibility.level);
  const enrolledClassIds = useMemo(
    () => (classesQuery.data ?? []).map((klass) => klass.id),
    [classesQuery.data],
  );
  const studentClassId = role === "student" ? studentScopeClassId(enrolledClassIds) : undefined;
  const sessionsQuery = useLiveSessions(studentClassId);
  const updateStatus = useUpdateLiveSessionStatus();
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const myTeacherId = useMemo(
    () =>
      resolveCalendarTeacherId(role, classesQuery.data ?? [], teachersQuery.data ?? [], {
        profileId: profile?.id ?? user?.id ?? null,
        email: user?.email ?? null,
      }),
    [role, classesQuery.data, teachersQuery.data, profile?.id, user?.id, user?.email],
  );

  const groupsForLevel = useMemo(
    () => filterClassesByLevelCode(classesQuery.data ?? [], levelFilter),
    [classesQuery.data, levelFilter],
  );

  const studentContext = useMemo(() => {
    if (role !== "student") return null;
    const klass = pickStudentCalendarClass(classesQuery.data ?? []);
    return klass ? studentCalendarContextLabel(klass) : null;
  }, [role, classesQuery.data]);

  const enrolledClassIdSet = useMemo(() => new Set(enrolledClassIds), [enrolledClassIds]);
  const classesReady = !classesQuery.isLoading;
  const showTeacherOnCards = role === "student" || role === "director";

  const sessions = useMemo(() => {
    const now = Date.now();
    return (sessionsQuery.data ?? []).filter((s) => {
      if (isLiveSessionExpired(s, now) && s.status !== "completed" && s.status !== "cancelled") {
        /* keep completed via status filter; hide stale scheduled */
      }
      if (
        role === "student" &&
        classesReady &&
        !classesQuery.isError &&
        !sessionBelongsToEnrolledClasses(s.class_id, enrolledClassIdSet)
      ) {
        return false;
      }
      if (filterVisibility.group && classFilter && s.class_id !== classFilter) return false;
      if (filterVisibility.teacher && teacherFilter && s.teacher_id !== teacherFilter) {
        return false;
      }
      if (filterVisibility.level && levelFilter && s.class?.level?.code !== levelFilter) {
        return false;
      }
      if (statusFilter && s.status !== statusFilter) return false;
      return true;
    });
  }, [
    sessionsQuery.data,
    role,
    classesReady,
    classesQuery.isError,
    enrolledClassIdSet,
    filterVisibility.group,
    filterVisibility.teacher,
    filterVisibility.level,
    classFilter,
    teacherFilter,
    levelFilter,
    statusFilter,
  ]);

  const selected = (sessionsQuery.data ?? []).find((s) => s.id === selectedId) ?? null;

  const weekStart = useMemo(() => {
    const d = new Date(anchor);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [anchor]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const monthCells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [anchor]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, LiveSessionListItem[]>();
    for (const session of sessions) {
      const key = calendarDayKey(new Date(session.starts_at));
      const list = map.get(key) ?? [];
      list.push(session);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    }
    return map;
  }, [sessions]);

  const agendaDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, []);

  const teacherName = (session: LiveSessionListItem) => {
    const p = session.teacher?.profile;
    if (!p) return "—";
    return `${p.first_name} ${p.last_name}`.trim() || "—";
  };

  const formatRange = (startsAt: string, endsAt: string | null) => {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;
    const time = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return end ? `${time(start)} – ${time(end)}` : time(start);
  };

  const isStaff = role === "director" || role === "teacher";
  const joinState = selected
    ? getLiveSessionJoinState({
        startsAt: selected.starts_at,
        endsAt: selected.ends_at,
        status: selected.status,
        isStaff,
      })
    : null;

  const joinFromCalendar = async () => {
    if (!selected) return;
    try {
      await joinLiveSession(selected.id, {
        isStaff,
        onJitsi: (id) => {
          setLiveSessionId(id);
          navigate("meeting");
        },
        resolveTarget: (id) => LiveSessionService.joinTarget(id),
      });
      if (isStaff && selected.status === "scheduled") {
        updateStatus.mutate({ id: selected.id, status: "live" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ouverture impossible");
    }
  };

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const now = useMemo(() => new Date(nowTick), [nowTick]);

  const shiftAnchor = (direction: -1 | 1) => {
    setAnchor((prev) => {
      const d = new Date(prev);
      if (view === "week") d.setDate(d.getDate() + direction * 7);
      else d.setMonth(d.getMonth() + direction);
      return d;
    });
  };

  const toolbar = (
    <CalendarToolbar
      view={view}
      anchor={anchor}
      onViewChange={setView}
      onPrev={() => shiftAnchor(-1)}
      onNext={() => shiftAnchor(1)}
      onToday={() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        setAnchor(d);
      }}
    />
  );

  const filters = (
    <div className="space-y-3">
      {studentContext ? (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <LevelBadge code={studentContext.level} />
          <GroupBadge label={studentContext.group} />
          <span aria-hidden>•</span>
          <span>{studentContext.teacher}</span>
        </p>
      ) : null}
      <FilterBar className="mb-0 sm:mb-0">
        {filterVisibility.level ? (
          <select
            aria-label="Niveau"
            className="h-10 min-w-[8rem] flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none"
            value={levelFilter}
            onChange={(e) => {
              const next = e.target.value;
              setLevelFilter(next);
              const stillValid = filterClassesByLevelCode(classesQuery.data ?? [], next).some(
                (klass) => klass.id === classFilter,
              );
              if (!stillValid) setClassFilter("");
            }}
          >
            <option value="">Tous les niveaux</option>
            {(levelsQuery.data ?? []).map((l) => (
              <option key={l.id} value={l.code}>
                {l.code}
              </option>
            ))}
          </select>
        ) : null}
        {filterVisibility.group ? (
          <select
            aria-label="Groupe"
            className="h-10 min-w-[8rem] flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="">Tous les groupes</option>
            {groupsForLevel.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference || c.name}
              </option>
            ))}
          </select>
        ) : null}
        {filterVisibility.teacher ? (
          <select
            aria-label="Professeur"
            className="h-10 min-w-[8rem] flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none"
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
          >
            <option value="">Tous les professeurs</option>
            {(teachersQuery.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}
        {filterVisibility.status ? (
          <select
            aria-label="Statut"
            className="h-10 min-w-[8rem] flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="scheduled">À venir</option>
            <option value="live">En direct</option>
            <option value="completed">Terminée</option>
            <option value="cancelled">Annulée</option>
          </select>
        ) : null}
      </FilterBar>
    </div>
  );

  return (
    <>
      {embedded ? (
        <div className="mb-4 space-y-3">
          <h3 className="text-sm font-semibold tracking-tight">Calendrier</h3>
          {toolbar}
        </div>
      ) : (
        <PageHeader
          title="Calendrier"
          subtitle="Planning des cours en direct : heure, groupe, professeur, statut."
          action={toolbar}
        />
      )}
      <div className="mb-4">{filters}</div>
      <QueryState
        isLoading={sessionsQuery.isLoading || classesQuery.isLoading}
        isError={sessionsQuery.isError}
        error={sessionsQuery.error}
        isEmpty={!sessionsQuery.isLoading && sessions.length === 0}
        emptyTitle="Aucune séance"
        emptyMessage="Aucune séance pour cette période ou ces filtres."
        onRetry={() => void sessionsQuery.refetch()}
      >
        <div className="md:hidden">
          <CalendarAgendaView
            agendaDays={agendaDays}
            sessionsByDay={sessionsByDay}
            today={today}
            selectedId={selectedId}
            showTeacher={showTeacherOnCards}
            teacherName={teacherName}
            onSelect={setSelectedId}
          />
        </div>

        <div className="hidden md:block">
          {view === "week" ? (
            <CalendarWeekView
              weekDays={weekDays}
              sessionsByDay={sessionsByDay}
              today={today}
              now={now}
              selectedId={selectedId}
              showTeacher={role === "director"}
              teacherName={teacherName}
              onSelect={setSelectedId}
            />
          ) : (
            <CalendarMonthView
              monthCells={monthCells}
              anchor={anchor}
              sessionsByDay={sessionsByDay}
              today={today}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </QueryState>

      {selected && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{selected.title}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Status tone={calendarStatusTone(selected.status)}>
                    {liveStatusLabel(selected.status)}
                  </Status>
                  <GroupBadge label={selected.class?.name ?? null} />
                  {selected.class?.level?.code ? (
                    <LevelBadge code={selected.class.level.code} />
                  ) : null}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                Fermer
              </Button>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-[7rem_1fr]">
              <dt className="text-muted-foreground">Date</dt>
              <dd>{formatLiveDate(selected.starts_at)}</dd>
              <dt className="text-muted-foreground">Horaire</dt>
              <dd>{formatRange(selected.starts_at, selected.ends_at)}</dd>
              <dt className="text-muted-foreground">Durée</dt>
              <dd>{zoomMeetingDurationMinutes(selected.starts_at, selected.ends_at)} min</dd>
              <dt className="text-muted-foreground">Professeur</dt>
              <dd>{teacherName(selected)}</dd>
              <dt className="text-muted-foreground">Plateforme</dt>
              <dd>
                {videoProviderLabel(selected.video_provider, isZoomActive(selected.video_provider))}
              </dd>
            </dl>
            {role === "student" &&
            (selected.status === "scheduled" || selected.status === "live") &&
            joinState &&
            !joinState.allowed ? (
              <p className="text-sm text-muted-foreground">
                {joinState.reason === "too_early"
                  ? "La réunion sera accessible à partir de l’heure de début du créneau."
                  : "Cette séance n’est plus rejoignable."}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              {canEditLiveSession(role, selected, myTeacherId) &&
              selected.status !== "cancelled" ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditOpen(true);
                  }}
                >
                  Modifier la séance
                </Button>
              ) : null}
              {(selected.status === "scheduled" || selected.status === "live") && (
                <Button
                  disabled={!joinState?.allowed && !isStaff}
                  onClick={() => void joinFromCalendar()}
                >
                  {isStaff && selected.status !== "live" ? "Démarrer" : "Rejoindre"}
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedId(null)}>
                Fermer
              </Button>
            </div>
          </Surface>
        </div>
      )}

      <EditLiveSessionModal
        open={editOpen}
        session={selected}
        onClose={() => {
          setEditOpen(false);
          void sessionsQuery.refetch();
        }}
      />
    </>
  );
}
