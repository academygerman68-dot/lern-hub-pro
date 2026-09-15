import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/auth-schemas";
import { AuthService } from "@/services/academy-services";
import { useAcademy } from "./academy-context";
import { AuthShell } from "./auth-shell";

export function ForgotPasswordPage() {
  const { l } = useAcademy();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    try {
      await AuthService.requestReset(values.email);
      setSent(true);
    } catch {
      toast.error(l("Impossible d’envoyer le lien.", "تعذّر إرسال الرابط."));
    } finally {
      setLoading(false);
    }
  });

  if (sent) {
    return (
      <AuthShell
        title={l("E-mail envoyé", "تم إرسال البريد")}
        subtitle={l(
          "Si un compte existe pour cette adresse, vous recevrez un lien de réinitialisation.",
          "إذا وُجد حساب بهذا البريد، ستصلك رسالة لإعادة التعيين.",
        )}
      >
        <Button asChild className="h-11 w-full">
          <Link to="/">{l("Retour à la connexion", "العودة لتسجيل الدخول")}</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={l("Mot de passe oublié", "نسيت كلمة المرور")}
      subtitle={l(
        "Entrez votre e-mail pour recevoir un lien sécurisé.",
        "أدخل بريدك لتلقي رابط آمن.",
      )}
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <label className="block text-sm font-medium">
          {l("E-mail", "البريد الإلكتروني")}
          <Input
            className="mt-2 h-11"
            type="email"
            autoComplete="email"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="mt-1 text-xs text-alert">{form.formState.errors.email.message}</p>
          ) : null}
        </label>
        <Button className="h-11 w-full" disabled={loading}>
          {loading ? l("Envoi…", "جارٍ الإرسال…") : l("Envoyer le lien", "إرسال الرابط")}
        </Button>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link to="/">{l("Annuler", "إلغاء")}</Link>
        </Button>
      </form>
    </AuthShell>
  );
}
