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
  useGenerateMonthSessions,
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
  isLiveSessionExpired,
  isZoomActive,
  joinLiveSession,
  liveStatusLabel,
  openExternalMeeting,
  videoProviderLabel,
  zoomHrefForViewer,
  zoomMeetingDurationMinutes,
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
  return joinLiveSession(session.id, {
    isStaff: options.isStaff,
    onJitsi: options.onJitsi,
    resolveTarget: (id) => LiveSessionService.joinTarget(id),
  });
}

function SessionCard({
  item,
  isStaff,
  onStart,
  onEnd,
  onEmergency,
  onCopyZoom,
  onRevertJitsi,
}: {
  item: LiveSessionListItem;
  isStaff: boolean;
  onStart: () => void;
  onEnd: () => void;
  onEmergency: () => void;
  onCopyZoom: () => void;
  onRevertJitsi: () => void;
}) {
  const zoom = isZoomActive(item.video_provider);
  const durationMin = zoomMeetingDurationMinutes(item.starts_at, item.ends_at);
  const joinState = getLiveSessionJoinState({
    startsAt: item.starts_at,
    endsAt: item.ends_at,
    status: item.status,
    isStaff,
  });
  const unavailableLabel =
    joinState.reason === "too_early"
      ? "Accès disponible à partir de l’heure du créneau."
      : joinState.reason === "ended" || joinState.reason === "closed"
        ? "Cette séance est fermée."
        : null;
  const canAct = item.status === "scheduled" || item.status === "live";
  const joinLabel = isStaff ? (item.status === "live" ? "Rejoindre" : "Démarrer") : "Rejoindre";

  return (
    <Surface className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <span className="grid size-12 place-items-center rounded-lg bg-secondary text-primary">
          <Video className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold">{item.title}</h2>
          <p className="text-sm text-muted-foreground">
            Professeur : <strong className="text-foreground">{teacherLabel(item)}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Groupe : <strong className="text-foreground">{item.class?.name ?? "—"}</strong>
            {item.class?.level?.code ? ` · Niveau ${item.class.level.code}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatLiveDate(item.starts_at)} · {formatLiveTime(item.starts_at)}
            {item.ends_at ? ` – ${formatLiveTime(item.ends_at)}` : ""}
            {" · "}
            {durationMin} min
          </p>
          <p className="text-sm text-muted-foreground">
            Visioconférence :{" "}
            <strong className="text-foreground">
              {videoProviderLabel(item.video_provider, zoom)}
            </strong>
          </p>
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
                {joinLabel}
              </Button>
              {isStaff && item.status === "live" && (
                <Button variant="outline" onClick={onEnd}>
                  Terminer
                </Button>
              )}
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
  const generateMonth = useGenerateMonthSessions();
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
  const [monthOpen, setMonthOpen] = useState(false);
  const [monthClassId, setMonthClassId] = useState("");

  const { liveNow, upcoming, visibleCount } = useMemo(() => {
    const rows = sessionsQuery.data ?? [];
    const now = Date.now();
    const active = rows.filter((s) => !isLiveSessionExpired(s, now));
    const liveNowRows = active.filter((s) => s.status === "live");
    const upcomingRows = active.filter((s) => s.status === "scheduled");
    return {
      liveNow: liveNowRows,
      upcoming: upcomingRows,
      visibleCount: liveNowRows.length + upcomingRows.length,
    };
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

  const endSession = (session: LiveSessionListItem) => {
    updateStatus.mutate(
      { id: session.id, status: "completed" },
      {
        onSuccess: () => toast.success("Séance terminée"),
        onError: (err) => toast.error(err.message),
      },
    );
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
            ? "Jitsi par défaut. Zoom d’urgence si besoin. Générez aussi le mois complet."
            : "Rejoignez le cours de votre groupe."
        }
        action={
          isStaff ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setMonthOpen(true)}>
                Générer le mois
              </Button>
              <Button onClick={() => setOpen(true)}>+ Réunion exceptionnelle</Button>
            </div>
          ) : undefined
        }
      />

      {recordingProvider.data?.configured ? (
        <Surface className="mb-4 p-4 text-sm">
          <p className="font-medium">{recordingProvider.data.message}</p>
          {(recordingsQuery.data?.length ?? 0) > 0 && (
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
      ) : (
        <p className="mb-4 text-xs text-muted-foreground">Enregistrement non configuré</p>
      )}

      <QueryState
        isLoading={sessionsQuery.isLoading}
        isError={sessionsQuery.isError}
        error={sessionsQuery.error}
        isEmpty={visibleCount === 0}
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
                  onEnd={() => endSession(item)}
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
                  onEnd={() => endSession(item)}
                  onEmergency={() => setConfirmZoomId(item.id)}
                  onCopyZoom={() => void copyZoom(item.id)}
                  onRevertJitsi={() => setConfirmJitsiId(item.id)}
                />
              ))
            )}
          </section>
        </div>
      </QueryState>

      {open && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Réunion exceptionnelle</h2>
            <Input
              placeholder="Cours allemand"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
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

      {monthOpen && isStaff && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Générer les séances du mois</h2>
            <p className="text-sm text-muted-foreground">
              Crée automatiquement les cours récurrents (sans doublons) pour le mois en cours, selon
              l’horaire du groupe.
            </p>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={monthClassId}
              onChange={(e) => setMonthClassId(e.target.value)}
            >
              <option value="">Choisir le groupe</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.level}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setMonthOpen(false);
                  setMonthClassId("");
                }}
              >
                Annuler
              </Button>
              <Button
                disabled={!monthClassId || generateMonth.isPending}
                onClick={() => {
                  const now = new Date();
                  generateMonth.mutate(
                    {
                      classId: monthClassId,
                      year: now.getFullYear(),
                      month: now.getMonth() + 1,
                    },
                    {
                      onSuccess: (count) => {
                        toast.success(
                          count > 0
                            ? `${count} séance${count > 1 ? "s" : ""} générée${count > 1 ? "s" : ""}`
                            : "Aucune nouvelle séance (déjà à jour)",
                        );
                        setMonthOpen(false);
                        setMonthClassId("");
                      },
                      onError: (err) => toast.error(err.message),
                    },
                  );
                }}
              >
                {generateMonth.isPending ? "Génération…" : "Générer"}
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
  const [resolvedProvider, setResolvedProvider] = useState<"zoom" | "jitsi" | null>(null);
  const [joinHref, setJoinHref] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const session = sessionQuery.data;
  const isStaff = role === "director" || role === "teacher";

  const leaveMeeting = () => {
    clearLiveSessionId();
    navigate("live");
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setResolvedProvider(null);
    setJoinHref(null);
    setResolveError(null);
    void LiveSessionService.joinTarget(session.id)
      .then((target) => {
        if (cancelled) return;
        if (target.provider === "zoom") {
          const href = zoomHrefForViewer(target, isStaff);
          setResolvedProvider("zoom");
          setJoinHref(href);
          if (!isStaff && href) openExternalMeeting(href);
          return;
        }
        setResolvedProvider("jitsi");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setResolveError(err.message || "Impossible de rejoindre la visioconférence.");
      });
    return () => {
      cancelled = true;
    };
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

  if (sessionQuery.isLoading || (session && !resolvedProvider && !resolveError)) {
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

  if (resolveError) {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold">Impossible de rejoindre la visioconférence</h2>
        <p className="text-sm text-muted-foreground">{resolveError}</p>
        <Button variant="outline" onClick={leaveMeeting}>
          Retour à En direct
        </Button>
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
            ? "La réunion n’est accessible qu’à partir de l’heure de début du créneau."
            : "Cette séance est terminée ou fermée."}
        </p>
        <Button variant="outline" onClick={leaveMeeting}>
          Retour à En direct
        </Button>
      </Surface>
    );
  }

  const displayName = user?.name?.trim() || user?.email || "Participant";

  // Never mount Jitsi when the RPC says Zoom.
  if (resolvedProvider === "zoom") {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold">
          {isStaff ? "Visioconférence : Zoom" : session.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {session.class?.name} · Niveau {session.class?.level?.code ?? "—"}
          {isStaff ? "" : ` · ${teacherLabel(session)}`}
        </p>
        <p className="text-sm text-muted-foreground">
          {isStaff
            ? "Utilisez le lien hôte (start_url) pour démarrer la réunion Zoom."
            : "Vous rejoignez via le lien participant Zoom (join_url)."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              if (joinHref) {
                openExternalMeeting(joinHref);
                return;
              }
              void LiveSessionService.joinTarget(session.id)
                .then((target) => {
                  const href = zoomHrefForViewer(target, isStaff);
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
                      setResolvedProvider(null);
                      void sessionQuery.refetch();
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
