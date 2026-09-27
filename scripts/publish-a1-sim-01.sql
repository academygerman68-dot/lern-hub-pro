-- PUBLISH A1-SIM-01 ONLY — run after explicit operator confirmation.
-- Do NOT bundle this into a migration. Do not touch other exams.
--
-- Prerequisites:
--   1) Additive + security migrations applied
--   2) Completeness report ok for A1-SIM-01
--   3) Controlled staff/QA checks passed while status = draft
--   4) Fresh operator confirmation for GENERAL A1 release
--
-- Exam id (stable): 811f4e04-864d-46b4-8c61-c2d319003efc
-- Code: A1-SIM-01
--
-- Phase A (default below): level-wide publish for all A1 students with access.
--   Keeps class_id NULL so every A1 student with academic access can see it.
--
-- Controlled student testing while draft:
--   Students cannot SELECT or start draft exams (student_can_access_exam requires published).
--   Use admin/teacher UI + staff preview, or RPC exam_completeness_report as admin/teacher.
--   Do NOT temporarily publish to class A1-AUG-2026-c100 for a "single student" test:
--   that class currently enrolls etudiant01..10 (and more) — it would open the exam to them.

BEGIN;

-- Safety: only this exam, and only if still draft or already this code.
DO $$
DECLARE
  v_id uuid := '811f4e04-864d-46b4-8c61-c2d319003efc'::uuid;
  v_code text;
  v_status public.exam_status;
  v_report jsonb;
BEGIN
  SELECT code, status INTO v_code, v_status FROM public.exams WHERE id = v_id;
  IF v_code IS NULL OR v_code <> 'A1-SIM-01' THEN
    RAISE EXCEPTION 'A1-SIM-01 not found at expected id';
  END IF;

  -- Completeness gate (admin path works for draft).
  v_report := public.exam_completeness_report(v_id);
  IF NOT coalesce((v_report ->> 'ok')::boolean, false) THEN
    RAISE EXCEPTION 'A1-SIM-01 incomplete: %', coalesce(v_report ->> 'issues', '[]');
  END IF;

  -- Level-wide: ensure no class restriction before publish.
  UPDATE public.exams
  SET
    class_id = NULL,
    status = 'published',
    published_at = coalesce(published_at, now()),
    updated_at = now()
  WHERE id = v_id
    AND code = 'A1-SIM-01';

  RAISE NOTICE 'Published A1-SIM-01 (level-wide). Previous status was %.', v_status;
END $$;

COMMIT;

-- Verify (run separately if desired):
-- SELECT code, status, class_id, published_at, format_profile
-- FROM public.exams WHERE code = 'A1-SIM-01';
