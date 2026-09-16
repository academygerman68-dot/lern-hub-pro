import { useCallback, useState } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { Button } from "@/components/ui/button";
import { getJitsiConfig } from "@/lib/jitsi-config";

type Props = {
  roomName: string;
  displayName: string;
  email?: string;
  onLeave?: () => void;
  onConferenceJoined?: () => void;
};

type ConnectionState = "connecting" | "joined" | "left";

/**
 * Real Jitsi Meet embed via official @jitsi/react-sdk.
 * Same roomName + domain = same conference for all participants.
 */
export function JitsiMeetingEmbed({
  roomName,
  displayName,
  email,
  onLeave,
  onConferenceJoined,
}: Props) {
  const config = getJitsiConfig();
  const [loadKey, setLoadKey] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [participantCount, setParticipantCount] = useState(0);

  const handleReadyToClose = useCallback(() => {
    setConnectionState("left");
    onLeave?.();
  }, [onLeave]);

  const handleApiReady = useCallback(
    (api: {
      on: (event: string, listener: () => void) => unknown;
      getNumberOfParticipants: () => number;
    }) => {
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
          <p className="font-semibold">Unable to join the meeting</p>
          <p className="text-sm text-muted-foreground">Jitsi configuration missing.</p>
          {onLeave && (
            <Button variant="outline" onClick={onLeave}>
              Back to sessions
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (config.requiresJwt) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded-xl border border-border bg-secondary/40 p-8 text-center">
        <div className="max-w-md space-y-3">
          <p className="font-semibold">Unable to join the meeting</p>
          <p className="text-sm text-muted-foreground">
            {config.reasonIfUnavailable ??
              "JaaS requires a server-issued JWT. Do not put private keys in VITE_."}
          </p>
          <p className="text-xs text-muted-foreground">
            For an immediate real meeting without JaaS, unset VITE_JAAS_APP_ID and use meet.jit.si.
          </p>
          {onLeave && (
            <Button variant="outline" onClick={onLeave}>
              Back to sessions
            </Button>
          )}
        </div>
      </div>
    );
  }

  const userInfo =
    email && email.trim()
      ? { displayName, email: email.trim() }
      : { displayName, email: `${displayName.replace(/\s+/g, ".").toLowerCase()}@gla.local` };
  const directMeetingUrl = `https://${config.domain}/${encodeURIComponent(roomName)}`;

  return (
    <div className="space-y-3">
      <div className="h-[min(70dvh,640px)] w-full overflow-hidden rounded-xl border border-border bg-black sm:h-[min(78vh,720px)]">
        <JitsiMeeting
          key={`${roomName}-${loadKey}`}
          domain={config.domain}
          roomName={roomName}
          userInfo={userInfo}
          configOverwrite={{
            prejoinPageEnabled: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
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
              Connecting to meeting room…
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
          <span>Chat et partage d’écran disponibles dans la barre Jitsi.</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={directMeetingUrl} target="_blank" rel="noreferrer">
              Ouvrir Jitsi dans un nouvel onglet
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLoadKey((k) => k + 1)}>
            Retry
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowHelp((v) => !v)}>
            {showHelp ? "Hide help" : "Help"}
          </Button>
        </div>
      </div>
      {showHelp && (
        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          If audio/video is blocked: check the browser permission icon in the address bar. Both
          accounts must join the same room name on {config.domain}. Screen sharing requires the
          browser share-screen prompt.
        </div>
      )}
    </div>
  );
}
