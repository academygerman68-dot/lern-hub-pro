import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const deleteAccountErrors: Record<string, string> = {
  LAST_ADMIN: "Impossible de supprimer ce compte : c’est le dernier administrateur de l’académie.",
  CONFIRMATION_REQUIRED: "Saisissez SUPPRIMER pour confirmer la suppression.",
  UNAUTHORIZED: "Session expirée. Reconnectez-vous puis réessayez.",
  PROFILE_NOT_FOUND: "Compte introuvable.",
  DELETE_FAILED: "La suppression a échoué. Réessayez ou contactez le support.",
  SERVICE_UNAVAILABLE: "Le service est temporairement indisponible. Réessayez plus tard.",
  METHOD_NOT_ALLOWED: "Action non autorisée.",
};

function mapDeleteError(code: string | undefined): string {
  if (!code) return deleteAccountErrors["DELETE_FAILED"]!;
  return deleteAccountErrors[code] ?? deleteAccountErrors["DELETE_FAILED"]!;
}

async function readFunctionError(error: { message?: string; context?: Response }): Promise<string> {
  try {
    const ctx = error.context;
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json()) as { error?: string; message?: string };
      if (body.error) return mapDeleteError(body.error);
      if (body.message) return body.message;
    }
  } catch {
    // fall through
  }
  return mapDeleteError("DELETE_FAILED");
}

export const AccountDeletionService = {
  async deleteOwnAccount(confirmation: string): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error("La suppression de compte n’est pas disponible pour le moment.");
    }
    if (confirmation.trim() !== "SUPPRIMER") {
      throw new Error(mapDeleteError("CONFIRMATION_REQUIRED"));
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean;
      error?: string;
    }>("delete-own-account", {
      body: { confirmation: "SUPPRIMER" },
    });

    if (error) throw new Error(await readFunctionError(error));
    if (data?.error) throw new Error(mapDeleteError(data.error));
    if (!data?.ok) throw new Error(mapDeleteError("DELETE_FAILED"));
  },
};
