import { useEffect, useRef, useState } from "react";
import { Headphones, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "./primitives";

const TRACKS = [
  { part: 1, url: "/exam-media/a1-sim-01/hoeren-teil-1.mp3", label: "Hören Teil 1" },
  { part: 2, url: "/exam-media/a1-sim-01/hoeren-teil-2.mp3", label: "Hören Teil 2" },
  { part: 3, url: "/exam-media/a1-sim-01/hoeren-teil-3.mp3", label: "Hören Teil 3" },
] as const;

type TrackStatus = "pending" | "ok" | "error";

type Props = {
  examTitle: string;
  testAudioUrl: string;
  writtenMinutes: number;
  speakingMinutes?: number | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Presentation + headset/volume/mic check before the written exam clock starts. */
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
  const [trackStatus, setTrackStatus] = useState<Record<number, TrackStatus>>({
    1: "pending",
    2: "pending",
    3: "pending",
  });
  const [micState, setMicState] = useState<"idle" | "ok" | "denied" | "unsupported">("idle");

  useEffect(() => {
    let cancelled = false;
    // Prefer fetch over parallel Audio() loaders: sharing the same URL as the
    // headset <audio> can abort one request and false-fail Teil 1 readiness.
    void (async () => {
      for (const track of TRACKS) {
        try {
          const res = await fetch(track.url, { method: "HEAD", cache: "no-cache" });
          if (cancelled) return;
          setTrackStatus((prev) => ({
            ...prev,
            [track.part]: res.ok ? "ok" : "error",
          }));
        } catch {
          if (cancelled) return;
          setTrackStatus((prev) => ({ ...prev, [track.part]: "error" }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tracksReady = TRACKS.every((t) => trackStatus[t.part] === "ok");
  const tracksFailed = TRACKS.some((t) => trackStatus[t.part] === "error");

  async function checkMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicState("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicState("ok");
    } catch {
      setMicState("denied");
    }
  }

  return (
    <Surface className="mx-auto max-w-xl space-y-5 p-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          A1 · Simulation complète
        </p>
        <h2 className="mt-1 text-xl font-semibold">{examTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Simulation indépendante A1 adultes — non affiliée au Goethe-Institut. Objectif :
          s’entraîner sur les quatre compétences dans des conditions proches de l’examen.
        </p>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {[
          ["Hören", "15 pts · compréhension orale"],
          ["Lesen", "15 pts · compréhension écrite"],
          ["Schreiben", "15 pts · production écrite"],
          ["Sprechen", "15 pts · oral enregistré"],
        ].map(([title, detail]) => (
          <div key={title} className="rounded-md border px-3 py-2">
            <p className="font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>

      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          Écrit : chronomètre de <strong className="text-foreground">{writtenMinutes} min</strong>{" "}
          (Hören + Lesen + Schreiben) — démarre uniquement après confirmation ci-dessous.
        </li>
        <li>
          Oral :{" "}
          <strong className="text-foreground">
            entraînement enregistré (~{speakingMinutes ?? 15} min)
          </strong>
          , à faire dans l’appli (pas un oral en binôme live).
        </li>
        <li>Matériel : casque recommandé, micro pour Sprechen, connexion stable.</li>
        <li>
          Remise : une confirmation explicite verrouille la tentative ; le résultat définitif
          attend la correction manuelle de Schreiben / Sprechen.
        </li>
      </ul>

      <div className="space-y-2 rounded-md border border-dashed p-4">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Headphones className="size-4" aria-hidden />
          Test casque / volume
        </div>
        <p className="text-sm text-muted-foreground">
          Utilisez un casque si possible. Lancez le test au moins une fois.
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
        <ul className="space-y-1 text-xs text-muted-foreground">
          {TRACKS.map((track) => (
            <li key={track.part}>
              {track.label} :{" "}
              {trackStatus[track.part] === "ok"
                ? "prêt"
                : trackStatus[track.part] === "error"
                  ? "échec de chargement"
                  : "vérification…"}
            </li>
          ))}
        </ul>
        {tracksFailed ? (
          <p className="text-sm text-destructive">
            Une ou plusieurs pistes Hören ne répondent pas. Vérifiez le déploiement des fichiers
            MP3.
          </p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-md border border-dashed p-4">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Mic className="size-4" aria-hidden />
          Microphone (Sprechen)
        </div>
        <p className="text-sm text-muted-foreground">
          Autorisez le micro pour l’enregistrement oral. En cas de refus, vous pourrez toujours
          passer l’écrit ; l’oral pourra être traité en présentiel si prévu par votre professeur.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void checkMicrophone()}>
          Tester le microphone
        </Button>
        {micState === "ok" ? (
          <p className="text-xs text-muted-foreground">Microphone autorisé.</p>
        ) : null}
        {micState === "denied" ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Permission refusée. Vous pourrez démarrer l’écrit ; réglez le micro dans les paramètres
            du navigateur pour Sprechen.
          </p>
        ) : null}
        {micState === "unsupported" ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Enregistrement non supporté sur cet appareil. L’écrit reste disponible.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="button"
          disabled={busy || error || !played || tracksFailed || !tracksReady}
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
      {played && !tracksReady && !tracksFailed ? (
        <p className="text-xs text-muted-foreground">Vérification des trois pistes Hören…</p>
      ) : null}
    </Surface>
  );
}
