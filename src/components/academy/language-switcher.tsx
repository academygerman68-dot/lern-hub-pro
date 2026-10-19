import { LOCALES, type Locale } from "@/types/academy";
import { localeLabels } from "@/lib/i18n";
import { useAcademy } from "./academy-context";

const LOCALE_LANG: Record<Locale, string> = {
  fr: "fr",
  en: "en",
  de: "de",
  ar: "ar",
};

export function LanguageSwitcher({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useAcademy();

  return (
    <div
      className={`flex flex-wrap gap-1 ${className}`}
      role="group"
      aria-label={t("shell.language")}
    >
      {LOCALES.map((code) => {
        const selected = locale === code;
        return (
          <button
            key={code}
            type="button"
            lang={LOCALE_LANG[code]}
            aria-pressed={selected}
            onClick={() => setLocale(code)}
            className={
              compact
                ? `min-h-9 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    selected ? "bg-soft-blue text-primary" : "text-muted-foreground hover:bg-muted"
                  }`
                : undefined
            }
          >
            {localeLabels[code]}
          </button>
        );
      })}
    </div>
  );
}
