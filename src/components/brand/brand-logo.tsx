import { cn } from "@/lib/utils";
import { useBranding } from "./branding-provider";

type BrandLogoProps = {
  /** full = seal + wordmark area, mark = compact seal, wordmark = text only fallback */
  variant?: "full" | "mark" | "compact";
  className?: string;
  imgClassName?: string;
  showWordmark?: boolean;
  inverted?: boolean;
};

export function BrandLogo({
  variant = "full",
  className,
  imgClassName,
  showWordmark = variant === "full",
  inverted = false,
}: BrandLogoProps) {
  const brand = useBranding();
  const size =
    variant === "mark" ? "size-9" : variant === "compact" ? "size-11" : "size-14 sm:size-16";

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <img
        src={brand.logoSrc}
        alt={brand.logoAlt}
        width={variant === "mark" ? 36 : variant === "compact" ? 44 : 64}
        height={variant === "mark" ? 36 : variant === "compact" ? 44 : 64}
        className={cn(size, "shrink-0 object-contain", imgClassName)}
        decoding="async"
      />
      {showWordmark && (
        <div className="min-w-0">
          <strong
            className={cn(
              "block truncate text-[13px] font-semibold tracking-tight",
              inverted ? "text-white" : "text-foreground",
            )}
          >
            {brand.name}
          </strong>
          <span
            className={cn(
              "mt-0.5 block text-[10px] font-medium tracking-[0.18em] uppercase",
              inverted ? "text-white/55" : "text-muted-foreground",
            )}
          >
            {brand.shortName}
          </span>
        </div>
      )}
    </div>
  );
}
