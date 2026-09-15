import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type JaasTokenResponse = {
  token: string;
  appId: string;
  roomName: string;
  classId: string;
  className: string;
  role: "admin" | "teacher" | "student";
  moderator: boolean;
  expiresIn: number;
  domain: string;
};

export class JaasServiceError extends Error {
  status: number;
  code: string;

  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.name = "JaasServiceError";
    this.code = code;
    this.status = status;
  }
}

function mapHttpStatus(status: number): string {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 400) return "INVALID_REQUEST";
  if (status === 404) return "NOT_FOUND";
  if (status >= 500) return "SERVER_ERROR";
  return "REQUEST_FAILED";
}

/**
 * Requests a short-lived JaaS JWT from the deployed Edge Function.
 * Never sends or receives the RSA private key.
 */
export const JaasService = {
  async createToken(classId: string): Promise<JaasTokenResponse> {
    if (!isSupabaseConfigured) {
      throw new JaasServiceError("SUPABASE_REQUIRED", 503);
    }
    if (!classId.trim()) {
      throw new JaasServiceError("CLASS_ID_REQUIRED", 400);
    }

    const supabase = getSupabase();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new JaasServiceError("UNAUTHORIZED", 401, "Session expired. Please sign in again.");
    }

    const { data, error } = await supabase.functions.invoke<JaasTokenResponse | { error?: string }>(
      "jaas-token",
      {
        body: { classId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    if (error) {
      if (error instanceof FunctionsHttpError) {
        let code = mapHttpStatus(error.context.status);
        try {
          const payload = (await error.context.json()) as { error?: string };
          if (payload?.error) code = payload.error;
        } catch {
          // ignore body parse failures
        }
        throw new JaasServiceError(code, error.context.status);
      }
      throw new JaasServiceError("REQUEST_FAILED", 500, error.message);
    }

    if (!data || typeof data !== "object" || !("token" in data) || !data.token) {
      const code =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "INVALID_RESPONSE";
      throw new JaasServiceError(code, 500);
    }

    return data as JaasTokenResponse;
  },
};
