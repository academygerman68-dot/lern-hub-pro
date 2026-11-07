import { useCallback, useEffect, useRef, useState } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { Button } from "@/components/ui/button";
import { getJitsiConfig } from "@/lib/jitsi-config";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string;
  roomName: string;
  displayName: string;
  email?: string;
  startMuted?: boolean;
  endConferenceSignal?: number;
  /** Fill the parent stage (immersive meeting). */
  fill?: boolean;
  onLeave?: () => void;
  onConferenceJoined?: () => void;
  onEmergencyZoom?: () => void;
};

type ConnectionState = "connecting" | "joined" | "left";
type AuthorizationState = "loading" | "ready" | "error";

const IFRAME_ALLOW =
  "camera; microphone; display-capture; fullscreen; autoplay; clipboard-write; compute-pressure; hid; serial; usb; screen-wake-lock; speaker-selection";

const tokenErrors: Record<string, string> = {
  JAAS_NOT_CONFIGURED:
    "Les réunions en ligne ne sont pas encore configurées. Contactez l’administration.",
  JAAS_KEY_ID_INVALID:
    "La configuration des réunions en ligne est incorrecte. Contactez l’administration.",
  JAAS_SIGNING_FAILED:
    "La configuration des réunions en ligne est invalide. Contactez l’administration.",
  SESSION_ACCESS_DENIED: "Vous n’êtes pas autorisé à rejoindre cette séance.",
  SESSION_CLOSED: "Cette séance est terminée ou annulée.",
  SESSION_TOO_EARLY: "La réunion n’est accessible qu’à partir de l’heure de début du créneau.",
  SESSION_ENDED: "La période d’accès à cette séance est terminée.",
  PROFILE_INACTIVE: "Votre compte n’est pas actif.",
  STUDENT_RECORD_MISSING: "Votre dossier étudiant est introuvable.",
  SUBSCRIPTION_REQUIRED: "Un abonnement actif est nécessaire pour rejoindre cette séance.",
  UNAUTHORIZED: "Votre connexion a expiré. Reconnectez-vous puis réessayez.",
};

async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === "function") {
    try {
      const body = (await context.clone().json()) as { error?: string; message?: string };
      const mapped = body.error ? tokenErrors[body.error] : undefined;
      if (mapped) return mapped;
      if (body.message) return body.message;
    } catch {
      // Fall through to the safe generic message.
    }
  }
  return "Impossible d’autoriser l’accès à la réunion. Vérifiez la fonction jaas-token.";
}

async function fetchJaasAuthorization(
  sessionId: string,
  expectedAppId: string | null,
): Promise<{ jwt: string; roomName: string }> {
  if (!isSupabaseConfigured)
    throw new Error("Les réunions en ligne sont indisponibles pour le moment.");
  const { data, error } = await getSupabase().functions.invoke<{
    jwt?: string;
    roomName?: string;
  }>("jaas-token", { body: { sessionId } });
  if (error) throw new Error(await readFunctionError(error));
  if (!data?.jwt || !data.roomName) {
    throw new Error("Impossible d’ouvrir la réunion. Réessayez ou contactez l’administration.");
  }
  if (expectedAppId && !data.roomName.startsWith(`${expectedAppId}/`)) {
    throw new Error(
      "La configuration des réunions en ligne est incohérente. Contactez l’administration.",
    );
  }
  return { jwt: data.jwt, roomName: data.roomName };
}

function ensureIframePermissions(parentNode: HTMLElement) {
  const apply = (iframe: HTMLIFrameElement) => {
    iframe.setAttribute("allow", IFRAME_ALLOW);
    iframe.setAttribute("allowfullscreen", "true");
  };

  const existing = parentNode.querySelector("iframe");
  if (existing instanceof HTMLIFrameElement) apply(existing);

  const observer = new MutationObserver(() => {
    const iframe = parentNode.querySelector("iframe");
    if (iframe instanceof HTMLIFrameElement) {
      apply(iframe);
      observer.disconnect();
    }
  });
  observer.observe(parentNode, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 8000);
}

/**
 * Real Jitsi / JaaS embed via @jitsi/react-sdk.
 * JaaS roomName format: `{appId}/{room}` on domain 8x8.vc.
 * Every JaaS participant receives a server-signed, room-bound JWT.
 */
export function JitsiMeetingEmbed({
  sessionId,
  roomName,
  displayName,
  email,
  startMuted = false,
  endConferenceSignal = 0,
  fill = false,
  onLeave,
  onConferenceJoined,
  onEmergencyZoom,
}: Props) {
  const config = getJitsiConfig();
  const [loadKey, setLoadKey] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [participantCount, setParticipantCount] = useState(0);
  const [jwt, setJwt] = useState<string | undefined>(undefined);
  const [authorizedRoomName, setAuthorizedRoomName] = useState(roomName);
  const [authorizationState, setAuthorizationState] = useState<AuthorizationState>(
    config.requiresJwt ? "loading" : "ready",
  );
  const [authorizationError, setAuthorizationError] = useState<string | null>(null);
  const [embedFailed, setEmbedFailed] = useState(false);
  const mountedRef = useRef(true);
  const apiRef = useRef<{ executeCommand: (command: string, ...args: unknown[]) => void } | null>(
    null,
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setConnectionState("connecting");
    setEmbedFailed(false);
    if (!config.requiresJwt) {
      setJwt(undefined);
      setAuthorizedRoomName(roomName);
      setAuthorizationError(null);
      setAuthorizationState("ready");
      return;
    }
    setJwt(undefined);
    setAuthorizationError(null);
    setAuthorizationState("loading");
    void fetchJaasAuthorization(sessionId, config.jaasAppId)
      .then((authorization) => {
        if (cancelled) return;
        setJwt(authorization.jwt);
        setAuthorizedRoomName(authorization.roomName);
        setAuthorizationState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAuthorizationError(
          error instanceof Error ? error.message : "Impossible d’autoriser la réunion.",
        );
        setAuthorizationState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [config.requiresJwt, config.jaasAppId, sessionId, roomName, loadKey]);

  useEffect(() => {
    if (endConferenceSignal > 0) apiRef.current?.executeCommand("endConference");
  }, [endConferenceSignal]);

  const handleReadyToClose = useCallback(() => {
    setConnectionState("left");
    // Ignore closes caused by React tearing down the iframe (session refetch, nav chrome).
    queueMicrotask(() => {
      if (!mountedRef.current) return;
      onLeave?.();
    });
  }, [onLeave]);

  const handleApiReady = useCallback(
    (api: {
      on: (event: string, listener: (...args: unknown[]) => void) => unknown;
      getNumberOfParticipants: () => number;
      executeCommand: (command: string, ...args: unknown[]) => void;
      getIFrame?: () => HTMLIFrameElement | undefined;
    }) => {
      apiRef.current = api;
      try {
        const iframe = api.getIFrame?.();
        if (iframe) {
          iframe.setAttribute("allow", IFRAME_ALLOW);
          iframe.setAttribute("allowfullscreen", "true");
        }
      } catch {
        // Older API builds may not expose getIFrame.
      }

      const refreshParticipantCount = () => {
        setParticipantCount(api.getNumberOfParticipants());
      };

      api.on("videoConferenceJoined", () => {
        setEmbedFailed(false);
        setConnectionState("joined");
        refreshParticipantCount();
        onConferenceJoined?.();
      });
      api.on("participantJoined", refreshParticipantCount);
      api.on("participantLeft", refreshParticipantCount);
      api.on("videoConferenceLeft", () => {
        setConnectionState("left");
        setParticipantCount(0);
      });
      api.on("conferenceFailed", () => setEmbedFailed(true));
      api.on("connectionFailed", () => setEmbedFailed(true));
    },
    [onConferenceJoined],
  );

  const retryJitsi = () => {
    setEmbedFailed(false);
    setLoadKey((key) => key + 1);
  };

  if (!config.configured) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded-xl border border-border bg-secondary/40 p-8 text-center">
        <div className="max-w-md space-y-3">
          <p className="font-semibold">Impossible de démarrer la réunion Jitsi.</p>
          <p className="text-sm text-muted-foreground">Configuration Jitsi manquante.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {onEmergencyZoom && <Button onClick={onEmergencyZoom}>Réunion d’urgence Zoom</Button>}
            {onLeave && (
              <Button variant="outline" onClick={onLeave}>
                Retour à En direct
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (authorizationState === "loading") {
    return (
      <div className="grid min-h-[400px] place-items-center text-sm text-muted-foreground">
        Préparation de la salle JaaS…
      </div>
    );
  }

  if (authorizationState === "error" || (config.requiresJwt && !jwt) || embedFailed) {
    return (
      <div className="grid min-h-[400px] place-items-center rounded-xl border border-border bg-secondary/40 p-8 text-center">
        <div className="max-w-md space-y-4">
          <p className="font-semibold">Impossible de démarrer la réunion Jitsi.</p>
          <p className="text-sm text-muted-foreground">
            {embedFailed
              ? "La connexion à la salle a échoué."
              : (authorizationError ?? "Autorisation JaaS manquante.")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={retryJitsi}>
              Réessayer
            </Button>
            {onEmergencyZoom && <Button onClick={onEmergencyZoom}>Réunion d’urgence Zoom</Button>}
            {onLeave && (
              <Button variant="outline" onClick={onLeave}>
                Retour à En direct
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const userInfo =
    email && email.trim()
      ? { displayName, email: email.trim() }
      : { displayName, email: `${displayName.replace(/\s+/g, ".").toLowerCase()}@gla.local` };

  return (
    <div className={cn("jitsi-meeting-embed flex h-full min-h-0 flex-col", !fill && "space-y-3")}>
      <div
        className={cn(
          "relative min-h-0 w-full flex-1 overflow-hidden bg-black",
          fill
            ? "h-full rounded-none"
            : "h-[min(78dvh,760px)] rounded-xl border border-border sm:h-[min(82vh,820px)]",
        )}
      >
        <JitsiMeeting
          key={`${authorizedRoomName}-${loadKey}-${jwt ? "jwt" : "guest"}`}
          domain={config.domain}
          roomName={authorizedRoomName}
          {...(jwt ? { jwt } : {})}
          userInfo={userInfo}
          configOverwrite={{
            startWithAudioMuted: startMuted,
            startWithVideoMuted: startMuted,
            startAudioMuted: 5,
            startVideoMuted: 5,
            maxFullResolutionParticipants: 5,
            disableDeepLinking: true,
            enableWelcomePage: false,
            prejoinConfig: { enabled: false },
            toolbarButtons: [
              "microphone",
              "camera",
              "desktop",
              "chat",
              "raisehand",
              "tileview",
              "participants-pane",
              "hangup",
            ],
          }}
          interfaceConfigOverwrite={{
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
            MOBILE_APP_PROMO: false,
            DISABLE_FOCUS_INDICATOR: true,
          }}
          onApiReady={handleApiReady}
          onReadyToClose={handleReadyToClose}
          getIFrameRef={(parentNode) => {
            const node = parentNode as HTMLElement;
            node.style.height = "100%";
            node.style.width = "100%";
            node.style.border = "0";
            ensureIframePermissions(node);
          }}
          spinner={() => (
            <div className="grid h-full min-h-[400px] place-items-center text-sm text-muted-foreground">
              Connexion à la salle…
            </div>
          )}
        />
      </div>
      {!fill ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium ${
                connectionState === "joined"
                  ? "bg-success-soft text-success"
                  : connectionState === "left"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-warning-soft text-warning-foreground"
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {connectionState === "joined"
                ? "Connecté"
                : connectionState === "left"
                  ? "Déconnecté"
                  : "Connexion…"}
            </span>
            {connectionState === "joined" && (
              <span>
                {participantCount} participant{participantCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={retryJitsi}>
              Réessayer
            </Button>
            {onEmergencyZoom && (
              <Button size="sm" variant="outline" onClick={onEmergencyZoom}>
                Réunion d’urgence Zoom
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setShowHelp((v) => !v)}>
              {showHelp ? "Masquer l’aide" : "Aide"}
            </Button>
          </div>
        </div>
      ) : null}
      {showHelp && !fill ? (
        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          Autorisez micro/caméra. Utilisez « Agrandir » / « Masquer menu » / « Fermer » au-dessus de
          la vidéo pour contrôler la réunion.
        </div>
      ) : null}
    </div>
  );
}
