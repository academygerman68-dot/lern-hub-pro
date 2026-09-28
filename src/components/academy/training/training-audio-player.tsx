import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Headphones, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  interpretPlayRejection,
  isMediaReadyEnough,
  mapAudioFailureToMessage,
  playButtonAriaLabel,
  reduceAudioLifecycleEvent,
  shouldEnablePlayButton,
  trainingAudioStatusLabel,
  type TrainingAudioUiStatus,
} from "@/lib/training-audio-player";

type Props = {
  url: string;
  playerKey: string;
  expectedDuration?: number;
};

/**
 * Shared training Hören player: wait until the media is ready before enabling
 * Lecture, handle play() rejections, and offer a single user-driven retry.
 */
export function TrainingAudioPlayer({ url, playerKey, expectedDuration }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);
  const intentionalStopRef = useRef(false);
  const playGenerationRef = useRef(0);
  const statusRef = useRef<TrainingAudioUiStatus>("loading");

  const [status, setStatus] = useState<TrainingAudioUiStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const statusId = useId();

  const updateStatus = useCallback((next: TrainingAudioUiStatus) => {
    statusRef.current = next;
    if (mountedRef.current) setStatus(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    playGenerationRef.current += 1;
    intentionalStopRef.current = true;
    el.pause();
    intentionalStopRef.current = false;

    updateStatus("loading");
    if (mountedRef.current) {
      setErrorMessage(null);
      setDuration(null);
    }

    const applyEvent = (event: Parameters<typeof reduceAudioLifecycleEvent>[1]) => {
      const next = reduceAudioLifecycleEvent(statusRef.current, event);
      updateStatus(next);
      if (event === "error" && mountedRef.current) {
        setErrorMessage(
          mapAudioFailureToMessage({
            mediaErrorCode: el.error?.code ?? null,
            readyState: el.readyState,
          }),
        );
      }
      if ((event === "canplay" || event === "canplaythrough") && mountedRef.current) {
        setErrorMessage(null);
      }
    };

    const onLoadStart = () => applyEvent("loadstart");
    const onLoadedMetadata = () => {
      const d = el.duration;
      if (mountedRef.current && d && Number.isFinite(d)) setDuration(d);
      applyEvent("loadedmetadata");
      if (isMediaReadyEnough(el.readyState)) applyEvent("canplay");
    };
    const onCanPlay = () => applyEvent("canplay");
    const onCanPlayThrough = () => applyEvent("canplaythrough");
    const onPlaying = () => applyEvent("playing");
    const onPause = () => applyEvent("pause");
    const onEnded = () => applyEvent("ended");
    const onWaiting = () => applyEvent("waiting");
    const onStalled = () => applyEvent("stalled");
    const onError = () => applyEvent("error");

    el.addEventListener("loadstart", onLoadStart);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("canplaythrough", onCanPlayThrough);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("stalled", onStalled);
    el.addEventListener("error", onError);

    // Always reassign: getAttribute("src") may be absolute after the first load.
    el.src = url;
    el.load();

    // Cached / already-ready sources (common on H01→H02 same file).
    if (isMediaReadyEnough(el.readyState)) {
      applyEvent("canplay");
      const d = el.duration;
      if (mountedRef.current && d && Number.isFinite(d)) setDuration(d);
    }

    return () => {
      intentionalStopRef.current = true;
      playGenerationRef.current += 1;
      el.pause();
      el.removeEventListener("loadstart", onLoadStart);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("canplaythrough", onCanPlayThrough);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("stalled", onStalled);
      el.removeEventListener("error", onError);
    };
  }, [playerKey, url, updateStatus]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;

    if (statusRef.current === "playing") {
      intentionalStopRef.current = true;
      el.pause();
      intentionalStopRef.current = false;
      updateStatus("paused");
      return;
    }

    if (!shouldEnablePlayButton(statusRef.current)) return;
    if (!isMediaReadyEnough(el.readyState)) {
      updateStatus("loading");
      if (mountedRef.current) {
        setErrorMessage(
          mapAudioFailureToMessage({
            playRejection: { name: "NotSupportedError" },
            readyState: el.readyState,
          }),
        );
      }
      return;
    }

    const generation = ++playGenerationRef.current;
    try {
      await el.play();
      if (!mountedRef.current || generation !== playGenerationRef.current) return;
      updateStatus("playing");
      if (mountedRef.current) setErrorMessage(null);
    } catch (err) {
      if (!mountedRef.current || generation !== playGenerationRef.current) return;
      const rejection: { name: string; message?: string } = {
        name: err instanceof DOMException || err instanceof Error ? err.name : "Error",
      };
      if (err instanceof Error && err.message) rejection.message = err.message;
      const interpreted = interpretPlayRejection({
        rejection,
        readyState: el.readyState,
        intentionalStop: intentionalStopRef.current,
      });
      if (interpreted.ignore) return;
      updateStatus(interpreted.nextStatus);
      if (mountedRef.current) setErrorMessage(interpreted.message);
    }
  };

  const retryLoad = () => {
    const el = audioRef.current;
    if (!el) return;
    playGenerationRef.current += 1;
    intentionalStopRef.current = true;
    el.pause();
    intentionalStopRef.current = false;
    updateStatus("loading");
    if (mountedRef.current) setErrorMessage(null);
    // Controlled reload of the same source — one user gesture, no auto loop.
    el.src = url;
    el.load();
  };

  const playEnabled = shouldEnablePlayButton(status);
  const label = trainingAudioStatusLabel(status);

  return (
    <div className="rounded-xl border border-dashed border-border p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <Headphones className="size-4" aria-hidden />
        Audio Hören
        {duration != null ? (
          <span className="text-xs font-normal text-muted-foreground">
            · {Math.round(duration)} s
          </span>
        ) : expectedDuration ? (
          <span className="text-xs font-normal text-muted-foreground">
            · ≈ {expectedDuration} s
          </span>
        ) : null}
      </div>

      <audio ref={audioRef} className="sr-only" preload="auto" playsInline aria-hidden />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-11 min-w-11"
          disabled={!playEnabled}
          aria-disabled={!playEnabled}
          aria-describedby={statusId}
          aria-label={playButtonAriaLabel(status)}
          onClick={() => {
            void togglePlay();
          }}
        >
          {status === "playing" ? <Pause className="size-4" /> : <Play className="size-4" />}
          <span className="ml-1 sm:inline">{status === "playing" ? "Pause" : "Lecture"}</span>
        </Button>

        {status === "error" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            aria-label="Réessayer le chargement audio"
            onClick={retryLoad}
          >
            <RotateCcw className="mr-1 size-4" aria-hidden />
            Réessayer
          </Button>
        ) : null}
      </div>

      <p
        id={statusId}
        className="mt-2 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {status === "loading" ? "Chargement de l’audio…" : label}
      </p>

      {errorMessage && (status === "error" || status === "loading") ? (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
