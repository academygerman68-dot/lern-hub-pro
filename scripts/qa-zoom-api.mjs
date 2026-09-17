import { createClient } from "@supabase/supabase-js";

const URL = "https://omxemusaqgzkogqvcdfw.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9teGVtdXNhcWd6a29ncXZjZGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTQ0MDEsImV4cCI6MjEwNDk3MDQwMX0.xtmsedWtQ5Uen0UEP6j8KTD0aUwI86n_BvL6Lt7uT9w";
const PASSWORD = "Gla-2c35a11966de95";
const TITLE = `[QA-Zoom] A2 Groupe 2 ${new Date().toISOString().slice(0, 16)}`;

const results = [];

function client() {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function login(email) {
  const sb = client();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { sb, user: data.user };
}

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function summarizeUrl(value) {
  if (typeof value !== "string" || !value) return "absent";
  try {
    const url = new URL(value);
    return `présent (${url.host}${url.pathname.startsWith("/s/") ? "/s/…" : url.pathname.replace(/\/\d+.*/, "/…")})`;
  } catch {
    return "présent";
  }
}

async function main() {
  const teacher = await login("teacher@gla.academy");
  const student = await login("student@gla.academy");
  const outsider = await login("student2@gla.academy");

  const { data: classes, error: classErr } = await teacher.sb
    .from("classes")
    .select("id, name, teacher_id, level:levels!classes_level_id_fkey(code)")
    .order("name");
  if (classErr) throw classErr;
  const a2g2 = (classes ?? []).find((row) => {
    const code = Array.isArray(row.level) ? row.level[0]?.code : row.level?.code;
    return code === "A2" && /group\s*2|groupe\s*2/i.test(row.name);
  });
  check("Groupe A2 Groupe 2", Boolean(a2g2), a2g2?.name ?? "introuvable");
  if (!a2g2) throw new Error("missing class");

  const starts = new Date(Date.now() + 30 * 60_000);
  const ends = new Date(starts.getTime() + 2 * 3600_000);
  const sessionId = crypto.randomUUID();
  const room = `academy-${sessionId.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()}`;

  const { error: createErr } = await teacher.sb.from("live_sessions").insert({
    id: sessionId,
    title: TITLE,
    class_id: a2g2.id,
    teacher_id: a2g2.teacher_id,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    meeting_provider: "jitsi",
    meeting_room: room,
    meeting_url: `https://8x8.vc/${room}`,
    video_provider: "jitsi",
    status: "scheduled",
    created_by: teacher.user.id,
  });
  check("Séance QA créée (Jitsi)", !createErr, createErr?.message);

  const first = await teacher.sb.functions.invoke("create-emergency-zoom-meeting", {
    body: { sessionId },
  });
  const firstBody = first.data ?? {};
  check(
    "Création Zoom automatique",
    !first.error && firstBody.ok === true,
    first.error?.message ??
      JSON.stringify({ ok: firstBody.ok, reused: firstBody.reused, error: firstBody.error }),
  );

  const teacherJoin = await teacher.sb.rpc("live_session_join_target", { p_session_id: sessionId });
  const t = teacherJoin.data ?? {};
  check(
    "video_provider / joinTarget professeur = zoom",
    !teacherJoin.error && t.provider === "zoom",
    t.provider,
  );
  check(
    "join_url reçu (professeur)",
    typeof t.url === "string" && t.url.includes("zoom."),
    summarizeUrl(t.url),
  );
  check(
    "start_url reçu (professeur)",
    typeof t.start_url === "string" && t.start_url.includes("zoom."),
    summarizeUrl(t.start_url),
  );

  const studentJoin = await student.sb.rpc("live_session_join_target", { p_session_id: sessionId });
  const s = studentJoin.data ?? {};
  check("Étudiant du groupe = zoom", !studentJoin.error && s.provider === "zoom", s.provider);
  check(
    "Étudiant reçoit join_url",
    typeof s.url === "string" && s.url.includes("zoom."),
    summarizeUrl(s.url),
  );
  check("Étudiant sans start_url", s.start_url == null, summarizeUrl(s.start_url));

  const startSelect = await student.sb
    .from("live_sessions")
    .select("zoom_start_url,zoom_password,zoom_join_url")
    .eq("id", sessionId);
  check(
    "Colonnes hôte masquées en SELECT étudiant",
    Boolean(startSelect.error),
    startSelect.error?.message ?? "colonnes lisibles",
  );

  const outsiderJoin = await outsider.sb.rpc("live_session_join_target", {
    p_session_id: sessionId,
  });
  check(
    "Étudiant hors groupe bloqué",
    Boolean(outsiderJoin.error),
    outsiderJoin.error?.message ?? "accès accordé",
  );

  const outsiderFn = await outsider.sb.functions.invoke("create-emergency-zoom-meeting", {
    body: { sessionId },
  });
  check(
    "Étudiant ne peut pas créer Zoom",
    Boolean(outsiderFn.error) || outsiderFn.data?.ok !== true,
    outsiderFn.error?.message ?? JSON.stringify(outsiderFn.data),
  );

  const [a, b] = await Promise.all([
    teacher.sb.functions.invoke("create-emergency-zoom-meeting", { body: { sessionId } }),
    teacher.sb.functions.invoke("create-emergency-zoom-meeting", { body: { sessionId } }),
  ]);
  const doubleOk = [a, b].every((item) => !item.error && item.data?.ok === true);
  const reused = [a, b].filter((item) => item.data?.reused === true).length;
  check(
    "Double clic : une seule réunion (réutilisation)",
    doubleOk && reused >= 1,
    `reused=${reused}`,
  );

  const { error: revertErr } = await teacher.sb
    .from("live_sessions")
    .update({ video_provider: "jitsi" })
    .eq("id", sessionId);
  check("Retour Jitsi persisté", !revertErr, revertErr?.message);

  const after = await student.sb.rpc("live_session_join_target", { p_session_id: sessionId });
  check(
    "Après retour, étudiant = Jitsi sans start_url",
    after.data?.provider === "jitsi" && after.data?.start_url == null,
    after.data?.provider,
  );

  await teacher.sb.from("live_sessions").update({ status: "cancelled" }).eq("id", sessionId);

  const failed = results.filter((row) => !row.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
