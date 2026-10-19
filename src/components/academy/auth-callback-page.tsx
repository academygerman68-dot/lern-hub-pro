import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseAuthService } from "@/services/supabase/auth-service";
import { useAcademy } from "./academy-context";
import { AuthShell } from "./auth-shell";

/**
 * OAuth / email-confirm landing page.
 * Client uses detectSessionInUrl (PKCE); we exchange only if needed, then attach profile.
 */
export function AuthCallbackPage() {
  const { l, signIn, ready } = useAcademy();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const run = async () => {
      if (!isSupabaseConfigured) {
        if (!cancelled) setError("SUPABASE_REQUIRED");
        return;
      }

      try {
        const supabase = getSupabase();
        const url = new URL(window.location.href);

        // Provider / email link errors (e.g. expired OTP, access_denied).
        const oauthError = url.searchParams.get("error") || url.searchParams.get("error_code");
        const oauthDesc = url.searchParams.get("error_description");
        if (oauthError) {
          if (!cancelled) {
            setError(
              oauthDesc?.toLowerCase().includes("expired") ? "LINK_EXPIRED" : "CALLBACK_FAILED",
            );
          }
          return;
        }

        const code = url.searchParams.get("code");
        // detectSessionInUrl may already have consumed the PKCE code — only exchange if needed.
        let auth = await SupabaseAuthService.getSession();
        if (!auth && code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            auth = await SupabaseAuthService.getSession();
            if (!auth) throw exchangeError;
          } else {
            auth = await SupabaseAuthService.getSession();
          }
        }

        if (code) {
          window.history.replaceState({}, document.title, "/auth/callback");
        }

        if (cancelled) return;
        if (!auth) {
          setError("NO_SESSION");
          return;
        }
        signIn(auth.sessionUser, auth.profile);
      } catch {
        if (!cancelled) setError("CALLBACK_FAILED");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [ready, signIn]);

  if (error) {
    const expired = error === "LINK_EXPIRED";
    return (
      <AuthShell
        title={
          expired
            ? l("Lien expiré", "انتهت صلاحية الرابط")
            : l("Connexion interrompue", "تعذّر إكمال الاتصال")
        }
        subtitle={
          expired
            ? l(
                "Demandez un nouvel e-mail de confirmation depuis la page de connexion.",
                "اطلب رسالة تأكيد جديدة من صفحة تسجيل الدخول.",
              )
            : l(
                "Le lien est invalide ou la session n’a pas pu être établie.",
                "الرابط غير صالح أو تعذّر إنشاء الجلسة.",
              )
        }
      >
        <Button asChild className="h-11 w-full">
          <Link to="/">{l("Retour à la connexion", "العودة لتسجيل الدخول")}</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="space-y-3 text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {l("Finalisation de la connexion…", "جارٍ إكمال تسجيل الدخول…")}
        </p>
      </div>
    </div>
  );
}
