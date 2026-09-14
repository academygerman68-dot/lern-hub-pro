import { useState } from "react";
import { ArrowRight, BookOpen, Building2, Eye, EyeOff, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localeLabels } from "@/lib/i18n";
import { AuthService } from "@/services/academy-services";
import type { Locale, Role } from "@/types/academy";
import { useAcademy } from "./academy-context";

const demos: { role: Role; name: string; icon: typeof GraduationCap }[] = [
  { role: "student", name: "Ahmed Benali", icon: GraduationCap },
  { role: "teacher", name: "Anna Schneider", icon: BookOpen },
  { role: "director", name: "Samira El Mansouri", icon: Building2 },
];

export function Login() {
  const { signIn, t, locale, setLocale } = useAcademy();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState<Role | "form" | null>(null);
  const [email, setEmail] = useState("ahmed@demo.ma");
  const [password, setPassword] = useState("password");

  const enterRole = async (role: Role) => {
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
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[0.92fr_1.08fr]">
      <section className="relative hidden overflow-hidden bg-brand lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3 text-primary-foreground">
          <span className="grid size-10 place-items-center rounded-lg bg-primary-foreground/10">
            <GraduationCap />
          </span>
          <span className="font-display text-xl font-semibold">Deutsch Academy</span>
        </div>
        <div className="max-w-xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-primary-foreground/60">
            {t("brand.tagline")}
          </p>
          <h1 className="font-display text-5xl font-semibold leading-tight text-primary-foreground">
            Your complete German learning experience.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-primary-foreground/70">
            Courses, live classes, exams and progress — one focused place from A1 to B2.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 border-t border-primary-foreground/15 pt-6 text-primary-foreground">
          <div>
            <strong className="block text-2xl">243</strong>
            <span className="text-xs text-primary-foreground/60">active learners</span>
          </div>
          <div>
            <strong className="block text-2xl">91%</strong>
            <span className="text-xs text-primary-foreground/60">attendance</span>
          </div>
          <div>
            <strong className="block text-2xl">4.8/5</strong>
            <span className="text-xs text-primary-foreground/60">satisfaction</span>
          </div>
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-end gap-1">
            {(["en", "fr", "de"] as Locale[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={`rounded-md px-2 py-1 text-xs font-medium ${locale === code ? "bg-secondary text-primary" : "text-muted-foreground"}`}
              >
                {localeLabels[code]}
              </button>
            ))}
          </div>
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap />
            </span>
            <span className="font-display text-xl font-semibold">Deutsch Academy</span>
          </div>
          <p className="text-sm font-semibold text-primary">{t("login.welcome")}</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">{t("login.title")}</h2>
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              {t("login.password")}
              <div className="relative mt-2">
                <Input
                  className="h-11 pr-11"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label="Show password"
                  className="absolute right-3 top-3 text-muted-foreground"
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
            <div className="text-right">
              <button
                type="button"
                className="text-sm font-medium text-primary"
                onClick={() => {
                  void AuthService.requestReset(email).then(() => toast.success(t("login.reset")));
                }}
              >
                {t("login.forgot")}
              </button>
            </div>
            <Button className="h-11 w-full" disabled={loading !== null}>
              {loading ? t("login.signing") : t("login.submit")}
              <ArrowRight />
            </Button>
          </form>
          <div className="my-7 flex items-center gap-4 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            {t("login.demo")}
          </div>
          <div className="space-y-2">
            {demos.map(({ role, name, icon: Icon }) => (
              <button
                key={role}
                onClick={() => void enterRole(role)}
                className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-accent"
              >
                <span className="grid size-9 place-items-center rounded-md bg-secondary text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="flex-1">
                  <strong className="block text-sm">{t(`role.${role}`)}</strong>
                  <span className="text-xs text-muted-foreground">{name}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">{t("login.footer")}</p>
        </div>
      </section>
    </main>
  );
}
