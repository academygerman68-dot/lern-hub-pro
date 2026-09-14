import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyTitle = "Nothing here yet",
  emptyMessage = "Data will appear once records are available.",
  emptyAction,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <div className="skeleton h-12 w-full" />
        <div className="skeleton h-28 w-full" />
        <div className="skeleton h-28 w-4/5" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-alert/20 bg-alert-soft/60 p-8">
        <h3 className="text-base font-semibold text-foreground">Unable to load this view</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Something went wrong while fetching data. You can retry in a moment.
        </p>
        {error?.message && (
          <p className="mt-3 text-xs text-muted-foreground/80">Reference: request failed</p>
        )}
        {onRetry && (
          <Button className="mt-5" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <h3 className="text-base font-semibold tracking-tight">{emptyTitle}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {emptyMessage}
        </p>
        {emptyAction && <div className="mt-5 flex justify-center">{emptyAction}</div>}
      </div>
    );
  }

  return <>{children}</>;
}
