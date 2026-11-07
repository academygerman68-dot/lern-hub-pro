import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, PanelLeftOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LiveMeetingStageProps = {
  title: string;
  subtitle?: string;
  /** Extra actions (e.g. Terminer la séance) rendered before Agrandir / Fermer. */
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Immersive meeting chrome portaled above the app shell.
 * Expand / show-menu use CSS only so the Jitsi iframe is never remounted.
 */
export function LiveMeetingStage({
  title,
  subtitle,
  actions,
  onClose,
  children,
}: LiveMeetingStageProps) {
  const [expanded, setExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) {
    return (
      <div className="grid min-h-[50dvh] place-items-center text-sm text-muted-foreground">
        Ouverture de la réunion…
      </div>
    );
  }

  return createPortal(
    <div
      className={cn(
        "z-[80] flex flex-col overflow-hidden bg-background",
        expanded
          ? "fixed inset-0"
          : "fixed top-12 right-2 bottom-2 left-2 rounded-xl border border-border shadow-card sm:top-16 lg:left-[calc(16.5rem+0.5rem)]",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-border/80 bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight sm:text-base">{title}</p>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {expanded ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setExpanded(false)}>
              <PanelLeftOpen className="size-3.5" />
              Afficher menu
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setExpanded(true)}>
              <Maximize2 className="size-3.5" />
              Agrandir / masquer menu
            </Button>
          )}
          <Button type="button" size="sm" variant="default" onClick={onClose}>
            <X className="size-3.5" />
            Fermer
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-black">{children}</div>
    </div>,
    document.body,
  );
}
