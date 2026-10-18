import { afterEach, describe, expect, it, vi } from "vitest";
import { COLOR_SCHEME_KEY, readColorScheme, writeColorScheme } from "@/lib/color-scheme";

describe("color scheme", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores light or dark without writing the interface language", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    const toggle = vi.fn();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("document", {
      documentElement: { classList: { toggle }, style: {} },
    });
    vi.stubGlobal("window", {
      localStorage: storage,
      dispatchEvent: () => true,
    });

    writeColorScheme("dark");
    expect(readColorScheme()).toBe("dark");
    expect(store.get(COLOR_SCHEME_KEY)).toBe("dark");
    expect(store.has("da-locale")).toBe(false);
    expect(toggle).toHaveBeenCalledWith("dark", true);

    writeColorScheme("light");
    expect(readColorScheme()).toBe("light");
    expect(toggle).toHaveBeenCalledWith("dark", false);
  });
});
