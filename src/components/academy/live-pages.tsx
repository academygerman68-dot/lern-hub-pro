import { useEffect, useMemo, useRef, useState } from "react";
import { JaaSMeeting } from "@jitsi/react-sdk";
import { AlertCircle, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClasses } from "@/hooks/use-academy-data";
import {
  clearLiveClassId,
  getLiveClassId,
  setLiveClassId,
  useJaasMeeting,
} from "@/hooks/use-jaas-meeting";
import { JaasServiceError } from "@/services/supabase/jaas-service";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import { PageHeader, Status, Surface } from "./primitives";

function errorMessage(error: Error | null): string {
  if (!error) return "Unable to join the live class.";
  if (error instanceof JaasServiceError) {
    switch (error.code) {
      case "UNAUTHORIZED":
        return "Your session expired. Please sign in again.";
      case "FORBIDDEN":
      case "NOT_ENROLLED":
      case "NOT_CLASS_TEACHER":
      case "ACADEMIC_ACCESS_DENIED":
        return "You are not allowed to join this class.";
      case "CLASS_NOT_FOUND":
      case "NOT_FOUND":
        return "This class was not found.";
      case "CLASS_NOT_LIVE_ELIGIBLE":
        return "This class is not available for live sessions.";
      case "CLASS_ID_REQUIRED":
      case "INVALID_REQUEST":
        return "Invalid class selection.";
      case "SERVER_MISCONFIGURED":
      case "SERVER_ERROR":
        return "Live service is temporarily unavailable.";
      default:
        return error.message || "Unable to join the live class.";
    }
  }
  return error.message || "Unable to join the live class.";
}

export function LiveClassesPage({ meeting }: { meeting: boolean }) {
  if (meeting) return <LiveMeetingRoom />;
  return <LiveClassLobby />;
}

function LiveClassLobby() {
  const { navigate } = useAcademy();
  const classesQuery = useClasses();
  const liveEligible = useMemo(
    () =>
      (classesQuery.data ?? []).filter(
        (item) => item.status === "active" || item.status === "planned",
      ),
    [classesQuery.data],
  );

  return (
    <>
      <PageHeader
        title="Live Classes"
        subtitle="Join an authorized class room. Access is validated by the academy backend."
      />
      <QueryState
        isLoading={classesQuery.isLoading}
        isError={classesQuery.isError}
        error={classesQuery.error}
        isEmpty={liveEligible.length === 0}
        emptyTitle="No live classes available"
        emptyMessage="When you are enrolled in (or assigned to) an active class, it will appear here."
        onRetry={() => void classesQuery.refetch()}
      >
        <div className="space-y-3">
          {liveEligible.map((item) => (
            <Surface className="p-5" key={item.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="grid size-12 place-items-center rounded-lg bg-secondary text-primary">
                  <Video className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">{item.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.level} · {item.schedule || "Schedule TBD"} · {item.teacher || "Teacher TBD"}
                  </p>
                </div>
                <Status tone={item.status === "active" ? "green" : "amber"}>{item.status}</Status>
                <Button
                  onClick={() => {
                    setLiveClassId(item.id);
                    navigate("meeting");
                  }}
                >
                  <Video className="size-4" />
                  Rejoindre le cours
                </Button>
              </div>
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}

function LiveMeetingRoom() {
  const { navigate } = useAcademy();
  const [classId, setClassId] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const apiRef = useRef<{ dispose?: () => void } | null>(null);
  const { tokenPayload, loading, error, retry } = useJaasMeeting(classId);

  useEffect(() => {
    setClassId(getLiveClassId());
    setClientReady(true);
  }, []);

  useEffect(() => {
    return () => {
      try {
        apiRef.current?.dispose?.();
      } catch {
        // ignore dispose errors on unmount
      }
      apiRef.current = null;
    };
  }, []);

  const leave = () => {
    try {
      apiRef.current?.dispose?.();
    } catch {
      // ignore
    }
    apiRef.current = null;
    clearLiveClassId();
    navigate("live");
  };

  if (!clientReady) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!classId) {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <AlertCircle className="mx-auto size-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No class selected</h2>
        <p className="text-sm text-muted-foreground">Choose a class from the live lobby first.</p>
        <Button onClick={() => navigate("live")}>Back to live classes</Button>
      </Surface>
    );
  }

  if (loading && !tokenPayload) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Connecting to secure classroom…</p>
        </div>
      </div>
    );
  }

  if (error || !tokenPayload) {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <AlertCircle className="mx-auto size-8 text-alert" />
        <h2 className="text-lg font-semibold">Unable to join</h2>
        <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate("live")}>
            Back
          </Button>
          <Button onClick={retry}>Try again</Button>
        </div>
      </Surface>
    );
  }

  return (
    <div className="-m-4 flex min-h-[calc(100vh-4.25rem)] flex-col bg-[#0B1220] text-white sm:-m-7">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-white/55 uppercase">
            Live · {tokenPayload.moderator ? "Moderator" : "Participant"}
          </p>
          <h1 className="truncate text-lg font-semibold">{tokenPayload.className}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Status tone="green">Connected</Status>
          <Button variant="destructive" size="sm" onClick={leave}>
            Leave meeting
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <JaaSMeeting
          key={`${tokenPayload.classId}:${tokenPayload.roomName}`}
          appId={tokenPayload.appId}
          roomName={tokenPayload.roomName}
          jwt={tokenPayload.token}
          getIFrameRef={(parentNode) => {
            parentNode.style.height = "100%";
            parentNode.style.width = "100%";
            parentNode.style.minHeight = "70vh";
          }}
          configOverwrite={{
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableDeepLinking: true,
            prejoinConfig: { enabled: false },
            toolbarButtons: [
              "microphone",
              "camera",
              "desktop",
              "chat",
              "participants-pane",
              "tileview",
              "fullscreen",
              "hangup",
              "settings",
            ],
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
          }}
          onApiReady={(externalApi) => {
            apiRef.current = externalApi as { dispose?: () => void };
          }}
          onReadyToClose={leave}
        />
      </div>
    </div>
  );
}
