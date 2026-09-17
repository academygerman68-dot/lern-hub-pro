import { createClient } from "@supabase/supabase-js";

const URL = "https://omxemusaqgzkogqvcdfw.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9teGVtdXNhcWd6a29ncXZjZGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTQ0MDEsImV4cCI6MjEwNDk3MDQwMX0.xtmsedWtQ5Uen0UEP6j8KTD0aUwI86n_BvL6Lt7uT9w";
const PASSWORD = "Gla-2c35a11966de95";
const ZOOM_URL = "https://zoom.us/j/5551234567";
const TITLE = `[QA-Live] A2 Groupe 2 ${new Date().toISOString().slice(0, 16)}`;

const results = [];

function client() {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function login(email) {
  const sb = client();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { sb, user: data.user };
}

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "OK" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function joinTarget(sb, sessionId) {
  const { data, error } = await sb.rpc("live_session_join_target", { p_session_id: sessionId });
  return { data, error };
}

async function main() {
  const teacher = await login("teacher@gla.academy");
  const student = await login("student@gla.academy");
  const outsider = await login("student2@gla.academy");
  const admin = await login("admin@gla.academy");

  const { data: classes, error: classErr } = await teacher.sb
    .from("classes")
    .select("id, name, teacher_id, level:levels!classes_level_id_fkey(code)")
    .order("name");
  if (classErr) throw classErr;

  const a2g2 = (classes ?? []).find((row) => {
    const code = Array.isArray(row.level) ? row.level[0]?.code : row.level?.code;
    return code === "A2" && /group\s*2|groupe\s*2/i.test(row.name);
  });
  check("Groupe A2 Groupe 2 trouvé", Boolean(a2g2), a2g2 ? a2g2.name : "introuvable");
  if (!a2g2) throw new Error("A2 Group 2 class missing");

  const starts = new Date(Date.now() + 2 * 60_000);
  const ends = new Date(starts.getTime() + 2 * 3600_000);
  const sessionId = crypto.randomUUID();
  const room = `academy-${sessionId.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()}`;

  const { data: created, error: createErr } = await teacher.sb
    .from("live_sessions")
    .insert({
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
    })
    .select("id, video_provider, meeting_room")
    .single();
  check("Professeur crée la séance Jitsi", !createErr && created?.video_provider === "jitsi", createErr?.message);

  const teacherJoin = await joinTarget(teacher.sb, sessionId);
  check(
    "Professeur joinTarget = jitsi",
    !teacherJoin.error && teacherJoin.data?.provider === "jitsi",
    teacherJoin.error?.message ?? teacherJoin.data?.provider,
  );

  const studentJoinJitsi = await joinTarget(student.sb, sessionId);
  check(
    "Étudiant A2 Groupe 2 joinTarget = jitsi",
    !studentJoinJitsi.error && studentJoinJitsi.data?.provider === "jitsi",
    studentJoinJitsi.error?.message ?? studentJoinJitsi.data?.provider,
  );
  check(
    "Étudiant ne reçoit pas zoom_url tant que Jitsi est actif",
    studentJoinJitsi.data?.zoom_url == null,
    JSON.stringify(studentJoinJitsi.data?.zoom_url),
  );

  const { error: zoomErr } = await teacher.sb
    .from("live_sessions")
    .update({ video_provider: "zoom", zoom_url: ZOOM_URL })
    .eq("id", sessionId);
  check("Professeur active Zoom d’urgence", !zoomErr, zoomErr?.message);

  const { data: persisted } = await teacher.sb
    .from("live_sessions")
    .select("id, video_provider")
    .eq("id", sessionId)
    .single();
  check("video_provider persisté = zoom", persisted?.video_provider === "zoom", persisted?.video_provider);

  const { error: zoomColErr } = await student.sb.from("live_sessions").select("zoom_url").eq("id", sessionId);
  check(
    "Colonne zoom_url masquée en SELECT étudiant",
    Boolean(zoomColErr),
    zoomColErr?.message ?? "colonne lisible",
  );

  const studentJoinZoom = await joinTarget(student.sb, sessionId);
  check(
    "Étudiant A2 rejoint Zoom sans changer son compte",
    !studentJoinZoom.error &&
      studentJoinZoom.data?.provider === "zoom" &&
      studentJoinZoom.data?.url === ZOOM_URL,
    studentJoinZoom.error?.message ?? JSON.stringify(studentJoinZoom.data),
  );

  const outsiderJoin = await joinTarget(outsider.sb, sessionId);
  check(
    "Étudiant hors groupe : accès Zoom refusé",
    Boolean(outsiderJoin.error) && /SESSION_ACCESS_DENIED|not authorized|autorisé/i.test(outsiderJoin.error?.message ?? ""),
    outsiderJoin.error?.message ?? "accès accordé à tort",
  );

  const { data: outsiderList } = await outsider.sb.from("live_sessions").select("id").eq("id", sessionId);
  check("Étudiant hors groupe ne voit pas la séance", !outsiderList?.length, `rows=${outsiderList?.length ?? 0}`);

  const adminJoin = await joinTarget(admin.sb, sessionId);
  check(
    "Admin voit le fournisseur Zoom",
    !adminJoin.error && adminJoin.data?.provider === "zoom",
    adminJoin.error?.message ?? adminJoin.data?.provider,
  );

  const { error: revertErr } = await teacher.sb
    .from("live_sessions")
    .update({ video_provider: "jitsi" })
    .eq("id", sessionId);
  check("Professeur revient à Jitsi", !revertErr, revertErr?.message);

  const studentJoinBack = await joinTarget(student.sb, sessionId);
  check(
    "Après retour, étudiant rejoint Jitsi",
    !studentJoinBack.error && studentJoinBack.data?.provider === "jitsi",
    studentJoinBack.error?.message ?? studentJoinBack.data?.provider,
  );
  check(
    "Lien Zoom conservé hors vue étudiant",
    studentJoinBack.data?.zoom_url == null && studentJoinBack.data?.url !== ZOOM_URL,
    JSON.stringify(studentJoinBack.data),
  );

  const teacherJoinBack = await joinTarget(teacher.sb, sessionId);
  check(
    "Professeur conserve le lien Zoom pour traçabilité",
    teacherJoinBack.data?.provider === "jitsi" && teacherJoinBack.data?.zoom_url === ZOOM_URL,
    JSON.stringify(teacherJoinBack.data),
  );

  await teacher.sb.from("live_sessions").update({ status: "cancelled" }).eq("id", sessionId);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
