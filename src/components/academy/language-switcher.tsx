import { Check, ChevronDown, Languages } from "lucide-react";
import { LOCALES, type Locale } from "@/types/academy";
import { localeLabels, localeNativeNames } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("shell.language")}
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/16 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 data-[state=open]:bg-white/18",
            compact &&
              "min-h-9 rounded-md border-border bg-transparent px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring data-[state=open]:bg-muted",
            className,
          )}
        >
          <Languages className={cn("size-3.5 opacity-80", compact && "size-3")} aria-hidden />
          <span lang={LOCALE_LANG[locale]}>{localeLabels[locale]}</span>
          <ChevronDown
            className="size-3.5 opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[10.5rem] p-1.5">
        {LOCALES.map((code) => {
          const selected = locale === code;
          return (
            <DropdownMenuItem
              key={code}
              lang={LOCALE_LANG[code]}
              onSelect={() => setLocale(code)}
              className={cn(
                "cursor-pointer gap-2 rounded-md px-2.5 py-2 text-sm",
                selected && "bg-accent/60 font-medium",
              )}
            >
              <span className="w-7 shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground">
                {localeLabels[code]}
              </span>
              <span className="flex-1">{localeNativeNames[code]}</span>
              {selected ? <Check className="size-3.5 text-primary" aria-hidden /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
