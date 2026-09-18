import type { ReactNode } from "react";
import { ChevronRight, Inbox, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/academy-logic";

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
        "rounded-xl border border-border/80 bg-card shadow-soft",
        onClick &&
          "cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99] motion-reduce:transform-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Constrains page content on ultrawide displays. */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[72rem]", className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-5">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="font-display text-[1.65rem] font-normal leading-[1.15] tracking-tight text-foreground sm:text-3xl md:text-[2.15rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:mt-2.5 sm:text-[0.9375rem]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{action}</div>
      ) : null}
    </div>
  );
}

/** Alias kept for existing imports — same visual language as PageHeader. */
export function PremiumHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return <PageHeader title={title} subtitle={subtitle} action={action} />;
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
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
    <Surface className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        {icon ? <span className="text-primary/80">{icon}</span> : null}
      </div>
      <p className="mt-3 font-display text-2xl font-normal tracking-tight text-foreground sm:text-[1.75rem]">
        {value}
      </p>
      {note ? <p className="mt-1.5 text-xs text-muted-foreground">{note}</p> : null}
    </Surface>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/20 bg-success-soft/40"
      : tone === "warning"
        ? "border-amber-200/80 bg-warning-soft/50"
        : tone === "danger"
          ? "border-alert/20 bg-alert-soft/50"
          : tone === "info"
            ? "border-primary/15 bg-soft-blue/40"
            : "";
  return (
    <Surface className={cn("p-4", toneClass)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
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

/** CEFR level — solid navy chip, distinct from group. */
export function LevelBadge({ code }: { code: string | null | undefined }) {
  if (!code || code === "—") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary-foreground">
      {code}
    </span>
  );
}

/** Class instance — outline chip so it never looks like a level. */
export function GroupBadge({ label }: { label: string | null | undefined }) {
  if (!label || label === "—") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex max-w-full items-center truncate rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
      {label}
    </span>
  );
}

export function AvatarName({
  name,
  subtitle,
  size = "md",
}: {
  name: string;
  subtitle?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm" ? "size-8 text-[10px]" : size === "lg" ? "size-11 text-sm" : "size-9 text-[11px]";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground",
          sizeClass,
        )}
      >
        {initials(name) || "?"}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {message ? (
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{message}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ProgressLine({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-200 motion-reduce:transition-none"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
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
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      {link ? (
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary transition-colors duration-150 hover:text-primary/80"
          onClick={onClick}
        >
          {link}
          <ChevronRight className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <Surface className={cn("table-scroll", className)}>{children}</Surface>;
}

/** Presentational drop zone shell — wrap upload inputs; no logic. */
export function FileDropzoneVisual({
  title = "Glissez-déposez un fichier ici",
  hint = "ou cliquez pour sélectionner",
  children,
  className,
  active = false,
}: {
  title?: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition duration-150",
        active ? "border-primary bg-primary/[0.06]" : "border-primary/25 bg-primary/[0.03]",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Upload className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {children ? <div className="mt-2 w-full">{children}</div> : null}
    </div>
  );
}

/** Compact action row under headers / filters. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

/** Alias — same chip language as Status. */
export function StatusBadge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "red" | "amber" | "gray";
}) {
  return <Status tone={tone}>{children}</Status>;
}
