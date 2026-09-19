import {
  CALENDAR_PX_PER_HOUR,
  calendarDayKey,
  calendarEventLayout,
  calendarFormatHourLabel,
  calendarGridHeightPx,
  calendarHourLabels,
  calendarIsSameDay,
  calendarNowLinePct,
} from "@/lib/live-calendar-layout";
import { cn } from "@/lib/utils";
import type { LiveSessionListItem } from "@/services/supabase/live-session-service";
import { Surface } from "../../primitives";
import { CalendarEventCard } from "./calendar-event-card";

type CalendarWeekViewProps = {
  weekDays: Date[];
  sessionsByDay: Map<string, LiveSessionListItem[]>;
  today: Date;
  now: Date;
  selectedId: string | null;
  showTeacher: boolean;
  teacherName: (session: LiveSessionListItem) => string;
  onSelect: (id: string) => void;
};

export function CalendarWeekView({
  weekDays,
  sessionsByDay,
  today,
  now,
  selectedId,
  showTeacher,
  teacherName,
  onSelect,
}: CalendarWeekViewProps) {
  const hours = calendarHourLabels();
  const gridHeight = calendarGridHeightPx();
  const showNow = weekDays.some((d) => calendarIsSameDay(d, today));
  const nowPct = showNow ? calendarNowLinePct(now) : null;

  return (
    <Surface className="overflow-hidden">
      <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-border bg-muted/35">
        <div className="border-r border-border/60" aria-hidden />
        {weekDays.map((day) => {
          const isToday = calendarIsSameDay(day, today);
          return (
            <div
              key={calendarDayKey(day)}
              className={cn(
                "border-r border-border/60 px-1 py-2.5 text-center last:border-r-0",
                isToday && "bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "block text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
                  isToday && "text-primary",
                )}
              >
                {day.toLocaleDateString("fr-FR", { weekday: "short" })}
              </span>
              <span
                className={cn(
                  "mt-1 inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="max-h-[min(70vh,42rem)] overflow-auto">
        <div
          className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]"
          style={{ minHeight: gridHeight }}
        >
          <div className="relative border-r border-border/60">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                style={{ top: (hour - 8) * CALENDAR_PX_PER_HOUR }}
              >
                {calendarFormatHourLabel(hour)}
              </div>
            ))}
          </div>

          {weekDays.map((day) => {
            const key = calendarDayKey(day);
            const items = sessionsByDay.get(key) ?? [];
            const isToday = calendarIsSameDay(day, today);
            return (
              <div
                key={key}
                className={cn(
                  "relative border-r border-border/50 last:border-r-0",
                  isToday && "bg-primary/[0.03]",
                )}
                style={{ height: gridHeight }}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute inset-x-0 border-t border-border/40"
                    style={{ top: (hour - 8) * CALENDAR_PX_PER_HOUR }}
                  />
                ))}
                {isToday && nowPct != null ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-[3] flex items-center"
                    style={{ top: `${nowPct}%` }}
                    aria-hidden
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
                    <span className="h-px flex-1 bg-destructive" />
                  </div>
                ) : null}
                {items.map((session) => {
                  const layout = calendarEventLayout(session.starts_at, session.ends_at);
                  return (
                    <CalendarEventCard
                      key={session.id}
                      session={session}
                      variant="week"
                      selected={selectedId === session.id}
                      showTeacher={showTeacher}
                      teacherName={teacherName(session)}
                      onSelect={onSelect}
                      style={{
                        top: `${layout.topPct}%`,
                        height: `${layout.heightPct}%`,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}
