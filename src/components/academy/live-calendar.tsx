import { Component, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
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
  formatLiveTime,
} from "@/lib/live-meeting";
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

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b);
}

function statusTone(status: string): "green" | "amber" | "gray" | "red" {
  if (status === "live") return "green";
  if (status === "scheduled") return "amber";
  if (status === "cancelled") return "red";
  return "gray";
}

/**
 * Reusable week/month live schedule. Safe to embed in Live or use as Calendar route body.
 * Does not import live-pages (avoids circular module graph via staff/student pages).
 */
export function LiveCalendar({ embedded = false }: LiveCalendarProps) {
  const { navigate, role, user } = useAcademy();
  const sessionsQuery = useLiveSessions();
  const classesQuery = useClasses();
  const teachersQuery = useTeachers();
  const levelsQuery = useLevels();
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

  const myTeacherId = useMemo(() => {
    if (role !== "teacher") return null;
    return (
      (teachersQuery.data ?? []).find(
        (t) => t.email.toLowerCase() === (user?.email ?? "").toLowerCase(),
      )?.id ?? null
    );
  }, [role, teachersQuery.data, user?.email]);

  const sessions = useMemo(() => {
    const now = Date.now();
    return (sessionsQuery.data ?? []).filter((s) => {
      if (isLiveSessionExpired(s, now) && s.status !== "completed" && s.status !== "cancelled") {
        /* keep completed via status filter; hide stale scheduled */
      }
      if (classFilter && s.class_id !== classFilter) return false;
      if (teacherFilter && s.teacher_id !== teacherFilter) return false;
      if (levelFilter && s.class?.level?.code !== levelFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      return true;
    });
  }, [sessionsQuery.data, classFilter, teacherFilter, levelFilter, statusFilter]);

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
      const key = dayKey(new Date(session.starts_at));
      const list = map.get(key) ?? [];
      list.push(session);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    }
    return map;
  }, [sessions]);

  /** Mobile agenda: today → next 14 days as timeline */
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

  const viewControls = (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          setAnchor((prev) => {
            const d = new Date(prev);
            if (view === "week") d.setDate(d.getDate() - 7);
            else d.setMonth(d.getMonth() - 1);
            return d;
          })
        }
      >
        Précédent
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          setAnchor(d);
        }}
      >
        Aujourd’hui
      </Button>
      <Button
        size="sm"
        variant={view === "week" ? "default" : "outline"}
        onClick={() => setView("week")}
      >
        Semaine
      </Button>
      <Button
        size="sm"
        variant={view === "month" ? "default" : "outline"}
        onClick={() => setView("month")}
      >
        Mois
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          setAnchor((prev) => {
            const d = new Date(prev);
            if (view === "week") d.setDate(d.getDate() + 7);
            else d.setMonth(d.getMonth() + 1);
            return d;
          })
        }
      >
        Suivant
      </Button>
    </div>
  );

  const filters = (
    <FilterBar>
      <select
        className="h-10 min-w-[8rem] flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none"
        value={levelFilter}
        onChange={(e) => setLevelFilter(e.target.value)}
      >
        <option value="">Tous les niveaux</option>
        {(levelsQuery.data ?? []).map((l) => (
          <option key={l.id} value={l.code}>
            {l.code}
          </option>
        ))}
      </select>
      <select
        className="h-10 min-w-[8rem] flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none"
        value={classFilter}
        onChange={(e) => setClassFilter(e.target.value)}
      >
        <option value="">Tous les groupes</option>
        {(classesQuery.data ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
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
      <select
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
    </FilterBar>
  );

  const sessionChip = (session: LiveSessionListItem, dense = false) => (
    <button
      key={session.id}
      type="button"
      className={`w-full rounded-lg border border-border/80 bg-card text-left transition duration-150 hover:border-primary/40 hover:bg-muted/40 ${
        dense ? "px-1.5 py-1" : "p-2"
      } ${selectedId === session.id ? "border-primary ring-1 ring-primary/30" : ""}`}
      onClick={() => setSelectedId(session.id)}
    >
      <span className={`block font-medium text-foreground ${dense ? "text-[10px]" : "text-xs"}`}>
        {formatLiveTime(session.starts_at)} · {session.title}
      </span>
      {!dense ? (
        <span className="mt-1 flex flex-wrap items-center gap-1">
          <Status tone={statusTone(session.status)}>{liveStatusLabel(session.status)}</Status>
          {session.class?.name ? (
            <span className="truncate text-[10px] text-muted-foreground">{session.class.name}</span>
          ) : null}
        </span>
      ) : null}
    </button>
  );

  return (
    <>
      {embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold tracking-tight">Calendrier</h3>
          {viewControls}
        </div>
      ) : (
        <PageHeader
          title="Calendrier"
          subtitle="Planning des cours en direct : heure, groupe, professeur, statut."
          action={viewControls}
        />
      )}
      {filters}
      <QueryState
        isLoading={sessionsQuery.isLoading || classesQuery.isLoading}
        isError={sessionsQuery.isError}
        error={sessionsQuery.error}
        isEmpty={!sessionsQuery.isLoading && sessions.length === 0}
        emptyTitle="Aucune séance"
        emptyMessage="Aucune séance pour cette période ou ces filtres."
        onRetry={() => void sessionsQuery.refetch()}
      >
        {/* Mobile agenda */}
        <div className="space-y-4 md:hidden">
          {agendaDays.map((day) => {
            const items = sessionsByDay.get(dayKey(day)) ?? [];
            const label = isSameDay(day, today)
              ? "Aujourd’hui"
              : isSameDay(day, new Date(today.getTime() + 86_400_000))
                ? "Demain"
                : day.toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  });
            if (
              !items.length &&
              !isSameDay(day, today) &&
              !isSameDay(day, new Date(today.getTime() + 86_400_000))
            ) {
              return null;
            }
            return (
              <div key={dayKey(day)}>
                <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {label}
                </h4>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Rien de prévu</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((session) => (
                      <Surface
                        key={session.id}
                        className="cursor-pointer p-3"
                        onClick={() => setSelectedId(session.id)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatLiveTime(session.starts_at)}
                          </span>
                          <Status tone={statusTone(session.status)}>
                            {liveStatusLabel(session.status)}
                          </Status>
                        </div>
                        <p className="mt-1 font-medium">{session.title}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <GroupBadge label={session.class?.name ?? null} />
                          {session.class?.level?.code ? (
                            <LevelBadge code={session.class.level.code} />
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{teacherName(session)}</p>
                      </Surface>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop week / month */}
        <div className="hidden md:block">
          {view === "week" ? (
            <Surface className="overflow-hidden">
              <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground">
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={dayKey(day)}
                      className={`border-r border-border/60 px-2 py-3 last:border-r-0 ${
                        isToday ? "bg-primary/5 text-primary" : ""
                      }`}
                    >
                      <span className="block capitalize">
                        {day.toLocaleDateString("fr-FR", { weekday: "short" })}
                      </span>
                      <span
                        className={`mt-1 inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
                          isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="grid min-h-[28rem] grid-cols-7">
                {weekDays.map((day) => {
                  const items = sessionsByDay.get(dayKey(day)) ?? [];
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={dayKey(day)}
                      className={`space-y-1.5 border-r border-border/60 p-1.5 last:border-r-0 ${
                        isToday ? "bg-primary/[0.03]" : ""
                      }`}
                    >
                      {items.map((session) => sessionChip(session))}
                    </div>
                  );
                })}
              </div>
            </Surface>
          ) : (
            <Surface className="p-3 sm:p-4">
              <p className="mb-3 text-sm font-semibold capitalize">
                {anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
              </p>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                  <div key={d} className="py-2 font-medium">
                    {d}
                  </div>
                ))}
                {monthCells.map((day) => {
                  const inMonth = day.getMonth() === anchor.getMonth();
                  const items = sessionsByDay.get(dayKey(day)) ?? [];
                  const isToday = isSameDay(day, today);
                  return (
                    <button
                      type="button"
                      key={dayKey(day)}
                      className={`min-h-[4.5rem] rounded-lg border p-1.5 text-left transition ${
                        inMonth
                          ? "border-border/70 bg-card"
                          : "border-transparent bg-muted/30 opacity-50"
                      } ${isToday ? "border-primary/40 ring-1 ring-primary/20" : ""} ${
                        items.length ? "hover:border-primary/30" : ""
                      }`}
                      onClick={() => {
                        if (items[0]) setSelectedId(items[0].id);
                      }}
                    >
                      <p
                        className={`mb-1 text-[11px] font-semibold ${isToday ? "text-primary" : ""}`}
                      >
                        {day.getDate()}
                      </p>
                      {items.length > 0 ? (
                        <p className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
                          {items.length} séance{items.length > 1 ? "s" : ""}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </Surface>
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
                  <Status tone={statusTone(selected.status)}>
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
