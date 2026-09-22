import { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { validateOralAnswerAudioFile } from "@/lib/exam-oral";

type ExamOralAnswerComposerProps = {
  disabled?: boolean;
  hasAudio: boolean;
  previewUrl: string | null;
  uploading?: boolean;
  onUpload: (file: File) => void | Promise<void>;
};

export function ExamOralAnswerComposer({
  disabled,
  hasAudio,
  previewUrl,
  uploading,
  onUpload,
}: ExamOralAnswerComposerProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    if (disabled || uploading || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Enregistrement non supporté sur cet appareil. Utilisez l’import audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : undefined;
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stopTracks();
        setRecording(false);
        const file = new File([blob], `sprechen-${Date.now()}.webm`, {
          type: blob.type || "audio/webm",
        });
        const err = validateOralAnswerAudioFile(file);
        if (err) {
          toast.error(err);
          return;
        }
        void Promise.resolve(onUpload(file)).catch((uploadErr) => {
          toast.error(uploadErr instanceof Error ? uploadErr.message : "Dépôt impossible");
        });
      };
      mediaRecorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      recorder.start();
    } catch {
      stopTracks();
      toast.error("Micro inaccessible. Autorisez le micro ou importez un fichier.");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setRecording(false);
      stopTracks();
      return;
    }
    recorder.stop();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Enregistrez votre réponse orale ou importez un fichier audio (WebM, MP3, WAV, M4A — max 25
        Mo). Stockage privé.
      </p>
      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <Button type="button" variant="outline" disabled={disabled || uploading} onClick={() => void startRecording()}>
            <Mic className="size-4" />
            Enregistrer
          </Button>
        ) : (
          <Button type="button" variant="destructive" onClick={stopRecording}>
            <Square className="size-4" />
            Stop ({String(Math.floor(seconds / 60)).padStart(2, "0")}:
            {String(seconds % 60).padStart(2, "0")})
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={disabled || uploading || recording}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" />
          Importer
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/webm,audio/ogg,audio/mpeg,audio/wav,audio/mp4,.webm,.ogg,.mp3,.wav,.m4a"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const err = validateOralAnswerAudioFile(file);
            if (err) {
              toast.error(err);
              return;
            }
            void Promise.resolve(onUpload(file)).catch((uploadErr) => {
              toast.error(uploadErr instanceof Error ? uploadErr.message : "Dépôt impossible");
            });
          }}
        />
      </div>
      {uploading ? <p className="text-xs text-muted-foreground">Téléversement…</p> : null}
      {hasAudio && previewUrl ? (
        <audio controls src={previewUrl} className="w-full">
          Votre navigateur ne lit pas l’audio.
        </audio>
      ) : hasAudio ? (
        <p className="text-sm text-muted-foreground">Audio déposé (aperçu en cours de chargement…)</p>
      ) : (
        <p className="text-sm text-muted-foreground">Aucun enregistrement pour l’instant.</p>
      )}
    </div>
  );
}
