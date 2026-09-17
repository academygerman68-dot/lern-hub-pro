import type { ReactNode } from "react";
import { ArrowUpRight, BookOpen, Globe2, LockKeyhole } from "lucide-react";
import { useAcademy } from "./academy-context";
import "./login.css";

export function LoginShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { locale, setLocale, l } = useAcademy();
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
            <span>{l("LA LANGUE. LES POSSIBILITÉS.", "لغة تفتح آفاقًا جديدة.")}</span>
          </div>
        </div>
        <div
          className="gla-login-languages"
          role="group"
          aria-label={l("Langue de l’interface", "لغة الواجهة")}
        >
          <Globe2 size={15} aria-hidden="true" />
          <button
            type="button"
            lang="fr"
            aria-pressed={locale === "fr"}
            onClick={() => setLocale("fr")}
          >
            FR
          </button>
          <span aria-hidden="true">/</span>
          <button
            type="button"
            lang="ar"
            aria-pressed={locale === "ar"}
            onClick={() => setLocale("ar")}
          >
            العربية
          </button>
        </div>
      </header>

      <div className="gla-login-layout">
        <section
          className="gla-login-story"
          aria-label={l("Bienvenue chez German Academy", "مرحبًا بكم في German Academy")}
        >
          <div className="gla-login-eyebrow">
            <span />
            {l("APPRENDRE. GRANDIR. ALLER PLUS LOIN.", "تعلّم. تطوّر. انطلق نحو آفاق جديدة.")}
          </div>
          <h1>
            {l("Une langue.", "لغة واحدة.")}
            <br />
            {l("De nouvelles", "وآفاق")}
            <br />
            <em>{l("perspectives.", "جديدة.")}</em>
          </h1>
          <p className="gla-login-story-copy">
            {l(
              "L’allemand se construit un jour après l’autre. Retrouvez vos cours, vos échanges et vos progrès dans votre espace personnel.",
              "تتقدّم في اللغة الألمانية يومًا بعد يوم. تجد دروسك وتواصلك وتقدّمك في مساحتك الشخصية.",
            )}
          </p>
          <div className="gla-login-path">
            <div className="gla-login-path-caption">
              <BookOpen size={17} aria-hidden="true" />
              <span>{l("Un parcours, à chaque étape.", "مسار يرافقك في كل مرحلة.")}</span>
            </div>
            <div
              className="gla-login-levels"
              role="group"
              dir="ltr"
              aria-label={l(
                "Niveaux d’allemand : A1, A2, B1, B2",
                "مستويات الألمانية: A1، A2، B1، B2",
              )}
            >
              {["A1", "A2", "B1", "B2"].map((level, index) => (
                <div key={level}>
                  <span>{level}</span>
                  {index < 3 && <i aria-hidden="true" />}
                </div>
              ))}
              <ArrowUpRight size={24} aria-hidden="true" />
            </div>
            <p>
              {l(
                "Des premières conversations aux nouvelles opportunités.",
                "من محادثاتك الأولى إلى فرص جديدة.",
              )}
            </p>
          </div>
        </section>

        <section className="gla-login-card" aria-labelledby="gla-login-title">
          <div className="gla-login-card-top">
            <span className="gla-login-card-emblem">
              <BookOpen size={22} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span>{l("VOTRE ESPACE ACADÉMIE", "مساحتك في الأكاديمية")}</span>
          </div>
          <h2 id="gla-login-title">{title}</h2>
          {subtitle && <p className="gla-login-subtitle">{subtitle}</p>}
          <div className="gla-login-content">{children}</div>
        </section>
      </div>

      <footer className="gla-login-footer">
        <span>© {new Date().getFullYear()} German Language Academy</span>
        <span>
          <LockKeyhole size={13} aria-hidden="true" />
          {l("Votre espace d’apprentissage personnel", "مساحتك الشخصية للتعلّم")}
        </span>
      </footer>
    </main>
  );
}
