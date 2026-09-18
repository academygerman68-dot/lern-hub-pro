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
} from "@/lib/live-meeting";
import { LiveSessionService } from "@/services/academy-services";
import {
  useClasses,
  useLiveSessions,
  useUpdateLiveSessionStatus,
  useTeachers,
} from "@/hooks/use-academy-data";
import { PageHeader, Status, Surface } from "./primitives";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";

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
  const { navigate, role } = useAcademy();
  const sessionsQuery = useLiveSessions();
  const classesQuery = useClasses();
  const teachersQuery = useTeachers();
  const updateStatus = useUpdateLiveSessionStatus();
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const sessions = useMemo(() => {
    const now = Date.now();
    return (sessionsQuery.data ?? []).filter((s) => {
      if (isLiveSessionExpired(s, now)) return false;
      if (classFilter && s.class_id !== classFilter) return false;
      if (teacherFilter && s.teacher_id !== teacherFilter) return false;
      return true;
    });
  }, [sessionsQuery.data, classFilter, teacherFilter]);
  const selected = sessions.find((s) => s.id === selectedId) ?? null;

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

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const key = dayKey(new Date(session.starts_at));
      const list = map.get(key) ?? [];
      list.push(session);
      map.set(key, list);
    }
    return map;
  }, [sessions]);

  const teacherName = (session: (typeof sessions)[number]) => {
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

  const weekdayLabel = (d: Date) =>
    d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });

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

  const sessionMetaLine = (session: (typeof sessions)[number]) => {
    const duration = zoomMeetingDurationMinutes(session.starts_at, session.ends_at);
    const zoom = isZoomActive(session.video_provider);
    return `${formatRange(session.starts_at, session.ends_at)} · ${session.class?.name ?? "—"} · ${teacherName(session)} · ${videoProviderLabel(session.video_provider, zoom)} · ${liveStatusLabel(session.status)} · ${duration} min`;
  };

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

  return (
    <>
      {embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Planning intégré</h3>
          {viewControls}
        </div>
      ) : (
        <PageHeader
          title="Calendrier"
          subtitle="Planning des cours en direct : heure, groupe, professeur, statut."
          action={viewControls}
        />
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
      </div>
      <QueryState
        isLoading={sessionsQuery.isLoading || classesQuery.isLoading}
        isError={sessionsQuery.isError}
        error={sessionsQuery.error}
        isEmpty={!sessionsQuery.isLoading && sessions.length === 0}
        emptyTitle="Aucune séance"
        emptyMessage="Aucune séance planifiée pour cette période ou ces filtres."
        onRetry={() => void sessionsQuery.refetch()}
      >
        {view === "week" ? (
          <Surface className="overflow-x-auto">
            <div className="grid min-w-[720px] grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
              {weekDays.map((day) => (
                <div className="p-3 sm:p-4" key={dayKey(day)}>
                  {weekdayLabel(day)}
                </div>
              ))}
            </div>
            <div className="grid min-h-[360px] min-w-[720px] grid-cols-7">
              {weekDays.map((day) => {
                const items = sessionsByDay.get(dayKey(day)) ?? [];
                return (
                  <div key={dayKey(day)} className="space-y-2 border-r p-2">
                    {items.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        className="w-full rounded-md border-l-2 border-primary bg-secondary p-2 text-left"
                        onClick={() => setSelectedId(session.id)}
                      >
                        <strong className="block text-xs">{session.title}</strong>
                        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                          {sessionMetaLine(session)}
                        </p>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </Surface>
        ) : (
          <Surface className="overflow-x-auto p-2 sm:p-4">
            <p className="mb-3 text-sm font-medium capitalize">
              {anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </p>
            <div className="grid min-w-[640px] grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                <div key={d} className="p-2 font-medium">
                  {d}
                </div>
              ))}
              {monthCells.map((day) => {
                const inMonth = day.getMonth() === anchor.getMonth();
                const items = sessionsByDay.get(dayKey(day)) ?? [];
                return (
                  <div
                    key={dayKey(day)}
                    className={`min-h-24 rounded-md border p-1.5 text-left ${inMonth ? "bg-card" : "bg-muted/40 opacity-60"}`}
                  >
                    <p className="mb-1 text-[11px] font-medium">{day.getDate()}</p>
                    <div className="space-y-1">
                      {items.slice(0, 3).map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          className="block w-full truncate rounded bg-secondary px-1 py-0.5 text-[10px]"
                          onClick={() => setSelectedId(session.id)}
                        >
                          {formatRange(session.starts_at, session.ends_at)} ·{" "}
                          {session.class?.name ?? "—"} · {liveStatusLabel(session.status)}
                        </button>
                      ))}
                      {items.length > 3 && (
                        <p className="text-[10px] text-muted-foreground">+{items.length - 3}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Surface>
        )}
      </QueryState>

      {selected && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{selected.title}</h2>
              <Status
                tone={
                  selected.status === "live"
                    ? "green"
                    : selected.status === "scheduled"
                      ? "amber"
                      : "red"
                }
              >
                {liveStatusLabel(selected.status)}
              </Status>
            </div>
            <dl className="text-sm">
              <div className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Date</dt>
                <dd>{new Date(selected.starts_at).toLocaleDateString("fr-FR")}</dd>
                <dt className="text-muted-foreground">Horaire</dt>
                <dd>{formatRange(selected.starts_at, selected.ends_at)}</dd>
                <dt className="text-muted-foreground">Durée</dt>
                <dd>{zoomMeetingDurationMinutes(selected.starts_at, selected.ends_at)} min</dd>
                <dt className="text-muted-foreground">Groupe</dt>
                <dd>{selected.class?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Professeur</dt>
                <dd>{teacherName(selected)}</dd>
                <dt className="text-muted-foreground">Visioconférence</dt>
                <dd>
                  {videoProviderLabel(
                    selected.video_provider,
                    isZoomActive(selected.video_provider),
                  )}
                </dd>
              </div>
            </dl>
            {joinState && !joinState.allowed && !isStaff && joinState.reason === "too_early" && (
              <p className="text-sm text-amber-700">
                Accès possible uniquement à partir de l’heure de début du créneau.
              </p>
            )}
            <div className="flex justify-end gap-2">
              {(selected.status === "scheduled" || selected.status === "live") && (
                <Button
                  onClick={() => void joinFromCalendar()}
                  disabled={Boolean(joinState && !joinState.allowed && !isStaff)}
                >
                  {isStaff ? (selected.status === "live" ? "Rejoindre" : "Démarrer") : "Rejoindre"}
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedId(null)}>
                Fermer
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </>
  );
}
