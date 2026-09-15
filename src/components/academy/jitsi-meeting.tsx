import { useCallback, useState } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { Button } from "@/components/ui/button";
import { getJitsiConfig } from "@/lib/jitsi-config";

type Props = {
  roomName: string;
  displayName: string;
  email?: string;
  onLeave?: () => void;
};

/**
 * Real Jitsi Meet embed via official @jitsi/react-sdk.
 * Same roomName + domain = same conference for all participants.
 */
export function JitsiMeetingEmbed({ roomName, displayName, email, onLeave }: Props) {
  const config = getJitsiConfig();
  const [loadKey, setLoadKey] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const handleReadyToClose = useCallback(() => {
    onLeave?.();
  }, [onLeave]);

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

  return (
    <div className="space-y-3">
      <div className="h-[min(78vh,720px)] w-full overflow-hidden rounded-xl border border-border bg-black">
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
        <p>
          Allow camera & microphone when the browser asks. Use Hang up inside Jitsi or Leave meeting
          above.
        </p>
        <div className="flex gap-2">
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
