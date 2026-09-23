/**
 * Repair B1 draft exams: insert missing standard options, upsert visual answer keys,
 * and lift placeholders when the structured bank has better OCR-derived content.
 *
 * Uses CLI service_role (never logged). Never publishes. Never pushes.
 *
 * Usage: node scripts/repair-b1-keys-and-placeholders.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = "omxemusaqgzkogqvcdfw";
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
const VISUAL_KEYS = resolve(__dirname, "../tmp/b1-answer-keys-visual.json");
const STRUCTURED_JSON = resolve(
  __dirname,
  "../data/exams/b1-exam-bank/b1-exam-bank.structured.json",
);
const COMPLETE_JSON = resolve(
  __dirname,
  "../data/exams/b1-exam-bank/b1-exam-bank.complete.json",
);

const STANDARD_TF = new Set(["richtig", "falsch"]);
const STANDARD_JN = new Set(["ja", "nein"]);
const STANDARD_ABC = new Set(["a", "b", "c"]);
const STANDARD_MATCH = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "0"]);

function loadServiceRole() {
  const res = spawnSync(
    "supabase",
    ["projects", "api-keys", "--project-ref", PROJECT_REF, "-o", "json"],
    { encoding: "utf8", shell: true },
  );
  if (res.status !== 0) throw new Error(`CLI api-keys failed: ${res.status}`);
  let raw = (res.stdout || "").trim();
  const iArr = raw.indexOf("[");
  const iObj = raw.indexOf("{");
  let start = iArr >= 0 && (iObj < 0 || iArr < iObj) ? iArr : iObj;
  if (start < 0) throw new Error("no JSON from CLI");
  raw = raw.slice(start);
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  if (end >= 0) raw = raw.slice(0, end + 1);
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed.keys || [];
  const service = list.find((k) => k.id === "service_role" || k.name === "service_role");
  if (!service?.api_key) throw new Error("service_role missing");
  return service.api_key;
}

function stableUuid(label) {
  const h = createHash("md5").update(`ga-b1-ocr:${label}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function asMeta(m) {
  return m && typeof m === "object" && !Array.isArray(m) ? m : {};
}

function normalizeKeyToken(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "richtig" || lower === "r") return "richtig";
  if (lower === "falsch" || lower === "f") return "falsch";
  if (lower === "ja") return "ja";
  if (lower === "nein") return "nein";
  if (/^[a-j0]$/i.test(s)) return s.toLowerCase();
  return null;
}

function displayLabelForToken(token) {
  if (token === "richtig") return "Richtig";
  if (token === "falsch") return "Falsch";
  if (token === "ja") return "Ja";
  if (token === "nein") return "Nein";
  return token;
}

function isStandardTokenForType(type, token) {
  if (!token) return false;
  if (STANDARD_TF.has(token) || STANDARD_JN.has(token)) {
    return type === "true_false" || type === "listening" || type === "matching";
  }
  if (STANDARD_ABC.has(token)) {
    return (
      type === "single_choice" ||
      type === "listening" ||
      type === "multiple_choice" ||
      type === "matching"
    );
  }
  if (STANDARD_MATCH.has(token)) {
    return type === "matching" || type === "listening" || type === "single_choice";
  }
  return false;
}

function answerSourcePage(mtNum) {
  if (mtNum <= 5) return 247;
  if (mtNum <= 10) return 248;
  return 249;
}

function examNumberFromCode(code) {
  const m = String(code).match(/MT0*([1-9]|1[0-5])$/i);
  return m ? Number(m[1]) : null;
}

function optionMatches(opts, token) {
  return (opts || []).some(
    (o) =>
      String(o.value || "").toLowerCase() === token ||
      String(o.label || "").toLowerCase() === token,
  );
}

function isPlaceholderPrompt(prompt) {
  return /OCR (in)?compl[eè]te|placeholder|Frage \d+ —|Situation \d+ —/i.test(prompt || "");
}

function isBetterBankQuestion(bankQ, dbQ) {
  if (!bankQ) return false;
  if (bankQ.transform_status === "placeholder") return false;
  const bankPrompt = String(bankQ.prompt || "").trim();
  if (!bankPrompt || isPlaceholderPrompt(bankPrompt)) return false;
  const dbPrompt = String(dbQ.prompt || "").trim();
  const dbMeta = asMeta(dbQ.metadata);
  const dbIsPh =
    dbMeta.transform_status === "placeholder" || isPlaceholderPrompt(dbPrompt);
  if (!dbIsPh) return false;
  // Prefer bank when it has a non-placeholder prompt and (ideally) options.
  if (bankPrompt === dbPrompt && (bankQ.options?.length || 0) <= (dbQ.options?.length || 0)) {
    return false;
  }
  return true;
}

function loadBankIndex() {
  let bank = null;
  if (existsSync(STRUCTURED_JSON)) {
    bank = JSON.parse(readFileSync(STRUCTURED_JSON, "utf8"));
  } else if (existsSync(COMPLETE_JSON)) {
    // Fallback: transform complete → structured via TS module if available as .mjs path
    console.warn("structured JSON missing; placeholders will only use complete bank if loadable");
    bank = JSON.parse(readFileSync(COMPLETE_JSON, "utf8"));
  }
  if (!bank?.exams) return { byId: new Map(), bySlot: new Map() };

  const byId = new Map();
  const bySlot = new Map();
  for (const exam of bank.exams) {
    for (const section of exam.sections || []) {
      const skill = section.type;
      for (const q of section.questions || []) {
        byId.set(q.id, { examId: exam.id, skill, question: q });
        bySlot.set(`${exam.id}|${skill}|${q.order}`, q);
      }
    }
  }
  return { byId, bySlot, bank };
}

async function countStats(supabase) {
  const { data: exams, error } = await supabase
    .from("exams")
    .select(
      "id, code, sections:exam_sections(id, skill, questions:exam_questions(id, type, prompt, sort_order, metadata, options:exam_question_options(label, value), answer_key:exam_answer_keys(correct_values)))",
    )
    .like("code", "B1-MT%")
    .order("code");
  if (error) throw error;

  let placeholders = 0;
  let missingKeys = 0;
  let compatibleKeys = 0;
  let objective = 0;

  for (const exam of exams || []) {
    for (const section of exam.sections || []) {
      for (const q of section.questions || []) {
        const meta = asMeta(q.metadata);
        if (meta.transform_status === "placeholder") placeholders += 1;
        if (section.skill !== "lesen" && section.skill !== "hoeren") continue;
        objective += 1;
        const cv = q.answer_key?.correct_values?.[0];
        const opts = q.options || [];
        if (!cv) {
          missingKeys += 1;
          continue;
        }
        if (opts.length > 0 && !optionMatches(opts, String(cv).toLowerCase()) && !optionMatches(opts, String(cv))) {
          missingKeys += 1;
        } else {
          compatibleKeys += 1;
        }
      }
    }
  }
  return { placeholders, missingKeys, compatibleKeys, objective, examCount: exams?.length ?? 0 };
}

async function ensureOption(supabase, questionId, token, sortOrderHint, ocrText) {
  const label = displayLabelForToken(token);
  // Schema has no text column — put display token in label when inserting answer token.
  const row = {
    id: stableUuid(`option:${questionId}:${token}`),
    question_id: questionId,
    label: token,
    value: token,
    sort_order: sortOrderHint || 99,
  };
  // Prefer human-readable label for RF/JN when OCR suggests it
  if (STANDARD_TF.has(token) || STANDARD_JN.has(token)) {
    row.label = ocrText && String(ocrText).toLowerCase().includes(token) ? label : token;
  }
  const { error } = await supabase.from("exam_question_options").upsert(row, {
    onConflict: "id",
  });
  if (error) throw error;
  return row;
}

async function upsertKey(supabase, questionId, token, confirmedRaw, mtNum) {
  const page = answerSourcePage(mtNum);
  const { error } = await supabase.from("exam_answer_keys").upsert(
    {
      question_id: questionId,
      correct_values: [token],
      explanation: null,
      teacher_payload: {
        answer_source: "official_pdf",
        answer_source_page: page,
        verification_status: "visually_confirmed",
        confirmed_value: confirmedRaw,
        ocr_original: null,
        source_pdf_pages: [247, 248, 249],
        validated_at: new Date().toISOString(),
      },
    },
    { onConflict: "question_id" },
  );
  if (error) throw error;
}

async function main() {
  if (!existsSync(VISUAL_KEYS)) {
    throw new Error(`Missing visual keys: ${VISUAL_KEYS}`);
  }
  const visual = JSON.parse(readFileSync(VISUAL_KEYS, "utf8"));
  const modelltests = visual.modelltests || {};
  const { byId, bySlot } = loadBankIndex();

  console.log(`Using project ${PROJECT_REF} via Supabase CLI (secrets not logged).`);
  const key = loadServiceRole();
  const supabase = createClient(PROJECT_URL, key, { auth: { persistSession: false } });

  const before = await countStats(supabase);
  console.log("\n=== BEFORE ===");
  console.log(
    `placeholders=${before.placeholders} missing/incompatible_keys=${before.missingKeys} compatible_keys=${before.compatibleKeys}/${before.objective} (target 900)`,
  );

  const { data: exams, error: eErr } = await supabase
    .from("exams")
    .select(
      "id, code, sections:exam_sections(id, skill, questions:exam_questions(id, type, prompt, sort_order, metadata, options:exam_question_options(id, label, value, sort_order), answer_key:exam_answer_keys(correct_values, teacher_payload)))",
    )
    .like("code", "B1-MT%")
    .order("code");
  if (eErr) throw eErr;

  let optionsInserted = 0;
  let keysUpserted = 0;
  let keysSkipped = 0;
  let placeholdersUpdated = 0;
  let placeholdersUnchanged = 0;

  for (const exam of exams || []) {
    const mtNum = examNumberFromCode(exam.code);
    if (!mtNum) continue;
    const mtKeys = modelltests[String(mtNum)];
    if (!mtKeys) {
      console.warn(`No visual keys for ${exam.code}`);
      continue;
    }

    for (const section of exam.sections || []) {
      const skill = section.skill;
      const qs = (section.questions || []).slice().sort((a, b) => a.sort_order - b.sort_order);

      // --- Placeholder repair from structured bank ---
      for (const q of qs) {
        const meta = asMeta(q.metadata);
        if (meta.transform_status !== "placeholder") continue;

        const bankId = typeof meta.bank_question_id === "string" ? meta.bank_question_id : null;
        let bankQ = bankId ? byId.get(bankId)?.question : null;
        if (!bankQ) {
          bankQ = bySlot.get(`${exam.code}|${skill}|${q.sort_order}`) || null;
        }

        if (!isBetterBankQuestion(bankQ, q)) {
          placeholdersUnchanged += 1;
          continue;
        }

        const nextMeta = {
          ...meta,
          transform_status: bankQ.transform_status ?? "needs_review",
          review_status:
            bankQ.transform_status === "structured" &&
            String(bankQ.prompt || "").length > 20 &&
            !isPlaceholderPrompt(bankQ.prompt)
              ? "needs_review"
              : meta.review_status ?? "needs_review",
          ocr_raw: meta.ocr_raw ?? meta.ocr_raw_prompt ?? null,
          bank_question_id: bankQ.id ?? bankId,
        };
        // Keep needs_review unless clearly improved from OCR (still needs human check).
        if (nextMeta.review_status !== "verified") {
          nextMeta.review_status = "needs_review";
          nextMeta.needs_review = true;
        }

        const { error: uErr } = await supabase
          .from("exam_questions")
          .update({
            prompt: bankQ.prompt,
            metadata: nextMeta,
          })
          .eq("id", q.id);
        if (uErr) throw uErr;

        if (Array.isArray(bankQ.options) && bankQ.options.length > 0) {
          const existingVals = new Set((q.options || []).map((o) => String(o.value).toLowerCase()));
          let sort = (q.options || []).length;
          for (const opt of bankQ.options) {
            const val = String(opt.id ?? opt.value ?? opt.label ?? "").toLowerCase();
            if (!val || existingVals.has(val)) continue;
            sort += 1;
            await ensureOption(supabase, q.id, val, sort, opt.text);
            optionsInserted += 1;
            existingVals.add(val);
          }
        }

        q.prompt = bankQ.prompt;
        q.metadata = nextMeta;
        placeholdersUpdated += 1;
      }

      // --- Answer key repair for lesen / hoeren ---
      if (skill !== "lesen" && skill !== "hoeren") continue;
      const arr = skill === "lesen" ? mtKeys.lesen : mtKeys.hoeren;
      if (!Array.isArray(arr) || arr.length !== 30) {
        console.warn(`${exam.code} ${skill}: expected 30 keys, got ${arr?.length}`);
        continue;
      }

      for (const q of qs) {
        const qNum = q.sort_order;
        if (qNum < 1 || qNum > 30) continue;
        const raw = arr[qNum - 1];
        const token = normalizeKeyToken(raw);
        if (!token) {
          keysSkipped += 1;
          continue;
        }

        const opts = q.options || [];
        const cv = q.answer_key?.correct_values?.[0];
        const compatible =
          cv &&
          (String(cv).toLowerCase() === token || optionMatches(opts, String(cv).toLowerCase())) &&
          optionMatches(opts, token);

        if (compatible && String(cv).toLowerCase() === token) {
          continue;
        }

        if (!optionMatches(opts, token)) {
          if (!isStandardTokenForType(q.type, token)) {
            keysSkipped += 1;
            continue;
          }
          const meta = asMeta(q.metadata);
          const ocrHint =
            typeof meta.ocr_raw_prompt === "string"
              ? meta.ocr_raw_prompt
              : typeof meta.ocr_raw === "string"
                ? meta.ocr_raw
                : null;
          await ensureOption(supabase, q.id, token, opts.length + 1, ocrHint || displayLabelForToken(token));
          optionsInserted += 1;
          opts.push({ label: token, value: token });
        }

        await upsertKey(supabase, q.id, token, raw, mtNum);
        keysUpserted += 1;
      }
    }
  }

  const after = await countStats(supabase);
  console.log("\n=== REPAIR SUMMARY ===");
  console.log(
    `options_inserted=${optionsInserted} keys_upserted=${keysUpserted} keys_skipped=${keysSkipped}`,
  );
  console.log(
    `placeholders_updated=${placeholdersUpdated} placeholders_unchanged=${placeholdersUnchanged}`,
  );
  console.log("\n=== AFTER ===");
  console.log(
    `placeholders=${after.placeholders} missing/incompatible_keys=${after.missingKeys} compatible_keys=${after.compatibleKeys}/${after.objective} (target 900)`,
  );
  console.log("\nDone. No publish. No push.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
