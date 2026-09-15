import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDemoAuthAllowed } from "@/lib/auth-config";
import { loginSchema, signupSchema, type LoginValues, type SignupValues } from "@/lib/auth-schemas";
import { isSupabaseConfigured } from "@/lib/supabase";
import { AuthService } from "@/services/academy-services";
import { AuthError } from "@/services/supabase/auth-service";
import type { Role } from "@/types/academy";
import { useAcademy } from "./academy-context";
import { AuthShell, GoogleIcon } from "./auth-shell";

function authErrorMessage(
  error: unknown,
  l: (fr: string, ar: string) => string,
  mode: "signin" | "signup",
): string {
  const code =
    error instanceof AuthError ? error.code : error instanceof Error ? error.message : "";
  switch (code) {
    case "EMAIL_NOT_CONFIRMED":
      return l(
        "Confirmez votre e-mail avant de vous connecter.",
        "أكد بريدك الإلكتروني قبل تسجيل الدخول.",
      );
    case "EMAIL_TAKEN":
      return l("Un compte existe déjà avec cet e-mail.", "يوجد حساب بهذا البريد بالفعل.");
    case "ACCOUNT_INACTIVE":
      return l("Ce compte est suspendu ou archivé.", "هذا الحساب موقوف أو مؤرشف.");
    case "INVALID_CREDENTIALS":
      return l("E-mail ou mot de passe incorrect.", "البريد أو كلمة المرور غير صحيحة.");
    default:
      return mode === "signup"
        ? l("Impossible de créer le compte.", "تعذّر إنشاء الحساب.")
        : l("Connexion impossible.", "تعذّر تسجيل الدخول.");
  }
}

export function Login() {
  const { signIn, t, l } = useAcademy();
  const [mode, setMode] = useState<"signin" | "signup" | "check-email">("signin");
  const [pendingEmail, setPendingEmail] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState<"form" | "google" | Role | "resend" | null>(null);
  const demoAllowed = useMemo(() => isDemoAuthAllowed(isSupabaseConfigured), []);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const enterRole = async (role: Role) => {
    if (!demoAllowed) {
      toast.error(l("Le mode démo est désactivé.", "وضع العرض التجريبي معطّل."));
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

  const onLogin = loginForm.handleSubmit(async (values) => {
    setLoading("form");
    try {
      const user = await AuthService.login(values.email, values.password);
      signIn(user);
    } catch (error) {
      toast.error(authErrorMessage(error, l, "signin"));
      setLoading(null);
    }
  });

  const onSignup = signupForm.handleSubmit(async (values) => {
    setLoading("form");
    try {
      const result = await AuthService.signUp({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
      });
      if ("needsEmailConfirmation" in result) {
        setPendingEmail(result.email);
        setMode("check-email");
        setLoading(null);
        return;
      }
      signIn(result);
    } catch (error) {
      toast.error(authErrorMessage(error, l, "signup"));
      setLoading(null);
    }
  });

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

  const resend = async () => {
    if (!pendingEmail) return;
    setLoading("resend");
    try {
      await AuthService.resendConfirmation(pendingEmail);
      toast.success(l("E-mail de confirmation renvoyé.", "أُعيد إرسال رسالة التأكيد."));
    } catch {
      toast.error(l("Impossible de renvoyer l’e-mail.", "تعذّر إعادة إرسال البريد."));
    } finally {
      setLoading(null);
    }
  };

  if (mode === "check-email") {
    return (
      <AuthShell
        title={l("Vérifiez votre e-mail", "تحقق من بريدك")}
        subtitle={l(
          `Nous avons envoyé un lien de confirmation à ${pendingEmail}.`,
          `أرسلنا رابط تأكيد إلى ${pendingEmail}.`,
        )}
      >
        <div className="space-y-3">
          <Button className="h-11 w-full" disabled={loading !== null} onClick={() => void resend()}>
            {loading === "resend" ? <Loader2 className="size-4 animate-spin" /> : null}
            {l("Renvoyer l’e-mail", "إعادة إرسال البريد")}
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => {
              setMode("signin");
              loginForm.setValue("email", pendingEmail);
            }}
          >
            {l("Retour à la connexion", "العودة لتسجيل الدخول")}
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={mode === "signin" ? t("login.title") : l("Créer un compte", "إنشاء حساب")}
      subtitle={
        mode === "signin"
          ? t("login.subtitle")
          : l(
              "Inscription étudiant uniquement. Les comptes professeur / direction sont créés par l’administration.",
              "التسجيل للطلاب فقط. حسابات الأساتذة والإدارة تُنشأ عبر الإدارة.",
            )
      }
    >
      <div
        className="mb-6 inline-flex rounded-lg border border-border p-1"
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

      {mode === "signin" ? (
        <form className="space-y-4" onSubmit={onLogin} noValidate>
          <label className="block text-sm font-medium">
            {t("login.email")}
            <Input
              className="mt-2 h-11"
              type="email"
              autoComplete="email"
              {...loginForm.register("email")}
            />
            {loginForm.formState.errors.email ? (
              <p className="mt-1 text-xs text-alert">{loginForm.formState.errors.email.message}</p>
            ) : null}
          </label>
          <label className="block text-sm font-medium">
            <span className="flex items-center justify-between">
              {t("login.password")}
              <Link to="/auth/forgot-password" className="text-xs font-medium text-primary">
                {t("login.forgot")}
              </Link>
            </span>
            <div className="relative mt-2">
              <Input
                className="h-11 pr-11"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                {...loginForm.register("password")}
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
            {loginForm.formState.errors.password ? (
              <p className="mt-1 text-xs text-alert">
                {loginForm.formState.errors.password.message}
              </p>
            ) : null}
          </label>
          <Button className="h-11 w-full" disabled={loading !== null}>
            {loading === "form" ? t("login.signing") : t("login.submit")}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={onSignup} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              {l("Prénom", "الاسم")}
              <Input
                className="mt-2 h-11"
                autoComplete="given-name"
                {...signupForm.register("firstName")}
              />
              {signupForm.formState.errors.firstName ? (
                <p className="mt-1 text-xs text-alert">
                  {signupForm.formState.errors.firstName.message}
                </p>
              ) : null}
            </label>
            <label className="block text-sm font-medium">
              {l("Nom", "اللقب")}
              <Input
                className="mt-2 h-11"
                autoComplete="family-name"
                {...signupForm.register("lastName")}
              />
              {signupForm.formState.errors.lastName ? (
                <p className="mt-1 text-xs text-alert">
                  {signupForm.formState.errors.lastName.message}
                </p>
              ) : null}
            </label>
          </div>
          <label className="block text-sm font-medium">
            {t("login.email")}
            <Input
              className="mt-2 h-11"
              type="email"
              autoComplete="email"
              {...signupForm.register("email")}
            />
            {signupForm.formState.errors.email ? (
              <p className="mt-1 text-xs text-alert">{signupForm.formState.errors.email.message}</p>
            ) : null}
          </label>
          <label className="block text-sm font-medium">
            {t("login.password")}
            <Input
              className="mt-2 h-11"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              {...signupForm.register("password")}
            />
            {signupForm.formState.errors.password ? (
              <p className="mt-1 text-xs text-alert">
                {signupForm.formState.errors.password.message}
              </p>
            ) : null}
          </label>
          <label className="block text-sm font-medium">
            {l("Confirmer le mot de passe", "تأكيد كلمة المرور")}
            <Input
              className="mt-2 h-11"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              {...signupForm.register("confirmPassword")}
            />
            {signupForm.formState.errors.confirmPassword ? (
              <p className="mt-1 text-xs text-alert">
                {signupForm.formState.errors.confirmPassword.message}
              </p>
            ) : null}
          </label>
          <p className="text-xs text-muted-foreground">
            {l(
              "En créant un compte, vous acceptez les conditions d’utilisation de l’académie.",
              "بإنشاء حساب، فإنك توافق على شروط استخدام الأكاديمية.",
            )}
          </p>
          <Button className="h-11 w-full" disabled={loading !== null}>
            {loading === "form"
              ? l("Création…", "جارٍ الإنشاء…")
              : l("Créer mon compte", "إنشاء حسابي")}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      )}

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
        disabled={loading !== null || !isSupabaseConfigured}
        onClick={() => void google()}
      >
        <GoogleIcon />
        {loading === "google"
          ? l("Redirection…", "جارٍ التحويل…")
          : mode === "signup"
            ? l("S’inscrire avec Google", "التسجيل بواسطة جوجل")
            : l("Continuer avec Google", "المتابعة بواسطة جوجل")}
      </Button>

      {demoAllowed ? (
        <div className="mt-8 border-t border-border pt-6">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {t("login.demo")} (DEV)
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
      ) : null}

      <p className="mt-8 text-center text-xs text-muted-foreground">{t("login.footer")}</p>
    </AuthShell>
  );
}
