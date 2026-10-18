export type ColorScheme = "light" | "dark";

export const COLOR_SCHEME_KEY = "da-color-scheme";

export function readColorScheme(): ColorScheme {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem(COLOR_SCHEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyColorScheme(scheme: ColorScheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", scheme === "dark");
  document.documentElement.style.colorScheme = scheme;
}

export function writeColorScheme(scheme: ColorScheme) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(COLOR_SCHEME_KEY, scheme);
    window.dispatchEvent(new Event("da-color-scheme"));
  }
  applyColorScheme(scheme);
}
