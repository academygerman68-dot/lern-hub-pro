import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateLiveSessionSchedule } from "@/hooks/use-academy-data";
import { formatLiveTime } from "@/lib/live-meeting";
import type { LiveSessionListItem } from "@/services/supabase/live-session-service";
import { useAcademy } from "../academy-context";
import { FormSection, Surface } from "../primitives";

function toDateInput(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimeInput(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combineLocal(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function formatRangeLabel(startsAt: string, endsAt: string | null) {
  const start = formatLiveTime(startsAt);
  const end = endsAt ? formatLiveTime(endsAt) : null;
  return end ? `${start}–${end}` : start;
}

type EditLiveSessionModalProps = {
  open: boolean;
  session: LiveSessionListItem | null;
  onClose: () => void;
};

export function EditLiveSessionModal({ open, session, onClose }: EditLiveSessionModalProps) {
  const { profile, role } = useAcademy();
  const updateSchedule = useUpdateLiveSessionSchedule();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [scope] = useState<"this" | "following" | "series">("this");

  useEffect(() => {
    if (!open || !session) return;
    setTitle(session.title);
    setDate(toDateInput(session.starts_at));
    setStartTime(toTimeInput(session.starts_at));
    setEndTime(session.ends_at ? toTimeInput(session.ends_at) : "");
    setConfirm(false);
  }, [open, session]);

  if (!open || !session) return null;

  const canEdit = role === "director" || role === "teacher";

  // Permission is enforced by RLS; UI still hides for students.
  if (role === "student" || !canEdit) return null;

  const oldLabel = formatRangeLabel(session.starts_at, session.ends_at);
  const previewStarts = date && startTime ? combineLocal(date, startTime) : null;
  const previewEnds = date && endTime ? combineLocal(date, endTime) : null;
  const newLabel =
    previewStarts && previewEnds
      ? formatRangeLabel(previewStarts, previewEnds)
      : previewStarts
        ? formatLiveTime(previewStarts)
        : "—";

  const save = () => {
    if (!date || !startTime) {
      toast.error("La date et l’heure de début sont obligatoires.");
      return;
    }
    const startsAt = combineLocal(date, startTime);
    const endsAt = endTime ? combineLocal(date, endTime) : null;
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      toast.error("L’heure de fin doit être après l’heure de début.");
      return;
    }
    if (!confirm) {
      setConfirm(true);
      return;
    }
    // Only "this session" is supported — no series backend yet.
    if (scope !== "this") {
      toast.error("Seule la modification de cette séance est disponible.");
      return;
    }
    updateSchedule.mutate(
      {
        id: session.id,
        title: title.trim(),
        startsAt,
        endsAt,
        actorProfileId: profile?.id ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Séance mise à jour");
          setConfirm(false);
          onClose();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  if (!canEdit) return null;

  return (
    <div className="mobile-modal">
      <Surface className="mobile-modal-panel max-h-[90dvh] space-y-4 overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Modifier la séance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.class?.name ?? "Groupe"} · {oldLabel}
          </p>
        </div>

        <FormSection
          title="Informations"
          description="Le lien de visioconférence existant est conservé."
        >
          <label className="block text-sm">
            Titre
            <Input
              className="mt-1"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setConfirm(false);
              }}
              disabled={updateSchedule.isPending}
            />
          </label>
          <label className="block text-sm">
            Date
            <Input
              type="date"
              className="mt-1"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setConfirm(false);
              }}
              disabled={updateSchedule.isPending}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Heure de début
              <Input
                type="time"
                className="mt-1"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setConfirm(false);
                }}
                disabled={updateSchedule.isPending}
              />
            </label>
            <label className="block text-sm">
              Heure de fin
              <Input
                type="time"
                className="mt-1"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setConfirm(false);
                }}
                disabled={updateSchedule.isPending}
              />
            </label>
          </div>
        </FormSection>

        <FormSection
          title="Portée"
          description="Les séances générées n’ont pas de série liée : seule cette occurrence est modifiée."
        >
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked readOnly className="accent-primary" />
            Cette séance uniquement
          </label>
          <p className="text-xs text-muted-foreground">
            « Cette séance et les suivantes » / « Toute la série » seront disponibles lorsque le
            backend gérera les séries.
          </p>
        </FormSection>

        {confirm ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Modifier cette séance de <strong>{oldLabel}</strong> vers <strong>{newLabel}</strong> ?
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            disabled={updateSchedule.isPending}
            onClick={() => {
              setConfirm(false);
              onClose();
            }}
          >
            Annuler
          </Button>
          <Button disabled={updateSchedule.isPending} onClick={save}>
            {updateSchedule.isPending
              ? "Enregistrement…"
              : confirm
                ? "Confirmer la modification"
                : "Enregistrer"}
          </Button>
        </div>
      </Surface>
    </div>
  );
}

/** Whether the current user may edit this session (UI gate; RLS is the real check). */
export function canEditLiveSession(
  role: string | null | undefined,
  session: LiveSessionListItem,
  myTeacherId?: string | null,
) {
  if (role === "director") return true;
  if (role === "teacher") {
    if (!myTeacherId) return false;
    return session.teacher_id === myTeacherId || session.class?.teacher_id === myTeacherId;
  }
  return false;
}
