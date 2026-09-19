import { calendarDayKey, calendarIsSameDay } from "@/lib/live-calendar-layout";
import type { LiveSessionListItem } from "@/services/supabase/live-session-service";
import { CalendarEventCard } from "./calendar-event-card";

type CalendarAgendaViewProps = {
  agendaDays: Date[];
  sessionsByDay: Map<string, LiveSessionListItem[]>;
  today: Date;
  selectedId: string | null;
  showTeacher: boolean;
  teacherName: (session: LiveSessionListItem) => string;
  onSelect: (id: string) => void;
};

export function CalendarAgendaView({
  agendaDays,
  sessionsByDay,
  today,
  selectedId,
  showTeacher,
  teacherName,
  onSelect,
}: CalendarAgendaViewProps) {
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const sections = agendaDays
    .map((day) => {
      const items = sessionsByDay.get(calendarDayKey(day)) ?? [];
      const keepEmpty = calendarIsSameDay(day, today) || calendarIsSameDay(day, tomorrow);
      if (!items.length && !keepEmpty) return null;
      const label = calendarIsSameDay(day, today)
        ? "Aujourd’hui"
        : calendarIsSameDay(day, tomorrow)
          ? "Demain"
          : day.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "short",
            });
      return { key: calendarDayKey(day), day, label, items };
    })
    .filter(Boolean) as Array<{
    key: string;
    day: Date;
    label: string;
    items: LiveSessionListItem[];
  }>;

  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune séance à venir.</p>;
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.key}>
          <h4 className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {section.label}
          </h4>
          {section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Rien de prévu</p>
          ) : (
            <div className="space-y-2.5">
              {section.items.map((session) => (
                <CalendarEventCard
                  key={session.id}
                  session={session}
                  variant="agenda"
                  selected={selectedId === session.id}
                  showTeacher={showTeacher}
                  teacherName={teacherName(session)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
