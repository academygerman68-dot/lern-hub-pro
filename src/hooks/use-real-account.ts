import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type RealAccountState = {
  checking: boolean;
  /** True only when a genuine authenticated account (not a demo session) is present. */
  authenticated: boolean;
  email: string | null;
};

/**
 * Live classes are restricted to real accounts: a verified Supabase Auth
 * session is required, demo/local sessions never qualify.
 */
export function useRealAccount(): RealAccountState {
  const [state, setState] = useState<RealAccountState>({
    checking: isSupabaseConfigured,
    authenticated: false,
    email: null,
  });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState({ checking: false, authenticated: false, email: null });
      return;
    }
    const supabase = getSupabase();
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setState({
        checking: false,
        authenticated: Boolean(data.user),
        email: data.user?.email ?? null,
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState({
        checking: false,
        authenticated: Boolean(session?.user),
        email: session?.user.email ?? null,
      });
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
