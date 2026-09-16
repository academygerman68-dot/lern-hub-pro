import { useMemo, useState } from "react";
import { Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAcademicAccess,
  useClasses,
  useCreateLiveSession,
  useLiveSession,
  useLiveSessions,
  useRecordingProvider,
  useRecordings,
  useUpdateLiveSessionStatus,
} from "@/hooks/use-academy-data";
import { getLiveSessionId, setLiveSessionId, clearLiveSessionId } from "@/lib/live-class-session";
import { getJitsiConfig } from "@/lib/jitsi-config";
import { useAcademy } from "./academy-context";
import { JitsiMeetingEmbed } from "./jitsi-meeting";
import { QueryState } from "./query-state";
import { PageHeader, Status, Surface } from "./primitives";

export function LiveClassesPage({ meeting }: { meeting: boolean }) {
  const accessQuery = useAcademicAccess();
  const { role } = useAcademy();

  if (accessQuery.isLoading) return <div className="min-h-[40vh]" />;
  if (role === "student" && accessQuery.data === false) {
    return (
      <Surface className="mx-auto max-w-xl space-y-3 p-8 text-center">
        <h2 className="text-xl font-semibold">Access restricted</h2>
        <p className="text-sm text-muted-foreground">
          Live classes require an active subscription. Open Payments to review your status.
        </p>
      </Surface>
    );
  }

  if (meeting) return <LiveMeetingRoom />;
  return <LiveSessionLobby />;
}

function teacherLabel(item: {
  teacher?: { profile: { first_name: string; last_name: string } | null } | null;
}) {
  const p = item.teacher?.profile;
  if (!p) return "Teacher TBD";
  return `${p.first_name} ${p.last_name}`.trim() || "Teacher TBD";
}

function SessionCard({
  item,
  onJoin,
  joinLabel = "Join meeting",
}: {
  item: {
    id: string;
    title: string;
    status: string;
    starts_at: string;
    ends_at: string | null;
    meeting_room: string;
    class?: { name: string } | null;
    teacher?: { profile: { first_name: string; last_name: string } | null } | null;
  };
  onJoin: () => void;
  joinLabel?: string;
}) {
  return (
    <Surface className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid size-12 place-items-center rounded-lg bg-secondary text-primary">
          <Video className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{item.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.class?.name ?? "Class"} · {teacherLabel(item)} ·{" "}
            {new Date(item.starts_at).toLocaleString()}
            {item.ends_at ? ` → ${new Date(item.ends_at).toLocaleTimeString()}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Room · {item.meeting_room}</p>
        </div>
        <Status
          tone={item.status === "live" ? "green" : item.status === "scheduled" ? "amber" : "red"}
        >
          {item.status}
        </Status>
        {(item.status === "scheduled" || item.status === "live") && (
          <Button onClick={onJoin}>
            <Video className="size-4" />
            {joinLabel}
          </Button>
        )}
      </div>
    </Surface>
  );
}

function LiveSessionLobby() {
  const { navigate, role, user } = useAcademy();
  const sessionsQuery = useLiveSessions();
  const classesQuery = useClasses();
  const recordingProvider = useRecordingProvider();
  const recordingsQuery = useRecordings();
  const createSession = useCreateLiveSession();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const jitsi = getJitsiConfig();

  const { liveNow, upcoming, past } = useMemo(() => {
    const rows = sessionsQuery.data ?? [];
    const now = Date.now();
    const liveNowRows = rows.filter((s) => s.status === "live");
    const upcomingRows = rows.filter((s) => {
      if (s.status !== "scheduled") return false;
      const end = s.ends_at
        ? new Date(s.ends_at).getTime()
        : new Date(s.starts_at).getTime() + 2 * 3600_000;
      return end >= now - 15 * 60_000;
    });
    const pastRows = rows.filter(
      (s) =>
        s.status === "completed" ||
        s.status === "cancelled" ||
        (s.status === "scheduled" &&
          (s.ends_at
            ? new Date(s.ends_at).getTime() < now - 15 * 60_000
            : new Date(s.starts_at).getTime() < now - 3 * 3600_000)),
    );
    return { liveNow: liveNowRows, upcoming: upcomingRows, past: pastRows };
  }, [sessionsQuery.data]);

  const join = (id: string) => {
    setLiveSessionId(id);
    navigate("meeting");
  };

  const resetForm = () => {
    setOpen(false);
    setTitle("");
    setClassId("");
    setDate("");
    setStartTime("");
    setEndTime("");
  };

  return (
    <>
      <PageHeader
        title="Live sessions"
        subtitle="Create a class meeting and join the same Jitsi room from any authorized account."
        action={
          (role === "director" || role === "teacher") && (
            <Button onClick={() => setOpen(true)}>+ Create session</Button>
          )
        }
      />

      {jitsi.requiresJwt && (
        <Surface className="mb-4 border-amber-500/30 bg-warning-soft p-4 text-sm">
          JaaS JWT required. For a real meeting without JaaS, remove VITE_JAAS_APP_ID (defaults to
          meet.jit.si). Edge Function `jaas-token` mints JWT when JAAS_* secrets exist.
        </Surface>
      )}

      <Surface className="mb-4 p-4 text-sm">
        <p className="font-medium">
          {recordingProvider.data?.configured
            ? recordingProvider.data.message
            : "Enregistrement non configuré"}
        </p>
        <p className="mt-1 text-muted-foreground">
          Les réunions ne sont jamais présentées comme enregistrées sans fournisseur réel.
          {recordingProvider.data?.configured
            ? " Les enregistrements prêts apparaissent ci-dessous."
            : " Les actions d’enregistrement sont masquées."}
        </p>
        {recordingProvider.data?.configured && (recordingsQuery.data?.length ?? 0) > 0 && (
          <ul className="mt-3 space-y-2">
            {recordingsQuery.data
              ?.filter((r) => r.status === "ready")
              .map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span>{r.title}</span>
                  <span className="text-muted-foreground">
                    {r.duration_seconds ? `${Math.round(r.duration_seconds / 60)} min` : "—"}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Surface>

      <QueryState
        isLoading={sessionsQuery.isLoading}
        isError={sessionsQuery.isError}
        error={sessionsQuery.error}
        isEmpty={(sessionsQuery.data?.length ?? 0) === 0}
        emptyTitle="No upcoming sessions"
        emptyMessage="Teachers or directors can create a live session for a class."
        onRetry={() => void sessionsQuery.refetch()}
      >
        <div className="space-y-8">
          {liveNow.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Live now
              </h2>
              {liveNow.map((item) => (
                <SessionCard key={item.id} item={item} onJoin={() => join(item.id)} />
              ))}
            </section>
          )}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled sessions.</p>
            ) : (
              upcoming.map((item) => (
                <SessionCard
                  key={item.id}
                  item={item}
                  onJoin={() => join(item.id)}
                  joinLabel={
                    role !== "student" && item.status === "scheduled"
                      ? "Start meeting"
                      : "Join meeting"
                  }
                />
              ))
            )}
          </section>
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Past
              </h2>
              {past.map((item) => (
                <SessionCard key={item.id} item={item} onJoin={() => join(item.id)} />
              ))}
            </section>
          )}
        </div>
      </QueryState>

      {open && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Create session</h2>
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Select class</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-label="Start time"
              />
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-label="End time"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                disabled={
                  !title.trim() || !classId || !date || !startTime || createSession.isPending
                }
                onClick={() => {
                  const startsAt = new Date(`${date}T${startTime}:00`);
                  const endsAt = endTime ? new Date(`${date}T${endTime}:00`) : null;
                  if (endsAt && endsAt <= startsAt) {
                    toast.error("L’heure de fin doit être après l’heure de début.");
                    return;
                  }
                  createSession.mutate(
                    {
                      title: title.trim(),
                      classId,
                      startsAt: startsAt.toISOString(),
                      endsAt: endsAt ? endsAt.toISOString() : null,
                      createdBy: user?.id ?? null,
                    },
                    {
                      onSuccess: (session) => {
                        toast.success("Meeting created");
                        resetForm();
                        setLiveSessionId(session.id);
                        navigate("meeting");
                      },
                      onError: (err) => toast.error(err.message),
                    },
                  );
                }}
              >
                Create & join
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </>
  );
}

function LiveMeetingRoom() {
  const { navigate, user, role } = useAcademy();
  const sessionId = getLiveSessionId();
  const sessionQuery = useLiveSession(sessionId);
  const updateStatus = useUpdateLiveSessionStatus();
  const session = sessionQuery.data;

  const leaveMeeting = () => {
    clearLiveSessionId();
    navigate("live");
  };

  if (!sessionId) {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold">Session unavailable</h2>
        <p className="text-sm text-muted-foreground">No meeting was selected.</p>
        <Button onClick={() => navigate("live")}>Back to sessions</Button>
      </Surface>
    );
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">
        Loading session…
      </div>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold">Unable to join the meeting</h2>
        <p className="text-sm text-muted-foreground">
          {sessionQuery.error?.message ??
            "Session not found or you are not authorized for this class."}
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => void sessionQuery.refetch()}>Retry</Button>
          <Button
            variant="outline"
            onClick={() => {
              clearLiveSessionId();
              navigate("live");
            }}
          >
            Back to sessions
          </Button>
        </div>
      </Surface>
    );
  }

  if (session.status === "cancelled") {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold">Session cancelled</h2>
        <Button variant="outline" onClick={leaveMeeting}>
          Back to sessions
        </Button>
      </Surface>
    );
  }

  const displayName = user?.name?.trim() || user?.email || "Participant";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-medium sm:text-2xl">{session.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.class?.name} · {teacherLabel(session)}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Room {session.meeting_room} · {displayName}
            {role ? ` (${role})` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(role === "director" || role === "teacher") && session.status === "live" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => {
                updateStatus.mutate(
                  { id: session.id, status: "completed" },
                  {
                    onSuccess: () => {
                      toast.success("Session terminée");
                      leaveMeeting();
                    },
                    onError: (err) => toast.error(err.message),
                  },
                );
              }}
            >
              End session
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={leaveMeeting}
          >
            Leave meeting
          </Button>
        </div>
      </div>

      <JitsiMeetingEmbed
        roomName={session.meeting_room}
        displayName={displayName}
        {...(user?.email ? { email: user.email } : {})}
        onLeave={leaveMeeting}
        onConferenceJoined={() => {
          if ((role === "director" || role === "teacher") && session.status === "scheduled") {
            updateStatus.mutate(
              { id: session.id, status: "live" },
              { onError: (err) => toast.error(err.message) },
            );
          }
        }}
      />
    </div>
  );
}
