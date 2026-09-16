import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BRAND, type BrandConfig } from "@/lib/branding";
import { queryKeys } from "@/lib/query-keys";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SettingsService } from "@/services/supabase/settings-service";

const BrandingContext = createContext<BrandConfig>(BRAND);

function asString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string" && url.trim()) return url;
  }
  return fallback;
}

export function BrandingProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: Partial<BrandConfig>;
}) {
  const settingsQuery = useQuery({
    queryKey: queryKeys.branding.settings,
    queryFn: () => SettingsService.getMap(),
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
  });

  const merged = useMemo<BrandConfig>(() => {
    const map = settingsQuery.data ?? {};
    const fromSettings: Partial<BrandConfig> = {
      name: asString(map["academy_name"], BRAND.name),
      tagline: asString(map["academy_tagline"], BRAND.tagline),
      logoSrc: asString(map["logo_url"], BRAND.logoSrc),
      logoAlt: asString(map["academy_name"], BRAND.logoAlt),
    };
    return {
      ...BRAND,
      ...fromSettings,
      ...value,
    };
  }, [settingsQuery.data, value]);

  return <BrandingContext.Provider value={merged}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
