import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { useAcademy } from "./academy-context";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import "./login.css";

export function LoginShell({
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
  const { locale, t } = useAcademy();
  // Recreate localized DOM nodes so the legacy global localizer cannot restore
  // cached labels from the previous language. Form state stays in Login.
  return (
    <main key={locale} className="gla-login" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="gla-login-stage">
        <div className="gla-login-media" aria-hidden="true">
          <img
            src="/branding/login-hero-germany.jpg"
            alt=""
            width={2400}
            height={1600}
            decoding="async"
          />
        </div>
        <div className="gla-login-veil" aria-hidden="true" />

        <header className="gla-login-header">
          <div className="gla-login-brand">
            <span className="gla-login-seal">
              <img src="/branding/gla-logo.png" alt="" width="1024" height="559" />
            </span>
            <div>
              <strong>German Academy</strong>
              <span>{t("login.brandLine")}</span>
            </div>
          </div>
          <div className="gla-login-header-actions">
            <ThemeToggle />
            <div
              className="gla-login-languages"
              role="group"
              aria-label={t("login.interfaceLanguage")}
            >
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        <div className="gla-login-layout">
          <section className="gla-login-story" aria-label={t("login.welcomeAria")}>
            <p className="gla-login-flagline" aria-hidden="true">
              <span className="gla-flag gla-flag-black" />
              <span className="gla-flag gla-flag-red" />
              <span className="gla-flag gla-flag-gold" />
            </p>
            <h1>German Academy</h1>
            <p className="gla-login-lead">{t("login.hero.copy")}</p>
          </section>

          <section className="gla-login-card" aria-labelledby="gla-login-title">
            <h2 id="gla-login-title">{title}</h2>
            {subtitle ? <p className="gla-login-subtitle">{subtitle}</p> : null}
            <div className="gla-login-content">
              {children}
              {footer}
            </div>
          </section>
        </div>

        <footer className="gla-login-footer">
          <span>© {new Date().getFullYear()} German Language Academy</span>
          <span>
            <LockKeyhole size={13} aria-hidden="true" />
            {t("login.footer.personal")}
          </span>
        </footer>
      </div>
    </main>
  );
}
