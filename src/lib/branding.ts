/** Single source of truth for academy branding assets and copy. */
export const BRAND = {
  name: "German Language Academy",
  shortName: "GLA",
  tagline: "Apprendre l’allemand. Construire l’avenir.",
  logoSrc: "/branding/gla-logo.png",
  logoAlt: "German Language Academy",
} as const;

export type BrandConfig = {
  name: string;
  shortName: string;
  tagline: string;
  logoSrc: string;
  logoAlt: string;
};
