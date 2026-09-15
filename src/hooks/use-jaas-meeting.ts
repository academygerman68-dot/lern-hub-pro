import { useCallback, useEffect, useRef, useState } from "react";
import {
  JaasService,
  JaasServiceError,
  type JaasTokenResponse,
} from "@/services/supabase/jaas-service";

const LIVE_CLASS_KEY = "ga_live_class_id";

/** Persist only the selected class id (never the JWT). */
export function setLiveClassId(classId: string) {
  sessionStorage.setItem(LIVE_CLASS_KEY, classId);
}

export function getLiveClassId(): string | null {
  return sessionStorage.getItem(LIVE_CLASS_KEY);
}

export function clearLiveClassId() {
  sessionStorage.removeItem(LIVE_CLASS_KEY);
}

export function useJaasMeeting(classId: string | null) {
  const [tokenPayload, setTokenPayload] = useState<JaasTokenResponse | null>(null);
  const [error, setError] = useState<JaasServiceError | Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    setTokenPayload(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!classId) {
      reset();
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setTokenPayload(null);

    void (async () => {
      try {
        const payload = await JaasService.createToken(classId);
        if (requestId !== requestIdRef.current) return;
        setTokenPayload(payload);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err : new Error("UNKNOWN_ERROR"));
        setTokenPayload(null);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    })();

    return () => {
      requestIdRef.current += 1;
    };
  }, [classId, nonce, reset]);

  return {
    tokenPayload,
    loading,
    error,
    reset,
    retry: () => setNonce((n) => n + 1),
  };
}
