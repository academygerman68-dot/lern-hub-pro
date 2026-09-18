import type { ReactNode } from "react";
import { Status, PageHeader, ProgressLine } from "./primitives";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function Ring({
  value,
  size = 180,
  dark = false,
}: {
  value: number;
  size?: number;
  dark?: boolean;
}) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className={dark ? "text-primary-foreground/12" : "text-border"}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className={dark ? "text-primary-foreground" : "text-primary"}
        />
      </svg>
      <div className="text-center">
        <strong className="font-display text-4xl font-normal">{value}%</strong>
        <span
          className={`mt-1 block text-[11px] ${dark ? "text-primary-foreground/60" : "text-muted-foreground"}`}
        >
          complete
        </span>
      </div>
    </div>
  );
}

export function SkillBars({
  compact = false,
  skills,
}: {
  compact?: boolean;
  skills?: { name: string; value: number }[];
}) {
  const items = skills ?? [
    { name: "Hören", value: 76 },
    { name: "Lesen", value: 82 },
    { name: "Schreiben", value: 68 },
    { name: "Sprechen", value: 74 },
  ];
  return (
    <div className="space-y-5">
      {items.map((skill) => (
        <div key={skill.name}>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>{skill.name}</span>
            <strong className="font-medium">{skill.value}</strong>
          </div>
          <ProgressLine value={skill.value} className={compact ? "h-1" : "h-1.5"} />
        </div>
      ))}
    </div>
  );
}

/** @deprecated Prefer PageHeader from primitives — kept for existing imports. */
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

export { Status };
