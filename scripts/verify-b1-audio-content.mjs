/**
 * Audio content verification pass for B1 Hören tracks.
 * Uses duration plausibility + optional ffmpeg segment; does NOT set
 * content_verified without Teil announcement evidence.
 *
 * Usage: node scripts/verify-b1-audio-content.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = "omxemusaqgzkogqvcdfw";
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
const INV = resolve(__dirname, "../tmp/b1-audio-inventory.json");

/** Expected duration bands (seconds) from local inventory medians (WhatsApp B1 set). */
const BANDS = {
  1: [500, 900], // long dialogues
  2: [220, 400], // shorter
  3: [200, 320], // shortest
  4: [700, 1000], // longest lecture-like
};

function loadServiceRole() {
  const res = spawnSync(
    "supabase",
    ["projects", "api-keys", "--project-ref", PROJECT_REF, "-o", "json"],
    { encoding: "utf8", shell: true },
  );
  let raw = (res.stdout || "").trim();
  const start = raw.indexOf("[");
  raw = raw.slice(start);
  raw = raw.slice(0, raw.lastIndexOf("]") + 1);
  const list = JSON.parse(raw);
  const service = list.find((k) => k.id === "service_role" || k.name === "service_role");
  if (!service?.api_key) throw new Error("service_role missing");
  return service.api_key;
}

function asMeta(m) {
  return m && typeof m === "object" && !Array.isArray(m) ? m : {};
}

async function main() {
  const key = loadServiceRole();
  const supabase = createClient(PROJECT_URL, key, { auth: { persistSession: false } });
  const inventory = existsSync(INV) ? JSON.parse(await import("node:fs").then((fs) => fs.readFileSync(INV, "utf8"))) : null;

  const { data: exams, error } = await supabase
    .from("exams")
    .select(
      "id, code, sections:exam_sections(id, skill, questions:exam_questions(id, media_path, media_bucket, metadata))",
    )
    .like("code", "B1-MT%")
    .order("code");
  if (error) throw error;

  const results = [];
  let contentVerified = 0;
  let needsReview = 0;
  let invalid = 0;

  for (const exam of exams || []) {
    const hoeren = (exam.sections || []).find((s) => s.skill === "hoeren");
    const bySlot = new Map();
    for (const q of hoeren?.questions || []) {
      const meta = asMeta(q.metadata);
      const slot = Number(meta.audio_slot);
      if (![1, 2, 3, 4].includes(slot)) continue;
      if (!bySlot.has(slot)) bySlot.set(slot, { path: q.media_path, meta, questionIds: [] });
      bySlot.get(slot).questionIds.push(q.id);
      bySlot.get(slot).path = q.media_path || bySlot.get(slot).path;
      bySlot.get(slot).meta = { ...bySlot.get(slot).meta, ...meta };
    }

    for (const slot of [1, 2, 3, 4]) {
      const entry = bySlot.get(slot);
      const invRow = inventory?.rows?.find(
        (r) => r.examen === exam.code && r.teil_propose === slot && r.statut === "prêt",
      );
      const duration = Number(entry?.meta?.duration_seconds ?? invRow?.duree_s);
      const band = BANDS[slot];
      const durationOk =
        Number.isFinite(duration) && duration >= band[0] && duration <= band[1];

      // Cross-check: if duration better matches another Teil band, flag swap risk
      let betterSlot = null;
      if (Number.isFinite(duration)) {
        for (const [s, b] of Object.entries(BANDS)) {
          const sn = Number(s);
          if (sn === slot) continue;
          if (duration >= b[0] && duration <= b[1] && !durationOk) betterSlot = sn;
        }
      }

      let status = "unverified";
      let note =
        "Order-based association only; Teil announcement not auto-transcribed — manual listen required";

      if (!entry?.path) {
        status = "invalid";
        note = "Missing media_path";
        invalid += 1;
      } else if (betterSlot) {
        status = "needs_review";
        note = `Duration ${duration}s fits Teil ${betterSlot} band better than Teil ${slot} — possible swap`;
        needsReview += 1;
      } else if (!durationOk) {
        status = "needs_review";
        note = `Duration ${duration}s outside expected band ${band[0]}-${band[1]}s for Teil ${slot}`;
        needsReview += 1;
      } else {
        // Plausible duration but still not content_verified without listening
        status = "needs_review";
        note =
          "Duration plausible for Teil; content_verified withheld until Teil announcement is heard";
        needsReview += 1;
      }

      // Signed URL smoke (service role can always sign — note student ACL separately)
      let signedOk = null;
      if (entry?.path && entry?.meta?.media_bucket !== false) {
        const bucket = entry.meta.media_bucket || "course-materials";
        const { data: signed, error: sErr } = await supabase.storage
          .from(bucket)
          .createSignedUrl(entry.path, 60);
        signedOk = !sErr && Boolean(signed?.signedUrl);
      }

      for (const qid of entry?.questionIds || []) {
        const { data: row } = await supabase
          .from("exam_questions")
          .select("metadata")
          .eq("id", qid)
          .maybeSingle();
        const meta = asMeta(row?.metadata);
        await supabase
          .from("exam_questions")
          .update({
            metadata: {
              ...meta,
              audio_verification_status: status,
              audio_verification_note: note,
              audio_duration_plausible: durationOk,
              audio_signed_url_smoke: signedOk,
              audio_verified_at: new Date().toISOString(),
            },
          })
          .eq("id", qid);
      }

      results.push({
        exam_id: exam.code,
        teil: slot,
        media_path: entry?.path || null,
        duration_s: duration || null,
        status,
        note,
        signed_url_smoke: signedOk,
      });
    }
  }

  mkdirSync(resolve(__dirname, "../tmp"), { recursive: true });
  const out = {
    generated_at: new Date().toISOString(),
    policy:
      "content_verified requires listening to Teil announcement; this pass only sets needs_review/invalid/unverified",
    content_verified: contentVerified,
    needs_review: needsReview,
    invalid,
    unverified: results.filter((r) => r.status === "unverified").length,
    items: results,
  };
  writeFileSync(resolve(__dirname, "../tmp/b1-audio-verification-audit.json"), JSON.stringify(out, null, 2));
  console.log(
    `Audio verify: content_verified=${contentVerified} needs_review=${needsReview} invalid=${invalid}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
