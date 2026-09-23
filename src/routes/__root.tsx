import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { AcademyProvider } from "@/components/academy/academy-context";
import { BrandingProvider } from "@/components/brand/branding-provider";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          German Academy
        </p>
        <h1 className="mt-3 font-display text-6xl font-normal tracking-tight text-foreground">
          404
        </h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n’existe pas ou a été déplacée. Revenez à l’accueil pour continuer.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    const route =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "(ssr)";
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", { route, message: error?.message, stack: error?.stack, error });
    } else {
      console.error(error);
    }
    reportLovableError(error, { boundary: "tanstack_root_error_component", route });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          German Academy
        </p>
        <h1 className="mt-3 font-display text-2xl font-normal tracking-tight text-foreground">
          Impossible de charger cette page
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une erreur inattendue s’est produite. Vous pouvez réessayer ou revenir à l’accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-background px-5 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-accent"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "German Language Academy" },
      { name: "description", content: "Plateforme moderne d’apprentissage de l’allemand." },
      { name: "author", content: "German Language Academy" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap",
      },
      { rel: "icon", href: "/branding/gla-logo.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/branding/gla-logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <AcademyProvider>
          <Outlet />
          <Toaster richColors closeButton position="top-center" />
        </AcademyProvider>
      </BrandingProvider>
    </QueryClientProvider>
  );
}
