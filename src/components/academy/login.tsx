import { useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localeLabels } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase";
import { AuthService } from "@/services/academy-services";
import type { Locale, Role } from "@/types/academy";
import { useAcademy } from "./academy-context";
import { useBranding } from "@/components/brand/branding-provider";

export function Login() {
  const brand = useBranding();
  const { signIn, t, l, locale, setLocale } = useAcademy();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState<Role | "form" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const enterRole = async (role: Role) => {
    if (isSupabaseConfigured) {
      toast.error("Demo login is disabled. Use a real Supabase account.");
      return;
    }
    setLoading(role);
    try {
      const user = await AuthService.demoLogin(role);
      signIn(user);
    } catch {
      toast.error(t("login.invalid"));
      setLoading(null);
    }
  };

  const submit = async () => {
    setLoading("form");
    try {
      const user = await AuthService.login(email, password);
      signIn(user);
    } catch {
      toast.error(t("login.invalid"));
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[1fr_1.05fr]">
      <section className="relative hidden overflow-hidden bg-brand lg:flex lg:flex-col lg:justify-between lg:p-12">
        <BrandLogo variant="full" inverted showWordmark />
        <div className="max-w-xl">
          <p className="mb-4 text-xs font-semibold tracking-[0.16em] text-brand-foreground/60 uppercase">
            {t("brand.tagline")}
          </p>
          <h1 className="font-display text-4xl leading-tight font-medium text-brand-foreground xl:text-5xl">
            {l(
              "Une académie d’allemand précise, calme et exigeante.",
              "أكاديمية ألمانية دقيقة وهادئة وطموحة.",
            )}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-brand-foreground/70">
            {l(
              "Cours, live, examens et progression — une plateforme unique du A1 au B2.",
              "الدورات والدروس المباشرة والامتحانات والتقدّم — من A1 إلى B2.",
            )}
          </p>
        </div>
        <p className="text-sm text-brand-foreground/50">{brand.name}</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div className="lg:hidden">
              <BrandLogo variant="compact" />
            </div>
            <div className="ml-auto flex gap-1" role="group" aria-label="Language">
              {(["fr", "ar"] as Locale[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    locale === code ? "bg-soft-blue text-primary" : "text-muted-foreground"
                  }`}
                >
                  {localeLabels[code]}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm font-medium text-primary">{t("login.welcome")}</p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight">
            {t("login.title")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("login.subtitle")}</p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="block text-sm font-medium">
              {t("login.email")}
              <Input
                className="mt-2 h-11"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@gla.academy"
              />
            </label>
            <label className="block text-sm font-medium">
              <span className="flex items-center justify-between">
                {t("login.password")}
                <button
                  type="button"
                  className="text-xs font-medium text-primary"
                  onClick={() => toast.message(t("login.reset"))}
                >
                  {t("login.forgot")}
                </button>
              </span>
              <div className="relative mt-2">
                <Input
                  className="h-11 pr-11"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShow((value) => !value)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
            <Button className="h-11 w-full" disabled={loading === "form"}>
              {loading === "form" ? t("login.signing") : t("login.submit")}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          {!isSupabaseConfigured && (
            <div className="mt-8 border-t border-border pt-6">
              <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {t("login.demo")}
              </p>
              <div className="grid gap-2">
                {(["student", "teacher", "director"] as Role[]).map((role) => (
                  <Button
                    key={role}
                    variant="outline"
                    className="justify-between"
                    disabled={loading !== null}
                    onClick={() => void enterRole(role)}
                  >
                    {t(`role.${role}`)}
                    <ArrowRight className="size-4 opacity-50" />
                  </Button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">{t("login.footer")}</p>
        </div>
      </section>
    </main>
  );
}
