/**
 * JaaS JWT minting Edge Function.
 * Secrets (Dashboard → Edge Functions → Secrets, NEVER VITE_*):
 *   JAAS_APP_ID, JAAS_KEY_ID, JAAS_PRIVATE_KEY
 *
 * Returns 503 with configured:false when secrets are missing.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const appId = Deno.env.get("JAAS_APP_ID");
  const keyId = Deno.env.get("JAAS_KEY_ID");
  const privateKey = Deno.env.get("JAAS_PRIVATE_KEY");

  if (!appId || !keyId || !privateKey) {
    return new Response(
      JSON.stringify({
        configured: false,
        error: "JaaS non configuré",
        required: ["JAAS_APP_ID", "JAAS_KEY_ID", "JAAS_PRIVATE_KEY"],
      }),
      { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const roomName = typeof body.roomName === "string" ? body.roomName : null;
  if (!roomName) {
    return new Response(JSON.stringify({ error: "roomName required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // JWT minting requires a crypto library in Deno; stub response documents the contract.
  // When wiring a real JaaS account, replace with RS256 JWT (nbf/exp/room/context.user).
  return new Response(
    JSON.stringify({
      configured: true,
      domain: `8x8.vc`,
      appId,
      roomName,
      // Placeholder — implement JWT with JAAS_PRIVATE_KEY before production use.
      jwt: null,
      message: "Secrets présents. Implémenter le JWT RS256 avant mise en production JaaS.",
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
