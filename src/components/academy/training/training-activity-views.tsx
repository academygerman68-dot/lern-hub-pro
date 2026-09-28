import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Headphones, Mic, Pause, Play, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validateOralAnswerAudioFile } from "@/lib/exam-oral";
import {
  resolveActivityViewKey,
  validateActivityProps,
  type StudentTrainingActivity,
} from "@/lib/training-runner-ux";

export type ActivityAnswerValue =
  | { value: string }
  | { value: boolean }
  | { values: string[] }
  | { fields: Record<string, string> }
  | { text: string }
  | { media?: { bucket?: string; path?: string }; note?: string };

type BaseProps = {
  activity: StudentTrainingActivity;
  disabled?: boolean;
  value: ActivityAnswerValue | null;
  onChange: (next: ActivityAnswerValue) => void;
  feedback?: {
    isCorrect?: boolean | null;
    explanation?: string | null;
    positive?: string | null;
    commonError?: string | null;
    teacherComment?: string | null;
  } | null;
};

function ChoiceList({
  activity,
  disabled,
  value,
  onChange,
  multi,
}: BaseProps & { multi?: boolean }) {
  const selected = multi
    ? new Set(
        value && "values" in value && Array.isArray(value.values) ? value.values : [],
      )
    : new Set(
        value && "value" in value && typeof value.value === "string" ? [value.value] : [],
      );
  const groupId = useId();

  return (
    <fieldset className="space-y-3" disabled={disabled} aria-label={activity.prompt}>
      {(activity.choices ?? []).map((choice) => {
        const checked = selected.has(choice.id);
        return (
          <label
            key={choice.id}
            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm ${
              checked ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <input
              className="mt-1 size-4 accent-primary"
              type={multi ? "checkbox" : "radio"}
              name={groupId}
              checked={checked}
              disabled={disabled}
              onChange={() => {
                if (multi) {
                  const next = new Set(selected);
                  if (next.has(choice.id)) next.delete(choice.id);
                  else next.add(choice.id);
                  onChange({ values: [...next] });
                } else {
                  onChange({ value: choice.id });
                }
              }}
            />
            <span lang="de">{choice.text}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function TrueFalseView(props: BaseProps) {
  const current =
    props.value && "value" in props.value ? Boolean(props.value.value) : null;
  return (
    <div className="flex flex-wrap gap-3" role="group" aria-label="Vrai ou faux">
      {[
        { label: "Richtig", value: true },
        { label: "Falsch", value: false },
      ].map((opt) => (
        <Button
          key={String(opt.value)}
          type="button"
          variant={current === opt.value ? "default" : "outline"}
          className="min-h-11 min-w-[7rem]"
          disabled={props.disabled}
          onClick={() => props.onChange({ value: opt.value })}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

function FormFillView({ activity, disabled, value, onChange }: BaseProps) {
  const fields =
    value && "fields" in value && value.fields ? value.fields : ({} as Record<string, string>);
  return (
    <div className="space-y-4">
      {(activity.fields ?? []).map((field) => {
        const id = `ff-${activity.id}-${field.id}`;
        return (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={id}>{field.label}</Label>
            <Input
              id={id}
              lang="de"
              disabled={disabled}
              value={fields[field.id] ?? ""}
              onChange={(e) =>
                onChange({ fields: { ...fields, [field.id]: e.target.value } })
              }
              autoComplete="off"
            />
          </div>
        );
      })}
    </div>
  );
}

function ShortTextView({ activity, disabled, value, onChange }: BaseProps) {
  const text = value && "text" in value ? value.text : value && "value" in value && typeof value.value === "string" ? value.value : "";
  const id = `st-${activity.id}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Votre réponse</Label>
      <Input
        id={id}
        lang="de"
        disabled={disabled}
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
      />
    </div>
  );
}

function WritingView({ activity, disabled, value, onChange }: BaseProps) {
  const text = value && "text" in value ? value.text ?? "" : "";
  const id = `wr-${activity.id}`;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={id}>Votre texte</Label>
        <Textarea
          id={id}
          lang="de"
          rows={8}
          disabled={disabled}
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
          className="min-h-40"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {words} mot{words === 1 ? "" : "s"}
        {activity.recommended_words
          ? ` · objectif ≈ ${activity.recommended_words} mots`
          : ""}
      </p>
      {activity.rubric?.length ? (
        <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Critères (version étudiant)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {activity.rubric.map((r) => (
              <li key={r.id}>
                {r.label} <span className="text-xs">({r.max_points} pts)</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function TrainingAudioPlayer({
  url,
  playerKey,
  expectedDuration,
}: {
  url: string;
  playerKey: string;
  expectedDuration?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    setPlaying(false);
    setError(null);
    setDuration(null);
  }, [playerKey, url]);

  return (
    <div className="rounded-xl border border-dashed border-border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
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
      <audio
        key={playerKey}
        ref={audioRef}
        className="sr-only"
        src={url}
        preload="metadata"
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration;
          if (d && Number.isFinite(d)) setDuration(d);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setError("Impossible de lire l’audio. Vérifiez votre connexion.")}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-11 min-w-11"
          aria-label={playing ? "Pause" : "Lecture"}
          onClick={() => {
            const el = audioRef.current;
            if (!el) return;
            if (playing) void el.pause();
            else void el.play().catch(() => setError("Lecture impossible sur cet appareil."));
          }}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <audio className="w-full max-w-md" controls src={url} controlsList="nodownload" />
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function ListeningView(props: BaseProps) {
  const url = props.activity.media?.audio_url;
  return (
    <div className="space-y-4">
      {url ? (
        <TrainingAudioPlayer
          url={url}
          playerKey={props.activity.id}
          {...(props.activity.media?.duration_seconds != null
            ? { expectedDuration: props.activity.media.duration_seconds }
            : {})}
        />
      ) : (
        <p className="text-sm text-destructive">Audio manquant pour cette activité.</p>
      )}
      <ChoiceList {...props} />
    </div>
  );
}

function SpeakingView({
  activity,
  disabled,
  value,
  onChange,
  onUploadOral,
}: BaseProps & {
  onUploadOral?: (file: File) => Promise<void>;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleFile = async (file: File) => {
    const err = validateOralAnswerAudioFile(file);
    if (err) {
      setMicError(err);
      return;
    }
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(URL.createObjectURL(file));
    setMicError(null);
    if (!onUploadOral) {
      onChange({ note: "local-only", media: {} });
      return;
    }
    setUploading(true);
    try {
      await onUploadOral(file);
    } catch (e) {
      setMicError(e instanceof Error ? e.message : "Dépôt impossible");
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    if (disabled || uploading || recording) return;
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError(
        activity.mic_fallback ??
          "Enregistrement non supporté. Importez un fichier audio si autorisé.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : undefined;
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
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
        void handleFile(file);
      };
      mediaRecorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      recorder.start();
    } catch {
      stopTracks();
      setMicError(
        activity.mic_fallback ??
          "Micro refusé ou inaccessible. Autorisez le micro ou importez un fichier.",
      );
    }
  };

  const hasMedia =
    Boolean(localUrl) ||
    Boolean(value && "media" in value && value.media?.path);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm" lang="de">
        <p className="font-medium">Sprechkarte</p>
        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{activity.speaking_card}</p>
      </div>
      {activity.rubric?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {activity.rubric.map((r) => (
            <li key={r.id}>
              {r.label} ({r.max_points} pts)
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <Button
            type="button"
            className="min-h-11"
            disabled={disabled || uploading}
            onClick={() => void startRecording()}
          >
            <Mic className="mr-2 size-4" />
            {hasMedia ? "Remplacer" : "Enregistrer"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            onClick={() => mediaRecorderRef.current?.stop()}
          >
            <Square className="mr-2 size-4" />
            Arrêter ({seconds}s)
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-2 size-4" />
          Importer
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.webm,.mp3,.wav,.m4a"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {localUrl ? (
        <audio className="w-full" controls src={localUrl} controlsList="nodownload" />
      ) : null}
      {uploading ? <p className="text-sm text-muted-foreground">Envoi sécurisé…</p> : null}
      {micError ? <p className="text-sm text-destructive">{micError}</p> : null}
      {activity.mic_fallback ? (
        <p className="text-xs text-muted-foreground">{activity.mic_fallback}</p>
      ) : null}
    </div>
  );
}

function FeedbackBlock({ feedback }: Pick<BaseProps, "feedback">) {
  if (!feedback) return null;
  return (
    <div
      className={`mt-4 rounded-xl border p-3 text-sm ${
        feedback.isCorrect === true
          ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
          : feedback.isCorrect === false
            ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            : "border-border bg-muted/40"
      }`}
      aria-live="polite"
    >
      {feedback.isCorrect === true ? <p className="font-medium">Bien joué</p> : null}
      {feedback.isCorrect === false ? <p className="font-medium">À revoir</p> : null}
      {feedback.positive ? <p className="mt-1">{feedback.positive}</p> : null}
      {feedback.explanation ? <p className="mt-1">{feedback.explanation}</p> : null}
      {feedback.commonError && feedback.isCorrect === false ? (
        <p className="mt-1 text-muted-foreground">{feedback.commonError}</p>
      ) : null}
      {feedback.teacherComment ? (
        <p className="mt-2 border-t border-border/60 pt-2">
          Commentaire enseignant : {feedback.teacherComment}
        </p>
      ) : null}
    </div>
  );
}

function UnknownActivity({ activity, reason }: { activity: StudentTrainingActivity; reason: string }) {
  return (
    <div
      className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
      role="alert"
    >
      <div className="flex items-start gap-2 font-medium text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        Type d’activité non supporté
      </div>
      <p className="mt-2 text-muted-foreground">
        Staff : {reason} (id={activity.id}, type={activity.activity_type}, skill={activity.skill}).
        Les autres activités restent accessibles.
      </p>
    </div>
  );
}

export type TrainingActivityRendererProps = BaseProps & {
  onUploadOral?: (file: File) => Promise<void>;
};

export function TrainingActivityRenderer(props: TrainingActivityRendererProps) {
  const { activity } = props;
  const propError = validateActivityProps(activity);
  if (propError) return <UnknownActivity activity={activity} reason={propError} />;

  const key = resolveActivityViewKey(activity);
  const body = (() => {
    switch (key) {
      case "single_choice":
      case "revision":
        return <ChoiceList {...props} />;
      case "multiple_choice":
        return <ChoiceList {...props} multi />;
      case "true_false":
      case "lesen":
        return (
          <div className="space-y-4">
            {activity.passage ? (
              <div
                className="rounded-xl border border-border bg-muted/20 p-4 text-sm leading-6"
                lang="de"
              >
                {activity.passage}
              </div>
            ) : null}
            <TrueFalseView {...props} />
          </div>
        );
      case "form_fill":
        return <FormFillView {...props} />;
      case "short_text":
        return <ShortTextView {...props} />;
      case "writing":
        return <WritingView {...props} />;
      case "speaking":
        return <SpeakingView {...props} />;
      case "listening":
        return <ListeningView {...props} />;
      default:
        return (
          <UnknownActivity
            activity={activity}
            reason={`Aucun composant enregistré pour « ${activity.activity_type} »`}
          />
        );
    }
  })();

  return (
    <div className="space-y-4">
      {body}
      <FeedbackBlock feedback={props.feedback ?? null} />
    </div>
  );
}
