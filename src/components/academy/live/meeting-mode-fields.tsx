import { Input } from "@/components/ui/input";
import type { LiveMeetingMode } from "@/services/supabase/live-session-service";

type LiveMeetingModeFieldsProps = {
  meetingMode: LiveMeetingMode;
  externalMeetingUrl: string;
  disabled?: boolean;
  /** Radio group name — keep unique when multiple forms can mount. */
  name?: string;
  onMeetingModeChange: (mode: LiveMeetingMode) => void;
  onExternalMeetingUrlChange: (url: string) => void;
};

/** Shared Jitsi vs Zoom/Meet picker for create + edit live sessions. */
export function LiveMeetingModeFields({
  meetingMode,
  externalMeetingUrl,
  disabled = false,
  name = "meeting-mode",
  onMeetingModeChange,
  onExternalMeetingUrlChange,
}: LiveMeetingModeFieldsProps) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">Visioconférence</legend>
      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
        <input
          type="radio"
          name={name}
          className="mt-1"
          checked={meetingMode === "jitsi"}
          onChange={() => onMeetingModeChange("jitsi")}
          disabled={disabled}
        />
        <span>
          <span className="font-medium">Jitsi (intégré)</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Les participants rejoignent dans l’application.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
        <input
          type="radio"
          name={name}
          className="mt-1"
          checked={meetingMode === "external"}
          onChange={() => onMeetingModeChange("external")}
          disabled={disabled}
        />
        <span>
          <span className="font-medium">Lien Zoom / Google Meet</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Collez le lien de la réunion ; ouverture dans un nouvel onglet.
          </span>
        </span>
      </label>
      {meetingMode === "external" ? (
        <Input
          type="url"
          inputMode="url"
          dir="ltr"
          placeholder="https://zoom.us/j/… ou https://meet.google.com/…"
          value={externalMeetingUrl}
          onChange={(e) => onExternalMeetingUrlChange(e.target.value)}
          disabled={disabled}
        />
      ) : null}
    </fieldset>
  );
}
