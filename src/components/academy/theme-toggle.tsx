import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyColorScheme, readColorScheme, writeColorScheme, type ColorScheme } from "@/lib/color-scheme";
import { useAcademy } from "./academy-context";

export function useColorScheme() {
  const [scheme, setScheme] = useState<ColorScheme>("light");
  useEffect(() => {
    const sync = () => {
      const next = readColorScheme();
      applyColorScheme(next);
      setScheme(next);
    };
    sync();
    window.addEventListener("da-color-scheme", sync);
    return () => window.removeEventListener("da-color-scheme", sync);
  }, []);
  return scheme;
}

export function ThemeToggle({ showLabels = false }: { showLabels?: boolean }) {
  const { t } = useAcademy();
  const scheme = useColorScheme();

  return (
    <div className="flex gap-1" role="group" aria-label={t("shell.theme")}>
      {(["light", "dark"] as const).map((value) => {
        const selected = scheme === value;
        const Icon = value === "light" ? Sun : Moon;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => writeColorScheme(value)}
            className={`inline-flex min-h-9 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              selected ? "bg-soft-blue text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span className={showLabels ? undefined : "sr-only sm:not-sr-only"}>
              {t(value === "light" ? "shell.theme.light" : "shell.theme.dark")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
