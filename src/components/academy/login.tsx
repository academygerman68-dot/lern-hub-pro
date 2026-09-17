import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Shield,
  UserRound,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthRedirects, isDemoAuthAllowed } from "@/lib/auth-config";
import { loginSchema, signupSchema, type LoginValues, type SignupValues } from "@/lib/auth-schemas";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getTestAccountPassword,
  isTestLoginAllowed,
  TEST_QUICK_ACCOUNTS,
  type TestQuickAccount,
} from "@/data/test-accounts";
import { AuthService } from "@/services/academy-services";
import { AuthError } from "@/services/supabase/auth-service";
import type { Role } from "@/types/academy";
import { useAcademy } from "./academy-context";
import { AuthShell, GoogleIcon } from "./auth-shell";
import { LoginShell } from "./login-shell";

const RESEND_COOLDOWN_SECONDS = 60;

function RoleIcon({ role }: { role: Role }) {
  if (role === "teacher") return <GraduationCap className="size-5" aria-hidden />;
  if (role === "director") return <Shield className="size-5" aria-hidden />;
  return <UserRound className="size-5" aria-hidden />;
}

function authErrorMessage(
  error: unknown,
  l: (fr: string, ar: string) => string,
  mode: "signin" | "signup" | "resend",
): string {
  const code =
    error instanceof AuthError
      ? error.code
      : error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : error instanceof Error
          ? error.message
          : "";
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
    case "EMAIL_RATE_LIMIT":
      return l(
        "Trop de demandes. Attendez environ 1 minute avant de renvoyer l’e-mail.",
        "طلبات كثيرة. انتظر دقيقة تقريبًا قبل إعادة الإرسال.",
      );
    default:
      if (mode === "resend") {
        return l("Impossible de renvoyer l’e-mail.", "تعذّر إعادة إرسال البريد.");
      }
      return mode === "signup"
        ? l("Impossible de créer le compte.", "تعذّر إنشاء الحساب.")
        : l("Connexion impossible.", "تعذّر تسجيل الدخول.");
  }
}

function QuickRoleSections({
  loading,
  activeEmail,
  onEnter,
  l,
}: {
  loading: boolean;
  activeEmail: string | null;
  onEnter: (account: TestQuickAccount) => void;
  l: (fr: string, ar: string) => string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {l("Choisir un profil", "اختر ملفًا")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {l(
            "Accès rapide pour les tests — chaque bouton ouvre le tableau de bord du rôle.",
            "دخول سريع للاختبار — كل زر يفتح لوحة الدور.",
          )}
        </p>
      </div>
      <div className="grid gap-3">
        {TEST_QUICK_ACCOUNTS.map((account) => {
          const busy = loading && activeEmail === account.email;
          return (
            <button
              key={account.email}
              type="button"
              disabled={loading}
              onClick={() => onEnter(account)}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left transition-colors hover:border-primary/40 hover:bg-soft-blue/40 disabled:opacity-60"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-soft-blue text-primary">
                {busy ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <RoleIcon role={account.role} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-foreground">
                  {l(account.labelFr, account.labelAr)}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {l(account.descriptionFr, account.descriptionAr)}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Login() {
  const { signIn, t, l } = useAcademy();
  const [mode, setMode] = useState<"signin" | "signup" | "check-email">("signin");
  const [pendingEmail, setPendingEmail] = useState("");
  const [show, setShow] = useState(false);
  const [loginError, setLoginError] = useState<unknown>(null);
  const [loading, setLoading] = useState<"form" | "google" | Role | "resend" | "test" | null>(null);
  const [activeTestEmail, setActiveTestEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const demoAllowed = useMemo(() => isDemoAuthAllowed(isSupabaseConfigured), []);
  const testLoginAllowed = useMemo(() => isTestLoginAllowed() && isSupabaseConfigured, []);
  const confirmRedirect = useMemo(() => getAuthRedirects().callback, []);

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
      phone: "",
      password: "",
      confirmPassword: "",
      role: "student",
    },
  });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

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

  const enterTestAccount = async (account: TestQuickAccount) => {
    if (!testLoginAllowed) {
      toast.error(l("Connexion rapide désactivée.", "تسجيل الدخول السريع معطّل."));
      return;
    }
    setLoading("test");
    setActiveTestEmail(account.email);
    try {
      const user = await AuthService.login(account.email, getTestAccountPassword());
      signIn(user);
    } catch (error) {
      toast.error(authErrorMessage(error, l, "signin"));
      setLoading(null);
      setActiveTestEmail(null);
    }
  };

  const onLogin = loginForm.handleSubmit(async (values) => {
    setLoginError(null);
    setLoading("form");
    try {
      const user = await AuthService.login(values.email, values.password);
      signIn(user);
    } catch (error) {
      setLoginError(error);
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
        role: values.role,
        ...(values.phone?.trim() ? { phone: values.phone.trim() } : {}),
      });
      if ("needsEmailConfirmation" in result) {
        setPendingEmail(result.email);
        setMode("check-email");
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
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
    if (!pendingEmail || resendCooldown > 0) return;
    setLoading("resend");
    try {
      await AuthService.resendConfirmation(pendingEmail);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(l("E-mail de confirmation renvoyé.", "أُعيد إرسال رسالة التأكيد."));
    } catch (error) {
      toast.error(authErrorMessage(error, l, "resend"));
      if (error instanceof AuthError && error.code === "EMAIL_RATE_LIMIT") {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      }
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
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {l(
              `Le lien doit ouvrir : ${confirmRedirect}. Si le mail ouvre localhost, ajoutez cette URL dans Supabase → Authentication → URL Configuration (Site URL + Redirect URLs).`,
              `يجب أن يفتح الرابط: ${confirmRedirect}. إذا فتح localhost، أضف هذا العنوان في Supabase → Authentication → URL Configuration.`,
            )}
          </p>
          <Button
            className="h-11 w-full"
            disabled={loading !== null || resendCooldown > 0}
            onClick={() => void resend()}
          >
            {loading === "resend" ? <Loader2 className="size-4 animate-spin" /> : null}
            {resendCooldown > 0
              ? l(`Renvoyer dans ${resendCooldown}s`, `إعادة الإرسال بعد ${resendCooldown}ث`)
              : l("Renvoyer l’e-mail", "إعادة إرسال البريد")}
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

  const Shell = mode === "signin" ? LoginShell : AuthShell;
  return (
    <Shell
      title={
        mode === "signin"
          ? l("Heureux de vous retrouver.", "سعداء بعودتك.")
          : l("Créer un compte", "إنشاء حساب")
      }
      subtitle={
        mode === "signin"
          ? l(
              "Connectez-vous pour poursuivre votre parcours avec German Academy.",
              "سجّل دخولك لمواصلة رحلتك مع German Academy.",
            )
          : l(
              "Inscription étudiant uniquement. Les comptes professeur / direction sont créés par l’administration.",
              "التسجيل للطلاب فقط. حسابات الأساتذة والإدارة تُنشأ عبر الإدارة.",
            )
      }
    >
      {mode === "signup" && (
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
      )}

      {mode === "signin" && (
        <>
          <form
            className="gla-login-form"
            onSubmit={onLogin}
            noValidate
            aria-busy={loading === "form"}
          >
            {loginError !== null && (
              <div className="gla-login-error gla-login-error-banner" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{authErrorMessage(loginError, l, "signin")}</span>
              </div>
            )}
            <div className="gla-login-field">
              <label htmlFor="gla-login-email">{l("Adresse e-mail", "البريد الإلكتروني")}</label>
              <Input
                id="gla-login-email"
                className="gla-login-input"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder={l("vous@exemple.com", "name@example.com")}
                dir="ltr"
                aria-invalid={Boolean(loginForm.formState.errors.email)}
                aria-describedby={loginForm.formState.errors.email ? "gla-email-error" : undefined}
                {...loginForm.register("email")}
              />
              {loginForm.formState.errors.email && (
                <p id="gla-email-error" className="gla-login-error" role="alert">
                  {l("Saisissez une adresse e-mail valide.", "أدخل بريدًا إلكترونيًا صالحًا.")}
                </p>
              )}
            </div>
            <div className="gla-login-field">
              <label htmlFor="gla-login-password">{l("Mot de passe", "كلمة المرور")}</label>
              <div className="gla-login-input-wrap">
                <Input
                  id="gla-login-password"
                  className="gla-login-input gla-login-password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={l("Votre mot de passe", "كلمة المرور الخاصة بك")}
                  aria-invalid={Boolean(loginForm.formState.errors.password)}
                  aria-describedby={
                    loginForm.formState.errors.password ? "gla-password-error" : undefined
                  }
                  {...loginForm.register("password")}
                />
                <button
                  type="button"
                  className="gla-login-eye"
                  onClick={() => setShow((value) => !value)}
                  aria-controls="gla-login-password"
                  aria-pressed={show}
                  aria-label={
                    show
                      ? l("Masquer le mot de passe", "إخفاء كلمة المرور")
                      : l("Afficher le mot de passe", "إظهار كلمة المرور")
                  }
                >
                  {show ? (
                    <EyeOff size={17} aria-hidden="true" />
                  ) : (
                    <Eye size={17} aria-hidden="true" />
                  )}
                </button>
              </div>
              {loginForm.formState.errors.password && (
                <p id="gla-password-error" className="gla-login-error" role="alert">
                  {l("Saisissez votre mot de passe.", "أدخل كلمة المرور.")}
                </p>
              )}
              <div className="gla-login-forgot">
                <Link to="/auth/forgot-password">
                  {l("Mot de passe oublié ?", "نسيت كلمة المرور؟")}
                </Link>
              </div>
            </div>
            <Button className="gla-login-submit" type="submit" disabled={loading !== null}>
              {loading === "form" ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span role="status">{l("Connexion en cours…", "جارٍ تسجيل الدخول…")}</span>
                </>
              ) : (
                <>
                  {l("Se connecter", "تسجيل الدخول")}
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
          <div className="gla-login-divider">{l("ou continuer avec", "أو المتابعة بواسطة")}</div>
          <Button
            type="button"
            variant="outline"
            className="gla-login-google"
            disabled={loading !== null || !isSupabaseConfigured}
            onClick={() => void google()}
          >
            {loading === "google" ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <GoogleIcon />
            )}
            {loading === "google"
              ? l("Redirection…", "جارٍ التحويل…")
              : l("Continuer avec Google", "المتابعة بواسطة جوجل")}
          </Button>
          <p className="gla-login-register">
            {l("Vous découvrez l’académie ?", "جديد في الأكاديمية؟")}
            <button type="button" disabled={loading !== null} onClick={() => setMode("signup")}>
              {l("Créer un compte", "إنشاء حساب")}
            </button>
          </p>
          {testLoginAllowed && (
            <details className="gla-login-tests">
              <summary>{l("Accès de démonstration", "الدخول التجريبي")}</summary>
              <QuickRoleSections
                loading={loading !== null}
                activeEmail={activeTestEmail}
                onEnter={(account) => void enterTestAccount(account)}
                l={l}
              />
            </details>
          )}
        </>
      )}

      {mode === "signup" ? (
        <>
          <form className="space-y-4" onSubmit={onSignup} noValidate>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{l("Type de compte", "نوع الحساب")}</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["student", "Étudiant", "طالب"],
                    ["teacher", "Professeur", "أستاذ"],
                    ["admin", "Admin", "إدارة"],
                  ] as const
                ).map(([value, fr, ar]) => {
                  const selected = signupForm.watch("role") === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                        selected
                          ? "border-primary bg-primary/5 font-medium text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                      onClick={() => signupForm.setValue("role", value, { shouldValidate: true })}
                    >
                      {l(fr, ar)}
                    </button>
                  );
                })}
              </div>
              {signupForm.formState.errors.role ? (
                <p className="text-xs text-alert">{signupForm.formState.errors.role.message}</p>
              ) : null}
            </fieldset>
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
                <p className="mt-1 text-xs text-alert">
                  {signupForm.formState.errors.email.message}
                </p>
              ) : null}
            </label>
            {signupForm.watch("role") === "student" ? (
              <label className="block text-sm font-medium">
                {l("Téléphone", "الهاتف")}
                <Input
                  className="mt-2 h-11"
                  type="tel"
                  autoComplete="tel"
                  {...signupForm.register("phone")}
                />
                {signupForm.formState.errors.phone ? (
                  <p className="mt-1 text-xs text-alert">
                    {signupForm.formState.errors.phone.message}
                  </p>
                ) : null}
              </label>
            ) : null}
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
            <Button className="h-11 w-full" disabled={loading !== null}>
              {loading === "form"
                ? l("Création…", "جارٍ الإنشاء…")
                : l("Créer mon compte", "إنشاء حسابي")}
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
            disabled={loading !== null || !isSupabaseConfigured}
            onClick={() => void google()}
          >
            <GoogleIcon />
            {loading === "google"
              ? l("Redirection…", "جارٍ التحويل…")
              : l("S’inscrire avec Google", "التسجيل بواسطة جوجل")}
          </Button>
        </>
      ) : null}

      {demoAllowed ? (
        <div className="mt-8 border-t border-border pt-6">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {t("login.demo")} (DEV offline)
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

      {mode !== "signin" && (
        <p className="mt-8 text-center text-xs text-muted-foreground">{t("login.footer")}</p>
      )}
    </Shell>
  );
}
