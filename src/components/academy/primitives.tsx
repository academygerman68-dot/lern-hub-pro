import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Surface({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border bg-card shadow-soft",
        onClick &&
          "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-10 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-5">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-normal leading-tight text-foreground sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-base">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{action}</div>
      )}
    </div>
  );
}

export function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note?: string;
  icon?: ReactNode;
}) {
  return (
    <Surface className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-3 font-display text-2xl font-normal text-foreground sm:mt-4 sm:text-3xl">
        {value}
      </p>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </Surface>
  );
}

export function Status({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "red" | "amber" | "gray";
}) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

export function ProgressLine({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-700"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function SectionTitle({
  title,
  link,
  onClick,
}: {
  title: string;
  link?: string;
  onClick?: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {link && (
        <button
          className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary"
          onClick={onClick}
        >
          {link}
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Scrollable table wrapper with touch-friendly overflow on small screens. */
export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <Surface className={cn("table-scroll", className)}>{children}</Surface>;
}
