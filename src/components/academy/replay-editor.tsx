import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useClasses,
  useCreateRecordingFromUrl,
  useDeleteRecording,
  useLiveSessions,
  useUpdateRecording,
} from "@/hooks/use-academy-data";
import type { MeetingRecording } from "@/types/phase3";
import { Surface } from "./primitives";

type ReplayFormState = {
  title: string;
  externalUrl: string;
  classId: string;
  sessionId: string;
  recordedOn: string;
  description: string;
};

const emptyForm = (): ReplayFormState => ({
  title: "",
  externalUrl: "",
  classId: "",
  sessionId: "",
  recordedOn: "",
  description: "",
});

type Props = {
  open: boolean;
  editing: MeetingRecording | null;
  role: string | null | undefined;
  userId: string | null | undefined;
  onClose: () => void;
};

export function ReplayEditorModal({ open, editing, role, userId, onClose }: Props) {
  const isStaff = role === "director" || role === "teacher";
  const classesQuery = useClasses();
  const sessionsQuery = useLiveSessions();
  const createFromUrl = useCreateRecordingFromUrl();
  const updateRecording = useUpdateRecording();
  const [form, setForm] = useState<ReplayFormState>(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title ?? "",
        externalUrl: editing.external_url ?? "",
        classId: editing.class_id ?? "",
        sessionId: editing.live_session_id ?? "",
        recordedOn: editing.recorded_on ?? editing.created_at.slice(0, 10),
        description: editing.description ?? "",
      });
      return;
    }
    setForm(emptyForm());
  }, [open, editing]);

  const sessionsForClass = useMemo(
    () =>
      (sessionsQuery.data ?? []).filter(
        (s) =>
          (!form.classId || s.class_id === form.classId) &&
          (s.status === "completed" || s.status === "scheduled" || s.status === "live"),
      ),
    [sessionsQuery.data, form.classId],
  );

  if (!open || !isStaff) return null;

  const saving = createFromUrl.isPending || updateRecording.isPending;
  const canSave =
    Boolean(form.title.trim()) &&
    Boolean(form.classId) &&
    Boolean(form.externalUrl.trim()) &&
    !saving;

  return (
    <div className="mobile-modal">
      <Surface className="mobile-modal-panel space-y-4">
        <h2 className="text-lg font-semibold">
          {editing ? "Modifier la rediffusion" : "Ajouter une rediffusion"}
        </h2>
        <Input
          placeholder="Titre"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <Input
          placeholder="https://…"
          value={form.externalUrl}
          onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
        />
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.classId}
          onChange={(e) =>
            setForm((f) => ({ ...f, classId: e.target.value, sessionId: "" }))
          }
        >
          <option value="">Groupe</option>
          {(classesQuery.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {(c.reference || c.name) + (c.level ? ` · ${c.level}` : "")}
            </option>
          ))}
        </select>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.sessionId}
          onChange={(e) => setForm((f) => ({ ...f, sessionId: e.target.value }))}
        >
          <option value="">Séance (optionnel)</option>
          {sessionsForClass.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} · {new Date(s.starts_at).toLocaleDateString("fr-FR")}
            </option>
          ))}
        </select>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Date</span>
          <Input
            type="date"
            value={form.recordedOn}
            onChange={(e) => setForm((f) => ({ ...f, recordedOn: e.target.value }))}
          />
        </label>
        <Textarea
          placeholder="Description (facultative)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              const payload = {
                title: form.title.trim(),
                externalUrl: form.externalUrl.trim(),
                classId: form.classId,
                liveSessionId: form.sessionId || null,
                description: form.description.trim() || null,
                recordedOn: form.recordedOn || null,
              };
              if (editing) {
                updateRecording.mutate(
                  { id: editing.id, ...payload },
                  {
                    onSuccess: () => {
                      toast.success("Rediffusion mise à jour");
                      onClose();
                    },
                    onError: (err) => toast.error(err.message),
                  },
                );
                return;
              }
              createFromUrl.mutate(
                { ...payload, createdBy: userId ?? null },
                {
                  onSuccess: () => {
                    toast.success("Rediffusion ajoutée");
                    onClose();
                  },
                  onError: (err) => toast.error(err.message),
                },
              );
            }}
          >
            Enregistrer
          </Button>
        </div>
      </Surface>
    </div>
  );
}

type ListActionsProps = {
  recording: MeetingRecording;
  canManage: boolean;
  onEdit: () => void;
  onPlay: () => void;
};

export function ReplayRowActions({ recording, canManage, onEdit, onPlay }: ListActionsProps) {
  const deleteRecording = useDeleteRecording();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={recording.status !== "ready"}
        onClick={onPlay}
      >
        {recording.status === "ready" ? "Lire" : "Indisponible"}
      </Button>
      {canManage ? (
        <>
          <Button size="sm" variant="outline" onClick={onEdit}>
            Modifier
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={deleteRecording.isPending}
            onClick={() => {
              if (!window.confirm("Supprimer cette rediffusion ?")) return;
              deleteRecording.mutate(recording.id, {
                onSuccess: () => toast.success("Rediffusion supprimée"),
                onError: (err) => toast.error(err.message),
              });
            }}
          >
            Supprimer
          </Button>
        </>
      ) : null}
    </div>
  );
}
