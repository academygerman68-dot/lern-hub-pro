import { useCallback, useEffect, useRef, useState } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { Button } from "@/components/ui/button";
import { getJitsiConfig } from "@/lib/jitsi-config";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type Props = {
  roomName: string;
  displayName: string;
  email?: string;
  startMuted?: boolean;
  endConferenceSignal?: number;
  onLeave?: () => void;
  onConferenceJoined?: () => void;
};

type ConnectionState = "connecting" | "joined" | "left";

async function tryFetchJaasJwt(roomName: string): Promise<string | undefined> {
  if (!isSupabaseConfigured) return undefined;
  try {
    const { data, error } = await getSupabase().functions.invoke<{
      jwt?: string | null;
      configured?: boolean;
    }>("jaas-token", { body: { roomName } });
    if (error || !data?.jwt) return undefined;
    return data.jwt;
  } catch {
    return undefined;
  }
}

/**
 * Real Jitsi / JaaS embed via @jitsi/react-sdk.
 * JaaS roomName format: `{appId}/{room}` on domain 8x8.vc.
 * JWT is optional for basic join; Edge Function may supply it for premium features.
 */
export function JitsiMeetingEmbed({
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
  const [jwtReady, setJwtReady] = useState(!config.jwtOptional);
  const apiRef = useRef<{ executeCommand: (command: string, ...args: unknown[]) => void } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!config.jwtOptional) {
      setJwtReady(true);
      return;
    }
    setJwtReady(false);
    void tryFetchJaasJwt(roomName).then((token) => {
      if (cancelled) return;
      setJwt(token);
      setJwtReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [config.jwtOptional, roomName, loadKey]);

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

  if (!jwtReady) {
    return (
      <div className="grid min-h-[400px] place-items-center text-sm text-muted-foreground">
        Préparation de la salle JaaS…
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
          key={`${roomName}-${loadKey}-${jwt ? "jwt" : "guest"}`}
          domain={config.domain}
          roomName={roomName}
          {...(jwt ? { jwt } : {})}
          userInfo={userInfo}
          configOverwrite={{
            prejoinPageEnabled: true,
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
            {!jwt && config.jwtOptional
              ? " JWT non fourni (enregistrement premium indisponible)."
              : ""}
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
          salle sur {config.domain}. Pour l’enregistrement JaaS, déployez l’Edge Function
          `jaas-token` avec JAAS_KEY_ID / JAAS_PRIVATE_KEY (jamais en VITE_*).
        </div>
      )}
    </div>
  );
}
