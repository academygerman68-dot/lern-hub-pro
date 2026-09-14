import { createContext, useContext, useMemo, type ReactNode } from "react";
import { BRAND, type BrandConfig } from "@/lib/branding";

const BrandingContext = createContext<BrandConfig>(BRAND);

export function BrandingProvider({
  children,
  value,
}: {
  children: ReactNode;
  /** Optional override (e.g. future app_settings logo URL). */
  value?: Partial<BrandConfig>;
}) {
  const merged = useMemo<BrandConfig>(
    () => ({
      ...BRAND,
      ...value,
    }),
    [value],
  );
  return <BrandingContext.Provider value={merged}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
