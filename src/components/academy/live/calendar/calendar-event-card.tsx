import type { CSSProperties } from "react";
import { liveStatusLabel, formatLiveTime } from "@/lib/live-meeting";
import { calendarStatusTone } from "@/lib/live-calendar-layout";
import { cn } from "@/lib/utils";
import type { LiveSessionListItem } from "@/services/supabase/live-session-service";
import { Status } from "../../primitives";

export type CalendarEventCardVariant = "week" | "month" | "agenda";

type CalendarEventCardProps = {
  session: LiveSessionListItem;
  variant?: CalendarEventCardVariant;
  selected?: boolean;
  showTeacher?: boolean;
  teacherName?: string;
  onSelect: (id: string) => void;
  className?: string;
  style?: CSSProperties;
};

export function CalendarEventCard({
  session,
  variant = "week",
  selected = false,
  showTeacher = false,
  teacherName,
  onSelect,
  className,
  style,
}: CalendarEventCardProps) {
  const tone = calendarStatusTone(session.status);
  const level = session.class?.level?.code;
  const group = session.class?.name;
  const isLive = session.status === "live";

  if (variant === "month") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(session.id);
        }}
        className={cn(
          "block w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight font-medium transition",
          isLive
            ? "bg-emerald-600 text-white"
            : tone === "amber"
              ? "bg-primary/12 text-primary"
              : tone === "red"
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-foreground",
          selected && "ring-1 ring-primary",
          className,
        )}
        style={style}
        title={session.title}
      >
        {formatLiveTime(session.starts_at)} · {session.title}
      </button>
    );
  }

  if (variant === "agenda") {
    return (
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        className={cn(
          "w-full rounded-xl border border-border/80 bg-card p-3.5 text-left shadow-soft transition hover:border-primary/35",
          selected && "border-primary ring-1 ring-primary/25",
          isLive && "border-emerald-500/40 bg-emerald-50/50",
          className,
        )}
        style={style}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatLiveTime(session.starts_at)}
            {session.ends_at ? `–${formatLiveTime(session.ends_at)}` : ""}
          </span>
          <Status tone={tone}>{liveStatusLabel(session.status)}</Status>
        </div>
        <p className="mt-1.5 text-base font-semibold tracking-tight">{session.title}</p>
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {level ? <span className="font-medium text-foreground">{level}</span> : null}
          {group ? <span>{group}</span> : null}
          {showTeacher && teacherName ? <span>{teacherName}</span> : null}
        </div>
      </button>
    );
  }

  // week (positioned in time grid)
  return (
    <button
      type="button"
      onClick={() => onSelect(session.id)}
      className={cn(
        "absolute inset-x-0.5 z-[1] overflow-hidden rounded-md border px-1.5 py-1 text-left shadow-sm transition hover:brightness-[0.98]",
        isLive
          ? "border-emerald-600/50 bg-emerald-600 text-white"
          : "border-primary/25 bg-primary/10 text-foreground hover:bg-primary/15",
        selected && "z-[2] ring-2 ring-primary/40",
        className,
      )}
      style={style}
    >
      <p className="truncate text-[10px] font-semibold tabular-nums leading-tight">
        {formatLiveTime(session.starts_at)}
        {isLive ? " · Live" : ""}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug">{session.title}</p>
      {(level || group) && (
        <p
          className={cn(
            "mt-0.5 truncate text-[9px] leading-tight",
            isLive ? "text-white/85" : "text-muted-foreground",
          )}
        >
          {[level, group].filter(Boolean).join(" · ")}
        </p>
      )}
      {showTeacher && teacherName ? (
        <p
          className={cn("truncate text-[9px]", isLive ? "text-white/80" : "text-muted-foreground")}
        >
          {teacherName}
        </p>
      ) : null}
    </button>
  );
}
