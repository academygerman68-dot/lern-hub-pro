import type { ReactNode } from "react";
import { ArrowUpRight, BookOpen, Globe2, LockKeyhole } from "lucide-react";
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
      <header className="gla-login-header">
        <div className="gla-login-brand">
          <span className="gla-login-seal">
            <img
              src="/branding/gla-logo.png"
              alt="German Language Academy"
              width="1024"
              height="559"
            />
          </span>
          <div>
            <strong>German Academy</strong>
            <span>{t("login.brandLine")}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div
            className="gla-login-languages"
            role="group"
            aria-label={t("login.interfaceLanguage")}
          >
            <Globe2 size={15} aria-hidden="true" />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="gla-login-layout">
        <section className="gla-login-story" aria-label={t("login.welcomeAria")}>
          <div className="gla-login-eyebrow">
            <span />
            {t("login.eyebrow")}
          </div>
          <h1>
            {t("login.hero.line1")}
            <br />
            {t("login.hero.line2")}
            <br />
            <em>{t("login.hero.line3")}</em>
          </h1>
          <p className="gla-login-story-copy">{t("login.hero.copy")}</p>
          <div className="gla-login-path">
            <div className="gla-login-path-caption">
              <BookOpen size={17} aria-hidden="true" />
              <span>{t("login.path.caption")}</span>
            </div>
            <div
              className="gla-login-levels"
              role="group"
              dir="ltr"
              aria-label={t("login.levels.aria")}
            >
              {["A1", "A2", "B1", "B2"].map((level, index) => (
                <div key={level}>
                  <span>{level}</span>
                  {index < 3 && <i aria-hidden="true" />}
                </div>
              ))}
              <ArrowUpRight size={24} aria-hidden="true" />
            </div>
            <p>{t("login.path.footer")}</p>
          </div>
        </section>

        <section className="gla-login-card" aria-labelledby="gla-login-title">
          <div className="gla-login-card-top">
            <span className="gla-login-card-emblem">
              <BookOpen size={22} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span>{t("login.card.badge")}</span>
          </div>
          <h2 id="gla-login-title">{title}</h2>
          {subtitle && <p className="gla-login-subtitle">{subtitle}</p>}
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
    </main>
  );
}
