import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyTitle = "Rien pour le moment",
  emptyMessage = "Les données apparaîtront dès que des enregistrements seront disponibles.",
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
        <h3 className="text-base font-semibold text-foreground">Impossible de charger cette vue</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Un problème est survenu lors du chargement. Vous pouvez réessayer dans un instant.
        </p>
        {error?.message ? <p className="mt-3 text-sm text-foreground/80">{error.message}</p> : null}
        {onRetry && (
          <Button className="mt-5" variant="outline" onClick={onRetry}>
            Réessayer
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
