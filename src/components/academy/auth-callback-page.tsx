import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseAuthService } from "@/services/supabase/auth-service";
import { useAcademy } from "./academy-context";
import { AuthShell } from "./auth-shell";

/**
 * OAuth / email-confirm landing page.
 * Supabase client uses detectSessionInUrl; we wait for session + profile then redirect.
 */
export function AuthCallbackPage() {
  const { l, signIn, ready } = useAcademy();
  const navigate = useNavigate();
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
        // Exchange code if present (PKCE).
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const auth = await SupabaseAuthService.getSession();
        if (cancelled) return;
        if (!auth) {
          setError("NO_SESSION");
          return;
        }
        signIn(auth.sessionUser);
      } catch {
        if (!cancelled) setError("CALLBACK_FAILED");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [ready, signIn, navigate]);

  if (error) {
    return (
      <AuthShell
        title={l("Connexion interrompue", "تعذّر إكمال الاتصال")}
        subtitle={l(
          "Le lien est invalide ou la session n’a pas pu être établie.",
          "الرابط غير صالح أو تعذّر إنشاء الجلسة.",
        )}
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
