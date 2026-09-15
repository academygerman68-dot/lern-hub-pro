import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/auth-schemas";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { AuthService } from "@/services/academy-services";
import { useAcademy } from "./academy-context";
import { AuthShell } from "./auth-shell";

export function ResetPasswordPage() {
  const { l, signOut } = useAcademy();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [loading, setLoading] = useState(false);
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setHasRecoverySession(false);
          setReady(true);
        }
        return;
      }
      const supabase = getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) {
        setHasRecoverySession(Boolean(session));
        setReady(true);
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    try {
      await AuthService.updatePassword(values.password);
      toast.success(l("Mot de passe mis à jour.", "تم تحديث كلمة المرور."));
      await signOut();
      void navigate({ to: "/" });
    } catch {
      toast.error(l("Impossible de mettre à jour le mot de passe.", "تعذّر تحديث كلمة المرور."));
      setLoading(false);
    }
  });

  if (!ready) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!hasRecoverySession) {
    return (
      <AuthShell
        title={l("Lien invalide ou expiré", "رابط غير صالح أو منتهٍ")}
        subtitle={l(
          "Demandez un nouveau lien de réinitialisation.",
          "اطلب رابط إعادة تعيين جديدًا.",
        )}
      >
        <Button asChild className="h-11 w-full">
          <Link to="/auth/forgot-password">{l("Demander un lien", "طلب رابط")}</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={l("Nouveau mot de passe", "كلمة مرور جديدة")}
      subtitle={l(
        "Choisissez un mot de passe solide (8+ caractères, lettres et chiffres).",
        "اختر كلمة مرور قوية (8+ أحرف وأرقام).",
      )}
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <label className="block text-sm font-medium">
          {l("Nouveau mot de passe", "كلمة المرور الجديدة")}
          <Input
            className="mt-2 h-11"
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="mt-1 text-xs text-alert">{form.formState.errors.password.message}</p>
          ) : null}
        </label>
        <label className="block text-sm font-medium">
          {l("Confirmer", "تأكيد")}
          <Input
            className="mt-2 h-11"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="mt-1 text-xs text-alert">
              {form.formState.errors.confirmPassword.message}
            </p>
          ) : null}
        </label>
        <Button className="h-11 w-full" disabled={loading}>
          {loading
            ? l("Enregistrement…", "جارٍ الحفظ…")
            : l("Enregistrer le mot de passe", "حفظ كلمة المرور")}
        </Button>
      </form>
    </AuthShell>
  );
}
