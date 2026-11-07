import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useUpdateLiveSessionSchedule,
  useUpdateLiveSessionStatus,
} from "@/hooks/use-academy-data";
import { formatLiveTime, isValidExternalMeetingUrl } from "@/lib/live-meeting";
import {
  type LiveMeetingMode,
  type LiveSessionListItem,
  SupabaseLiveSessionService,
} from "@/services/supabase/live-session-service";
import { useAcademy } from "../academy-context";
import { FormSection, Surface } from "../primitives";
import { MobileModal } from "../shared/mobile-modal";
import { LiveMeetingModeFields } from "./meeting-mode-fields";

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

function initialMeetingMode(session: LiveSessionListItem): LiveMeetingMode {
  return session.video_provider === "external" || session.video_provider === "zoom"
    ? "external"
    : "jitsi";
}

type EditLiveSessionModalProps = {
  open: boolean;
  session: LiveSessionListItem | null;
  onClose: () => void;
};

export function EditLiveSessionModal({ open, session, onClose }: EditLiveSessionModalProps) {
  const { profile, role } = useAcademy();
  const updateSchedule = useUpdateLiveSessionSchedule();
  const updateStatus = useUpdateLiveSessionStatus();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [meetingMode, setMeetingMode] = useState<LiveMeetingMode>("jitsi");
  const [externalMeetingUrl, setExternalMeetingUrl] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [scope] = useState<"this" | "following" | "series">("this");
  const busy = updateSchedule.isPending || updateStatus.isPending;

  useEffect(() => {
    if (!open || !session) return;
    setTitle(session.title);
    setDate(toDateInput(session.starts_at));
    setStartTime(toTimeInput(session.starts_at));
    setEndTime(session.ends_at ? toTimeInput(session.ends_at) : "");
    const mode = initialMeetingMode(session);
    setMeetingMode(mode);
    setExternalMeetingUrl("");
    setConfirm(false);

    if (mode === "external") {
      void SupabaseLiveSessionService.joinTarget(session.id)
        .then((target) => {
          if (target.url) setExternalMeetingUrl(target.url);
        })
        .catch(() => undefined);
    }
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
    if (meetingMode === "external" && !isValidExternalMeetingUrl(externalMeetingUrl)) {
      toast.error("Lien invalide. Utilisez une URL https Zoom ou Google Meet.");
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
        meetingMode,
        externalMeetingUrl: meetingMode === "external" ? externalMeetingUrl.trim() : null,
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

  const cancelSession = () => {
    if (session.status === "cancelled") {
      toast.message("Cette séance est déjà annulée.");
      return;
    }
    if (
      !window.confirm(
        `Supprimer / annuler la séance « ${session.title} » ? Elle disparaîtra des listes à venir.`,
      )
    ) {
      return;
    }
    updateStatus.mutate(
      { id: session.id, status: "cancelled" },
      {
        onSuccess: () => {
          toast.success("Séance annulée");
          onClose();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <MobileModal onClose={onClose}>
      <Surface className="mobile-modal-panel max-h-[90dvh] space-y-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">Modifier la séance</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {session.class?.name ?? "Groupe"} · {oldLabel}
            </p>
          </div>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
            Fermer
          </Button>
        </div>

        <FormSection
          title="Informations"
          description="Même choix de visioconférence que lors de la création (Direct ou séances générées depuis un groupe)."
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
              disabled={busy}
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
              disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
              />
            </label>
          </div>
          <LiveMeetingModeFields
            name="edit-meeting-mode"
            meetingMode={meetingMode}
            externalMeetingUrl={externalMeetingUrl}
            disabled={busy}
            onMeetingModeChange={(mode) => {
              setMeetingMode(mode);
              setConfirm(false);
            }}
            onExternalMeetingUrlChange={(url) => {
              setExternalMeetingUrl(url);
              setConfirm(false);
            }}
          />
        </FormSection>

        <FormSection
          title="Portée"
          description="Les séances générées n’ont pas de série liée : seule cette occurrence est modifiée."
        >
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked readOnly className="accent-primary" />
            Cette séance uniquement
          </label>
        </FormSection>

        {confirm ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-50">
            Modifier cette séance de <strong>{oldLabel}</strong> vers <strong>{newLabel}</strong>
            {meetingMode === "external"
              ? " · visioconférence Zoom / Meet"
              : " · visioconférence Jitsi"}{" "}
            ?
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button
            variant="outline"
            className="text-destructive"
            disabled={busy || session.status === "cancelled"}
            onClick={cancelSession}
          >
            {updateStatus.isPending ? "Suppression…" : "Supprimer la séance"}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setConfirm(false);
                onClose();
              }}
            >
              Annuler
            </Button>
            <Button
              disabled={busy || (meetingMode === "external" && !externalMeetingUrl.trim())}
              onClick={save}
            >
              {updateSchedule.isPending
                ? "Enregistrement…"
                : confirm
                  ? "Confirmer la modification"
                  : "Enregistrer"}
            </Button>
          </div>
        </div>
      </Surface>
    </MobileModal>
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
    // If teacher id isn’t resolved yet, still show actions — RLS blocks unauthorized writes.
    if (!myTeacherId) return true;
    return session.teacher_id === myTeacherId || session.class?.teacher_id === myTeacherId;
  }
  return false;
}
