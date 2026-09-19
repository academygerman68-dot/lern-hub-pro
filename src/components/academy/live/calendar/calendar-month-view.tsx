import { calendarDayKey, calendarIsSameDay } from "@/lib/live-calendar-layout";
import { cn } from "@/lib/utils";
import type { LiveSessionListItem } from "@/services/supabase/live-session-service";
import { Surface } from "../../primitives";
import { CalendarEventCard } from "./calendar-event-card";

const MAX_VISIBLE = 3;

type CalendarMonthViewProps = {
  monthCells: Date[];
  anchor: Date;
  sessionsByDay: Map<string, LiveSessionListItem[]>;
  today: Date;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function CalendarMonthView({
  monthCells,
  anchor,
  sessionsByDay,
  today,
  selectedId,
  onSelect,
}: CalendarMonthViewProps) {
  return (
    <Surface className="p-2 sm:p-3">
      <div className="grid grid-cols-7 gap-px text-center text-[11px] font-medium text-muted-foreground">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px rounded-lg bg-border/50">
        {monthCells.map((day) => {
          const inMonth = day.getMonth() === anchor.getMonth();
          const key = calendarDayKey(day);
          const items = sessionsByDay.get(key) ?? [];
          const isToday = calendarIsSameDay(day, today);
          const visible = items.slice(0, MAX_VISIBLE);
          const overflow = items.length - visible.length;

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (items[0]) onSelect(items[0].id);
                }
              }}
              onClick={() => {
                if (items[0]) onSelect(items[0].id);
              }}
              className={cn(
                "min-h-[5.75rem] bg-card p-1.5 text-left transition sm:min-h-[6.5rem]",
                !inMonth && "bg-muted/40 text-muted-foreground/70",
                isToday && "ring-1 ring-inset ring-primary/35",
                items.length > 0 && "cursor-pointer hover:bg-muted/30",
              )}
            >
              <p
                className={cn(
                  "mb-1 text-[11px] font-semibold",
                  isToday &&
                    "inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground",
                  !inMonth && !isToday && "opacity-50",
                )}
              >
                {day.getDate()}
              </p>
              <div className="space-y-0.5">
                {visible.map((session) => (
                  <CalendarEventCard
                    key={session.id}
                    session={session}
                    variant="month"
                    selected={selectedId === session.id}
                    onSelect={onSelect}
                  />
                ))}
                {overflow > 0 ? (
                  <p className="px-0.5 text-[10px] font-medium text-muted-foreground">
                    + {overflow} autre{overflow > 1 ? "s" : ""}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}
