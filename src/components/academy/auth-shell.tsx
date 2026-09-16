import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand/brand-logo";
import { localeLabels } from "@/lib/i18n";
import type { Locale } from "@/types/academy";
import { useAcademy } from "./academy-context";
import { useBranding } from "@/components/brand/branding-provider";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const brand = useBranding();
  const { t, l, locale, setLocale } = useAcademy();

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[1fr_1.05fr]">
      <section className="relative hidden overflow-hidden bg-brand lg:flex lg:flex-col lg:justify-between lg:p-12">
        <BrandLogo variant="full" inverted showWordmark />
        <div className="max-w-xl">
          <p className="mb-4 text-xs font-semibold tracking-[0.16em] text-brand-foreground/60 uppercase">
            {t("brand.tagline")}
          </p>
          <h1 className="font-display text-4xl leading-tight font-medium text-brand-foreground xl:text-5xl">
            {l(
              "Une académie d’allemand précise, calme et exigeante.",
              "أكاديمية ألمانية دقيقة وهادئة وطموحة.",
            )}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-brand-foreground/70">
            {l(
              "Cours, live, examens et progression — une plateforme unique du A1 au B2.",
              "الدورات والدروس المباشرة والامتحانات والتقدّم — من A1 إلى B2.",
            )}
          </p>
        </div>
        <p className="text-sm text-brand-foreground/50">{brand.name}</p>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))] pt-[max(2rem,env(safe-area-inset-top,0px))] sm:px-5 sm:py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
            <Link to="/" className="lg:hidden">
              <BrandLogo variant="compact" />
            </Link>
            <div className="ml-auto flex gap-1" role="group" aria-label="Language">
              {(["fr", "ar"] as Locale[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    locale === code ? "bg-soft-blue text-primary" : "text-muted-foreground"
                  }`}
                >
                  {localeLabels[code]}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm font-medium text-primary">{t("login.welcome")}</p>
          <h2 className="mt-2 font-display text-2xl font-medium tracking-tight sm:text-3xl">
            {title}
          </h2>
          {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}

          <div className="mt-6">{children}</div>
          {footer}
        </div>
      </section>
    </main>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5a4.8 4.8 0 0 1-2.1 3.1l3.4 2.6c2-1.8 3.1-4.5 3.1-7.7 0-.7-.1-1.4-.2-2.1H12z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.8-2.4l-3.4-2.6c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.6-4.1L3 16.5A10 10 0 0 0 12 22z"
      />
      <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8L3 7.5a10 10 0 0 0 0 9z" />
      <path
        fill="#4285F4"
        d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3 7.5l3.4 2.6A5.9 5.9 0 0 1 12 6.1z"
      />
    </svg>
  );
}
