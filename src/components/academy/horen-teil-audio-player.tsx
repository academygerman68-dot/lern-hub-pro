import { useEffect, useRef, useState } from "react";
import { Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  playerKey: string;
  audioUrl: string | null;
  teil: number | null;
  /** Max plays allowed in exam-blanc mode (1 = no replay after end). */
  playbackCount: number | null;
  /** When true, pause/seek/replay are restricted after the allowed plays. */
  strictExamMode: boolean;
  disabled?: boolean;
  onReload?: () => void;
  reloading?: boolean;
};

/**
 * One logical Hören player per Teil. Remounts only when `playerKey` changes
 * (Teil / track), so navigating questions inside the same Teil keeps playback.
 */
export function HorenTeilAudioPlayer({
  playerKey,
  audioUrl,
  teil,
  playbackCount,
  strictExamMode,
  disabled,
  onReload,
  reloading,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [finished, setFinished] = useState(false);
  const playsFinishedRef = useRef(0);

  useEffect(() => {
    setLoadError(false);
    setFinished(false);
    playsFinishedRef.current = 0;
  }, [playerKey, audioUrl]);

  const maxPlays = playbackCount != null && playbackCount > 0 ? playbackCount : null;
  const lockAfterEnd = strictExamMode && maxPlays != null && finished;

  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Headphones className="size-4" aria-hidden />
        Audio{teil != null ? ` · Teil ${teil}` : ""}
        {strictExamMode && maxPlays === 1 ? (
          <span className="text-xs font-normal text-muted-foreground">(1 écoute)</span>
        ) : null}
        {strictExamMode && maxPlays === 2 ? (
          <span className="text-xs font-normal text-muted-foreground">(dans la piste)</span>
        ) : null}
      </div>
      {audioUrl ? (
        <div className="mt-3 space-y-2">
          <audio
            key={playerKey}
            ref={audioRef}
            className="w-full"
            controls={!lockAfterEnd}
            controlsList={strictExamMode ? "nodownload noplaybackrate" : "nodownload"}
            src={audioUrl}
            preload="metadata"
            onError={() => setLoadError(true)}
            onEnded={() => {
              playsFinishedRef.current += 1;
              if (strictExamMode && maxPlays != null && playsFinishedRef.current >= 1) {
                // Track already contains repetitions for Teil 1/3; one full play = done.
                setFinished(true);
                const el = audioRef.current;
                if (el) {
                  el.pause();
                  el.currentTime = el.duration || 0;
                }
              }
            }}
            onPlay={(e) => {
              if (lockAfterEnd) {
                e.currentTarget.pause();
              }
            }}
          >
            Votre navigateur ne prend pas en charge l’audio.
          </audio>
          {loadError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
              Impossible de charger la piste audio. Vérifiez votre connexion ou rechargez.
            </p>
          ) : null}
          {lockAfterEnd ? (
            <p className="text-xs text-muted-foreground">
              Écoute terminée pour ce Teil (mode examen blanc).
            </p>
          ) : null}
          {onReload ? (
            <Button
              size="sm"
              variant="outline"
              disabled={reloading || disabled || (strictExamMode && finished)}
              onClick={onReload}
            >
              {reloading ? "Actualisation…" : "Recharger l’audio"}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="font-medium">Audio Hören indisponible</p>
          <p className="mt-1 text-destructive/90">
            Aucun fichier audio n’est associé à cette partie. Contactez votre professeur.
          </p>
          {onReload ? (
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              disabled={reloading || disabled}
              onClick={onReload}
            >
              Réessayer
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
