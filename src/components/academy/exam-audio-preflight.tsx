import { useRef, useState } from "react";
import { Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "./primitives";

type Props = {
  examTitle: string;
  testAudioUrl: string;
  writtenMinutes: number;
  speakingMinutes?: number | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Headset/volume check before the written exam clock starts. */
export function ExamAudioPreflight({
  examTitle,
  testAudioUrl,
  writtenMinutes,
  speakingMinutes,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [played, setPlayed] = useState(false);
  const [error, setError] = useState(false);

  return (
    <Surface className="mx-auto max-w-lg space-y-4 p-6">
      <div className="flex items-center gap-2 text-foreground">
        <Headphones className="size-5" aria-hidden />
        <h2 className="text-lg font-semibold">Test casque / volume</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Avant de démarrer « {examTitle} », vérifiez que vous entendez bien l’audio. Le chronomètre
        écrit ({writtenMinutes} min) ne démarre qu’après confirmation.
        {speakingMinutes
          ? ` L’oral enregistré est prévu à part (~${speakingMinutes} min).`
          : null}
      </p>
      <audio
        ref={audioRef}
        className="w-full"
        controls
        src={testAudioUrl}
        preload="metadata"
        onPlay={() => setPlayed(true)}
        onError={() => setError(true)}
      />
      {error ? (
        <p className="text-sm text-destructive">
          Impossible de lire le test audio. Vérifiez vos haut-parleurs ou casque.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="button"
          disabled={busy || error || !played}
          onClick={onConfirm}
        >
          {busy ? "Démarrage…" : "Démarrer l’écrit"}
        </Button>
      </div>
      {!played && !error ? (
        <p className="text-xs text-muted-foreground">
          Lancez le test audio au moins une fois pour activer le démarrage.
        </p>
      ) : null}
    </Surface>
  );
}
