import { useEffect, useMemo, useState } from "react";
import { Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAcademicAccess,
  useClasses,
  useCreateEmergencyZoom,
  useCreateLiveSession,
  useLiveSession,
  useLiveSessions,
  useLiveSessionsRealtime,
  useRecordingProvider,
  useRecordings,
  useRevertLiveSessionToJitsi,
  useUpdateLiveSessionStatus,
} from "@/hooks/use-academy-data";
import { getLiveSessionId, setLiveSessionId, clearLiveSessionId } from "@/lib/live-class-session";
import { getLiveSessionJoinState } from "@/lib/jitsi-config";
import {
  formatLiveDate,
  formatLiveTime,
  isZoomActive,
  liveStatusLabel,
  openExternalMeeting,
  videoProviderLabel,
} from "@/lib/live-meeting";
import { LiveSessionService } from "@/services/academy-services";
import type { LiveSessionListItem } from "@/services/supabase/live-session-service";
import { useAcademy } from "./academy-context";
import { JitsiMeetingEmbed } from "./jitsi-meeting";
import { QueryState } from "./query-state";
import { PageHeader, Status, Surface } from "./primitives";

export function LiveClassesPage({ meeting }: { meeting: boolean }) {
  const accessQuery = useAcademicAccess();
  const { role } = useAcademy();
  useLiveSessionsRealtime();

  if (accessQuery.isLoading) return <div className="min-h-[40vh]" />;
  if (role === "student" && accessQuery.data === false) {
    return (
      <Surface className="mx-auto max-w-xl space-y-3 p-8 text-center">
        <h2 className="text-xl font-semibold">Accès restreint</h2>
        <p className="text-sm text-muted-foreground">
          Les cours en direct nécessitent un abonnement actif.
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
  if (!p) return "—";
  return `${p.first_name} ${p.last_name}`.trim() || "—";
}

async function joinActiveConference(
  session: LiveSessionListItem,
  options: { isStaff: boolean; onJitsi: (id: string) => void },
) {
  const target = await LiveSessionService.joinTarget(session.id);
  if (target.provider === "zoom") {
    const href = options.isStaff ? target.start_url || target.url : target.url;
    if (!href) throw new Error("La réunion Zoom n’est pas encore prête.");
    openExternalMeeting(href);
    return "zoom" as const;
  }
  options.onJitsi(session.id);
  return "jitsi" as const;
}

function SessionCard({
  item,
  isStaff,
  onStart,
  onEmergency,
  onCopyZoom,
  onRevertJitsi,
}: {
  item: LiveSessionListItem;
  isStaff: boolean;
  onStart: () => void;
  onEmergency: () => void;
  onCopyZoom: () => void;
  onRevertJitsi: () => void;
}) {
  const zoom = isZoomActive(item.video_provider);
  const joinState = getLiveSessionJoinState({
    startsAt: item.starts_at,
    endsAt: item.ends_at,
    status: item.status,
    isStaff,
  });
  const unavailableLabel =
    joinState.reason === "too_early"
      ? "Accès disponible 15 minutes avant le début."
      : joinState.reason === "ended" || joinState.reason === "closed"
        ? "Cette séance est fermée."
        : null;
  const canAct = item.status === "scheduled" || item.status === "live";

  return (
    <Surface className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <span className="grid size-12 place-items-center rounded-lg bg-secondary text-primary">
          <Video className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold">{item.title}</h2>
          <p className="text-sm text-muted-foreground">
            Groupe {item.class?.name ?? "—"} · Niveau {item.class?.level?.code ?? "—"}
            {isStaff ? "" : ` · ${teacherLabel(item)}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatLiveDate(item.starts_at)} · {formatLiveTime(item.starts_at)}
            {item.ends_at ? ` – ${formatLiveTime(item.ends_at)}` : ""}
          </p>
          {isStaff && (
            <>
              <p className="text-sm">
                Mode : <strong>En ligne</strong>
              </p>
              <p className="text-sm">
                Visioconférence : <strong>{videoProviderLabel(item.video_provider, zoom)}</strong>
              </p>
            </>
          )}
          {!joinState.allowed && unavailableLabel ? (
            <p className="text-xs text-muted-foreground">{unavailableLabel}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Status
            tone={item.status === "live" ? "green" : item.status === "scheduled" ? "amber" : "red"}
          >
            {liveStatusLabel(item.status)}
          </Status>
          {canAct && (
            <>
              <Button onClick={onStart} disabled={!joinState.allowed && !isStaff}>
                <Video className="size-4" />
                {isStaff
                  ? zoom
                    ? "Démarrer la réunion Zoom"
                    : "Démarrer la réunion"
                  : "Rejoindre le cours"}
              </Button>
              {isStaff && !zoom && (
                <Button variant="outline" onClick={onEmergency}>
                  Réunion d’urgence Zoom
                </Button>
              )}
              {isStaff && zoom && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={onCopyZoom}>
                    Copier le lien participant
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onRevertJitsi}>
                    Revenir à Jitsi
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
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
  const updateStatus = useUpdateLiveSessionStatus();
  const createZoom = useCreateEmergencyZoom();
  const revertJitsi = useRevertLiveSessionToJitsi();
  const isStaff = role === "director" || role === "teacher";
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [confirmZoomId, setConfirmZoomId] = useState<string | null>(null);
  const [confirmJitsiId, setConfirmJitsiId] = useState<string | null>(null);

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

  const markLive = (session: LiveSessionListItem) => {
    if (isStaff && session.status === "scheduled") {
      updateStatus.mutate({ id: session.id, status: "live" });
    }
  };

  const startSession = async (session: LiveSessionListItem) => {
    try {
      const provider = await joinActiveConference(session, {
        isStaff,
        onJitsi: (id) => {
          setLiveSessionId(id);
          navigate("meeting");
        },
      });
      markLive(session);
      if (provider === "zoom") toast.success("Ouverture de la réunion Zoom");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ouverture impossible");
    }
  };

  const copyZoom = async (id: string) => {
    try {
      const target = await LiveSessionService.joinTarget(id);
      const url = target.provider === "zoom" ? target.url : null;
      if (!url) throw new Error("Aucun lien Zoom enregistré.");
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copie impossible");
    }
  };

  const resetForm = () => {
    setOpen(false);
    setTitle("");
    setClassId("");
    setDate("");
    setStartTime("");
    setEndTime("");
  };

  const selectedForZoom = (sessionsQuery.data ?? []).find((s) => s.id === confirmZoomId) ?? null;

  const runEmergencyZoom = (sessionId: string) => {
    createZoom.mutate(sessionId, {
      onSuccess: (result) => {
        toast.success(
          result.reused ? "Réunion Zoom d’urgence prête" : "Réunion Zoom d’urgence créée",
        );
        setConfirmZoomId(null);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <>
      <PageHeader
        title="En direct"
        subtitle={
          isStaff
            ? "Démarrez la réunion Jitsi. Zoom n’est utilisé qu’en cas de panne."
            : "Rejoignez le cours de votre groupe."
        }
        action={
          isStaff ? (
            <Button onClick={() => setOpen(true)}>+ Planifier une séance</Button>
          ) : undefined
        }
      />

      <Surface className="mb-4 p-4 text-sm">
        <p className="font-medium">
          {recordingProvider.data?.configured
            ? recordingProvider.data.message
            : "Enregistrement non configuré"}
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
        emptyTitle="Aucune séance"
        emptyMessage={
          isStaff
            ? "Planifiez une séance en direct pour un groupe."
            : "Les séances de votre groupe apparaîtront ici."
        }
        onRetry={() => void sessionsQuery.refetch()}
      >
        <div className="space-y-8">
          {liveNow.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                En cours
              </h2>
              {liveNow.map((item) => (
                <SessionCard
                  key={item.id}
                  item={item}
                  isStaff={isStaff}
                  onStart={() => void startSession(item)}
                  onEmergency={() => setConfirmZoomId(item.id)}
                  onCopyZoom={() => void copyZoom(item.id)}
                  onRevertJitsi={() => setConfirmJitsiId(item.id)}
                />
              ))}
            </section>
          )}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              À venir
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune séance planifiée.</p>
            ) : (
              upcoming.map((item) => (
                <SessionCard
                  key={item.id}
                  item={item}
                  isStaff={isStaff}
                  onStart={() => void startSession(item)}
                  onEmergency={() => setConfirmZoomId(item.id)}
                  onCopyZoom={() => void copyZoom(item.id)}
                  onRevertJitsi={() => setConfirmJitsiId(item.id)}
                />
              ))
            )}
          </section>
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Passées
              </h2>
              {past.map((item) => (
                <SessionCard
                  key={item.id}
                  item={item}
                  isStaff={isStaff}
                  onStart={() => void startSession(item)}
                  onEmergency={() => setConfirmZoomId(item.id)}
                  onCopyZoom={() => void copyZoom(item.id)}
                  onRevertJitsi={() => undefined}
                />
              ))}
            </section>
          )}
        </div>
      </QueryState>

      {open && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Planifier une séance</h2>
            <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Choisir le groupe</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.level}
                </option>
              ))}
            </select>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-label="Heure de début"
              />
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-label="Heure de fin"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>
                Annuler
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
                      onSuccess: () => {
                        toast.success("Séance planifiée");
                        resetForm();
                      },
                      onError: (err) => toast.error(err.message),
                    },
                  );
                }}
              >
                Enregistrer
              </Button>
            </div>
          </Surface>
        </div>
      )}

      {confirmZoomId && selectedForZoom && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Créer une réunion Zoom d’urgence ?</h2>
            <p className="text-sm text-muted-foreground">
              Une réunion Zoom sera créée automatiquement pour cette session et remplacera
              temporairement Jitsi.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmZoomId(null)}
                disabled={createZoom.isPending}
              >
                Annuler
              </Button>
              <Button
                disabled={createZoom.isPending}
                onClick={() => runEmergencyZoom(confirmZoomId)}
              >
                {createZoom.isPending ? "Création de la réunion Zoom..." : "Créer la réunion Zoom"}
              </Button>
            </div>
          </Surface>
        </div>
      )}

      {confirmJitsiId && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Revenir à Jitsi</h2>
            <p className="text-sm text-muted-foreground">
              Voulez-vous réutiliser Jitsi pour cette session ?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmJitsiId(null)}>
                Annuler
              </Button>
              <Button
                disabled={revertJitsi.isPending}
                onClick={() => {
                  revertJitsi.mutate(confirmJitsiId, {
                    onSuccess: () => {
                      toast.success("Visioconférence : Jitsi");
                      setConfirmJitsiId(null);
                    },
                    onError: (err) => toast.error(err.message),
                  });
                }}
              >
                Revenir à Jitsi
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
  const createZoom = useCreateEmergencyZoom();
  const [endConferenceSignal, setEndConferenceSignal] = useState(0);
  const [confirmZoom, setConfirmZoom] = useState(false);
  const session = sessionQuery.data;
  const isStaff = role === "director" || role === "teacher";

  const leaveMeeting = () => {
    clearLiveSessionId();
    navigate("live");
  };

  useEffect(() => {
    if (!session || !isZoomActive(session.video_provider) || isStaff) return;
    void LiveSessionService.joinTarget(session.id)
      .then((target) => {
        if (target.provider === "zoom" && target.url) openExternalMeeting(target.url);
      })
      .catch(() => undefined);
  }, [session, isStaff]);

  if (!sessionId) {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold">Séance indisponible</h2>
        <p className="text-sm text-muted-foreground">Aucune réunion n’a été sélectionnée.</p>
        <Button onClick={() => navigate("live")}>Retour à En direct</Button>
      </Surface>
    );
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">
        Chargement de la séance…
      </div>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold">Impossible de rejoindre le cours</h2>
        <p className="text-sm text-muted-foreground">
          {sessionQuery.error?.message ?? "Séance introuvable ou accès non autorisé."}
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => void sessionQuery.refetch()}>Réessayer</Button>
          <Button variant="outline" onClick={leaveMeeting}>
            Retour à En direct
          </Button>
        </div>
      </Surface>
    );
  }

  if (session.status === "cancelled") {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold">Séance annulée</h2>
        <Button variant="outline" onClick={leaveMeeting}>
          Retour à En direct
        </Button>
      </Surface>
    );
  }

  const joinState = getLiveSessionJoinState({
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    status: session.status,
    isStaff,
  });

  if (!joinState.allowed) {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold">Accès à la réunion indisponible</h2>
        <p className="text-sm text-muted-foreground">
          {joinState.reason === "too_early"
            ? "La salle ouvre 15 minutes avant le début de la séance."
            : "Cette séance est terminée ou fermée."}
        </p>
        <Button variant="outline" onClick={leaveMeeting}>
          Retour à En direct
        </Button>
      </Surface>
    );
  }

  const displayName = user?.name?.trim() || user?.email || "Participant";
  const zoom = isZoomActive(session.video_provider);

  if (zoom) {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold">
          {isStaff ? "Visioconférence : Zoom — mode d’urgence" : session.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {session.class?.name} · Niveau {session.class?.level?.code ?? "—"}
          {isStaff ? "" : ` · ${teacherLabel(session)}`}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              void LiveSessionService.joinTarget(session.id)
                .then((target) => {
                  const href = isStaff ? target.start_url || target.url : target.url;
                  if (!href) throw new Error("La réunion Zoom n’est pas encore prête.");
                  openExternalMeeting(href);
                })
                .catch((err: Error) => toast.error(err.message));
            }}
          >
            {isStaff ? "Démarrer la réunion Zoom" : "Rejoindre le cours"}
          </Button>
          <Button variant="outline" onClick={leaveMeeting}>
            Retour à En direct
          </Button>
        </div>
      </Surface>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-medium sm:text-2xl">{session.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.class?.name} · Niveau {session.class?.level?.code ?? "—"} ·{" "}
            {teacherLabel(session)}
          </p>
          <p className="mt-0.5 text-sm">
            Visioconférence : <strong>Jitsi</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isStaff && (
            <Button variant="outline" size="sm" onClick={() => setConfirmZoom(true)}>
              Réunion d’urgence Zoom
            </Button>
          )}
          {isStaff && session.status === "live" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEndConferenceSignal((value) => value + 1);
                updateStatus.mutate(
                  { id: session.id, status: "completed" },
                  {
                    onSuccess: () => {
                      toast.success("Séance terminée");
                      leaveMeeting();
                    },
                    onError: (err) => toast.error(err.message),
                  },
                );
              }}
            >
              Terminer la séance
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={leaveMeeting}>
            Quitter
          </Button>
        </div>
      </div>

      <JitsiMeetingEmbed
        sessionId={session.id}
        roomName={session.meeting_room}
        displayName={displayName}
        startMuted={role === "student"}
        endConferenceSignal={endConferenceSignal}
        {...(user?.email ? { email: user.email } : {})}
        {...(isStaff ? { onEmergencyZoom: () => setConfirmZoom(true) } : {})}
        onLeave={leaveMeeting}
        onConferenceJoined={() => {
          if (isStaff && session.status === "scheduled") {
            updateStatus.mutate(
              { id: session.id, status: "live" },
              { onError: (err) => toast.error(err.message) },
            );
          }
        }}
      />

      {confirmZoom && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Créer une réunion Zoom d’urgence ?</h2>
            <p className="text-sm text-muted-foreground">
              Une réunion Zoom sera créée automatiquement pour cette session et remplacera
              temporairement Jitsi.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmZoom(false)}
                disabled={createZoom.isPending}
              >
                Annuler
              </Button>
              <Button
                disabled={createZoom.isPending}
                onClick={() => {
                  createZoom.mutate(session.id, {
                    onSuccess: (result) => {
                      toast.success(
                        result.reused
                          ? "Réunion Zoom d’urgence prête"
                          : "Réunion Zoom d’urgence créée",
                      );
                      setConfirmZoom(false);
                    },
                    onError: (err) => toast.error(err.message),
                  });
                }}
              >
                {createZoom.isPending ? "Création de la réunion Zoom..." : "Créer la réunion Zoom"}
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
}
