import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calendarPeriodLabel } from "@/lib/live-calendar-layout";
import { cn } from "@/lib/utils";

type CalendarToolbarProps = {
  view: "week" | "month";
  anchor: Date;
  onViewChange: (view: "week" | "month") => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  className?: string;
};

export function CalendarToolbar({
  view,
  anchor,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  className,
}: CalendarToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-9 shrink-0"
          aria-label="Période précédente"
          onClick={onPrev}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-9 px-3" onClick={onToday}>
          Aujourd’hui
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-9 shrink-0"
          aria-label="Période suivante"
          onClick={onNext}
        >
          <ChevronRight className="size-4" />
        </Button>
        <p className="ml-1 min-w-0 text-sm font-semibold capitalize tracking-tight text-foreground sm:ml-2 sm:text-base">
          {calendarPeriodLabel(anchor, view)}
        </p>
      </div>
      <div
        className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
        role="group"
        aria-label="Vue calendrier"
      >
        <Button
          type="button"
          size="sm"
          variant={view === "week" ? "default" : "ghost"}
          className="h-8 rounded-md px-3"
          onClick={() => onViewChange("week")}
        >
          Semaine
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === "month" ? "default" : "ghost"}
          className="h-8 rounded-md px-3"
          onClick={() => onViewChange("month")}
        >
          Mois
        </Button>
      </div>
    </div>
  );
}
