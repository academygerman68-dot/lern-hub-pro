/**
 * Assembles scripts/rollback-exam-engine-security-goethe-a1.sql with full
 * pre-security function bodies extracted from prior migrations (no manual steps).
 */
import { readFileSync, writeFileSync } from "node:fs";

function extractFunction(sql, name) {
  const re = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?\\n\\$\\$;`,
    "m",
  );
  const match = sql.match(re);
  if (!match) throw new Error(`Function ${name} not found`);
  return match[0];
}

const teacherSql = readFileSync(
  "supabase/migrations/20260918040000_teacher_academic_parity.sql",
  "utf8",
);
const startSql = readFileSync(
  "supabase/migrations/20260921182906_exam_hoeren_audio_completeness.sql",
  "utf8",
);
const submitGradeSql = readFileSync(
  "supabase/migrations/20260919020000_a1_exam_bank_engine.sql",
  "utf8",
);
const completenessSql = readFileSync(
  "supabase/migrations/20260923180000_exam_audio_tracks.sql",
  "utf8",
);

const teacherFn = extractFunction(teacherSql, "teacher_can_manage_exam");
const startFn = extractFunction(startSql, "start_exam_attempt");
const submitFn = extractFunction(submitGradeSql, "submit_exam_attempt");
// grade may be preceded by DROP FUNCTION
const gradeMatch = submitGradeSql.match(
  /DROP FUNCTION IF EXISTS public\.grade_exam_writing_answer[\s\S]*?\n\$\$;/,
);
if (!gradeMatch) throw new Error("grade_exam_writing_answer not found");
const gradeFn = gradeMatch[0];
const completenessFn = extractFunction(completenessSql, "exam_completeness_report");

const out = `-- MANUAL ROLLBACK for 20260927180000_exam_engine_security_goethe_a1.sql
-- Self-contained: full function bodies included (no external SQL lookup required).
-- Run only on an environment where the security migration was applied.
-- Never run against production without explicit authorization.
--
-- THIS ROLLBACK IS NOT A SECURITY HARDENING STEP.
-- Restoring pre-migration teacher SELECT policies re-opens broader teacher access
-- that existed before the security migration. That is intentional state restoration only.
--
-- REMOVES
--   - public.exam_score_percentage(uuid, numeric, numeric)
--   - Goethe-aware timer / scoring / completeness / class-scoped teacher SELECT
--   - level-wide mock manage scope in teacher_can_manage_exam
--
-- RESTORES (exact pre-security migration definitions from repo history)
--   - teacher_can_manage_exam          ← 20260918040000_teacher_academic_parity
--   - start_exam_attempt               ← 20260921182906_exam_hoeren_audio_completeness
--   - submit_exam_attempt              ← 20260919020000_a1_exam_bank_engine
--   - grade_exam_writing_answer        ← 20260919020000_a1_exam_bank_engine
--   - exam_completeness_report         ← 20260923180000_exam_audio_tracks
--   - exam_attempts_select / exam_answers_select (any teacher + own student)
--   - course_materials_exam_oral_select (any teacher)
--   - EXECUTE grants on restored functions for authenticated
--
-- KEEPS INTENTIONALLY
--   - A1-SIM-01 seed rows and additive columns (format_profile, written/speaking durations)
--   - exam_answer_keys_staff (staff-only). Forward migration ensured this policy;
--     keeping it avoids re-exposing teacher_payload / correct_values to students.

BEGIN;

DROP FUNCTION IF EXISTS public.exam_score_percentage(uuid, numeric, numeric);

${teacherFn}

REVOKE ALL ON FUNCTION public.teacher_can_manage_exam(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_can_manage_exam(uuid, uuid) TO authenticated;

${startFn}

REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;

${submitFn}

REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid) TO authenticated;

${gradeFn}

REVOKE ALL ON FUNCTION public.grade_exam_writing_answer(uuid, uuid, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_exam_writing_answer(uuid, uuid, numeric, text, jsonb) TO authenticated;

${completenessFn}

REVOKE ALL ON FUNCTION public.exam_completeness_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exam_completeness_report(uuid) TO authenticated;

-- Prior (broader) RLS — restoration only, not a security improvement.
DROP POLICY IF EXISTS exam_attempts_select ON public.exam_attempts;
CREATE POLICY exam_attempts_select
  ON public.exam_attempts FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_teacher()
    OR (
      student_id = public.current_student_id()
      AND public.is_active_user()
    )
  );

DROP POLICY IF EXISTS exam_answers_select ON public.exam_answers;
CREATE POLICY exam_answers_select
  ON public.exam_answers FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_teacher()
    OR EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = attempt_id
        AND a.student_id = public.current_student_id()
    )
  );

DROP POLICY IF EXISTS course_materials_exam_oral_select ON storage.objects;
CREATE POLICY course_materials_exam_oral_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (storage.foldername(name))[1] = 'exam-oral'
  AND (
    public.is_admin()
    OR public.is_teacher()
    OR (
      public.current_student_id() IS NOT NULL
      AND (storage.foldername(name))[3] = public.current_student_id()::text
    )
  )
);

-- Conserved on purpose (see header KEEPS INTENTIONALLY).
DROP POLICY IF EXISTS exam_answer_keys_staff ON public.exam_answer_keys;
CREATE POLICY exam_answer_keys_staff
  ON public.exam_answer_keys FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_teacher())
  WITH CHECK (public.is_admin() OR public.is_teacher());

COMMIT;
`;

const path = "scripts/rollback-exam-engine-security-goethe-a1.sql";
writeFileSync(path, out);
console.log(`Wrote ${path} (${(out.length / 1024).toFixed(1)} KB)`);
