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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5a4.8 4.8 0 0 1-2.1 3.1l3.4 2.6c2-1.8 3.1-4.5 3.1-7.7 0-.7-.1-1.4-.2-2.1H12z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.8-2.4l-3.4-2.6c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.6-4.1L3 16.5A10 10 0 0 0 12 22z"
      />
      <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8L3 7.5a10 10 0 0 0 0 9z" />
      <path
        fill="#4285F4"
        d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3 7.5l3.4 2.6A5.9 5.9 0 0 1 12 6.1z"
      />
    </svg>
  );
}

export function Login() {
  const brand = useBranding();
  const { signIn, t, l, locale, setLocale } = useAcademy();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState<Role | "form" | "google" | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
      if (mode === "signup") {
        const user = await AuthService.signUp({ email, password, firstName, lastName });
        if (!user) {
          toast.success(
            l(
              "Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.",
              "تم إنشاء الحساب. تحقق من بريدك الإلكتروني للتأكيد.",
            ),
          );
          setMode("signin");
          setLoading(null);
          return;
        }
        signIn(user);
        return;
      }
      const user = await AuthService.login(email, password);
      signIn(user);
    } catch {
      toast.error(
        mode === "signup"
          ? l("Impossible de créer le compte.", "تعذّر إنشاء الحساب.")
          : t("login.invalid"),
      );
      setLoading(null);
    }
  };

  const google = async () => {
    setLoading("google");
    try {
      await AuthService.signInWithGoogle();
    } catch {
      toast.error(
        l("Connexion Google indisponible pour le moment.", "تسجيل الدخول بجوجل غير متاح حاليًا."),
      );
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
            {mode === "signin" ? t("login.title") : l("Créer un compte", "إنشاء حساب")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? t("login.subtitle")
              : l(
                  "Inscrivez-vous comme étudiant pour commencer votre parcours d’allemand.",
                  "سجّل كطالب لبدء رحلتك في تعلّم الألمانية.",
                )}
          </p>

          <div
            className="mt-6 inline-flex rounded-lg border border-border p-1"
            role="group"
            aria-label={l("Mode de connexion", "طريقة الدخول")}
          >
            {(
              [
                ["signin", l("Se connecter", "تسجيل الدخول")],
                ["signup", l("Créer un compte", "إنشاء حساب")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  mode === value
                    ? "bg-soft-blue text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {mode === "signup" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  {l("Prénom", "الاسم")}
                  <Input
                    className="mt-2 h-11"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Ahmed"
                  />
                </label>
                <label className="block text-sm font-medium">
                  {l("Nom", "اللقب")}
                  <Input
                    className="mt-2 h-11"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Benali"
                  />
                </label>
              </div>
            )}
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
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary"
                    onClick={() => toast.message(t("login.reset"))}
                  >
                    {t("login.forgot")}
                  </button>
                )}
              </span>
              <div className="relative mt-2">
                <Input
                  className="h-11 pr-11"
                  type={show ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
            <Button className="h-11 w-full" disabled={loading !== null}>
              {loading === "form"
                ? mode === "signup"
                  ? l("Création…", "جارٍ الإنشاء…")
                  : t("login.signing")
                : mode === "signup"
                  ? l("Créer mon compte", "إنشاء حسابي")
                  : t("login.submit")}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {l("ou", "أو")}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2"
            disabled={loading !== null}
            onClick={() => void google()}
          >
            <GoogleIcon />
            {loading === "google"
              ? l("Redirection…", "جارٍ التحويل…")
              : mode === "signup"
                ? l("S’inscrire avec Google", "التسجيل بواسطة جوجل")
                : l("Continuer avec Google", "المتابعة بواسطة جوجل")}
          </Button>

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
