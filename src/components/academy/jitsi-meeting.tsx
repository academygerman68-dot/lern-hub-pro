import { useCallback, useEffect, useRef, useState } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { Button } from "@/components/ui/button";
import { getJitsiConfig } from "@/lib/jitsi-config";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type Props = {
  sessionId: string;
  roomName: string;
  displayName: string;
  email?: string;
  startMuted?: boolean;
  endConferenceSignal?: number;
  onLeave?: () => void;
  onConferenceJoined?: () => void;
};

type ConnectionState = "connecting" | "joined" | "left";
type AuthorizationState = "loading" | "ready" | "error";

const tokenErrors: Record<string, string> = {
  JAAS_NOT_CONFIGURED: "Les secrets JaaS ne sont pas encore configurés dans Supabase.",
  JAAS_SIGNING_FAILED: "La clé privée JaaS configurée dans Supabase est invalide.",
  SESSION_ACCESS_DENIED: "Vous n’êtes pas autorisé à rejoindre cette séance.",
  SESSION_CLOSED: "Cette séance est terminée ou annulée.",
  SESSION_TOO_EARLY: "La salle ouvre 15 minutes avant le début de la séance.",
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
      if (body.error && tokenErrors[body.error]) return tokenErrors[body.error];
      if (body.message) return body.message;
    } catch {
      // Fall through to the safe generic message.
    }
  }
  return "Impossible d’autoriser l’accès à la réunion. Vérifiez la fonction jaas-token.";
}

async function fetchJaasAuthorization(
  sessionId: string,
): Promise<{ jwt: string; roomName: string }> {
  if (!isSupabaseConfigured) throw new Error("Supabase n’est pas configuré.");
  const { data, error } = await getSupabase().functions.invoke<{
    jwt?: string;
    roomName?: string;
  }>("jaas-token", { body: { sessionId } });
  if (error) throw new Error(await readFunctionError(error));
  if (!data?.jwt || !data.roomName) {
    throw new Error("La fonction jaas-token n’a pas renvoyé une autorisation valide.");
  }
  return { jwt: data.jwt, roomName: data.roomName };
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
  onLeave,
  onConferenceJoined,
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
  const apiRef = useRef<{ executeCommand: (command: string, ...args: unknown[]) => void } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setConnectionState("connecting");
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
    void fetchJaasAuthorization(sessionId)
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
  }, [config.requiresJwt, sessionId, roomName, loadKey]);

  useEffect(() => {
    if (endConferenceSignal > 0) apiRef.current?.executeCommand("endConference");
  }, [endConferenceSignal]);

  const handleReadyToClose = useCallback(() => {
    setConnectionState("left");
    onLeave?.();
  }, [onLeave]);

  const handleApiReady = useCallback(
    (api: {
      on: (event: string, listener: () => void) => unknown;
      getNumberOfParticipants: () => number;
      executeCommand: (command: string, ...args: unknown[]) => void;
    }) => {
      apiRef.current = api;
      const refreshParticipantCount = () => {
        setParticipantCount(api.getNumberOfParticipants());
      };

      api.on("videoConferenceJoined", () => {
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
    },
    [onConferenceJoined],
  );

  if (!config.configured) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded-xl border border-border bg-secondary/40 p-8 text-center">
        <div className="max-w-md space-y-3">
          <p className="font-semibold">Impossible de rejoindre la réunion</p>
          <p className="text-sm text-muted-foreground">Configuration Jitsi manquante.</p>
          {onLeave && (
            <Button variant="outline" onClick={onLeave}>
              Retour aux séances
            </Button>
          )}
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

  if (authorizationState === "error" || (config.requiresJwt && !jwt)) {
    return (
      <div className="grid min-h-[400px] place-items-center rounded-xl border border-border bg-secondary/40 p-8 text-center">
        <div className="max-w-md space-y-4">
          <p className="font-semibold">Impossible de rejoindre la réunion</p>
          <p className="text-sm text-muted-foreground">
            {authorizationError ?? "Autorisation JaaS manquante."}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setLoadKey((key) => key + 1)}>
              Réessayer
            </Button>
            {onLeave && <Button onClick={onLeave}>Retour aux séances</Button>}
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
    <div className="space-y-3">
      <div className="h-[min(70dvh,640px)] w-full overflow-hidden rounded-xl border border-border bg-black sm:h-[min(78vh,720px)]">
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
          }}
          onApiReady={handleApiReady}
          onReadyToClose={handleReadyToClose}
          getIFrameRef={(parentNode) => {
            parentNode.style.height = "100%";
            parentNode.style.width = "100%";
            parentNode.style.border = "0";
          }}
          spinner={() => (
            <div className="grid h-full min-h-[400px] place-items-center text-sm text-muted-foreground">
              Connexion à la salle…
            </div>
          )}
        />
      </div>
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
          <span>
            {config.provider === "jaas" ? "JaaS 8x8.vc" : config.domain} · chat et partage d’écran
            disponibles.
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setLoadKey((k) => k + 1)}>
            Réessayer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowHelp((v) => !v)}>
            {showHelp ? "Masquer l’aide" : "Aide"}
          </Button>
        </div>
      </div>
      {showHelp && (
        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          Autorisez micro/caméra dans le navigateur. Tous les participants doivent rejoindre la même
          salle sur {config.domain}. L’accès JaaS est vérifié par votre compte et un jeton
          temporaire généré côté serveur.
        </div>
      )}
    </div>
  );
}
