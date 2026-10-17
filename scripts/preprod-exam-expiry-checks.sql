-- Read-only checks for 20261016140000_exam_attempt_expiry_finalization.sql.
-- Do not run this against production project omxemusaqgzkogqvcdfw
-- (host db.omxemusaqgzkogqvcdfw.supabase.co).
--
-- Before anything else, confirm the session target:
--   SELECT inet_server_addr(), current_database(), current_user;
-- Abort if that host is the production database.
--
-- Apply only this file, on the confirmed preproduction database:
--   psql "$PREPROD_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261016140000_exam_attempt_expiry_finalization.sql
--
-- Dependencies already created by earlier migrations, in timestamp order:
--   current_student_id, student_can_access_exam, is_admin, is_teacher,
--   teacher_can_manage_exam, teacher_has_student, exam_completeness_report,
--   exam_score_percentage, score_form_fill_answer, submit_exam_attempt,
--   create_in_app_notification.
-- This script does not insert, update, or delete rows.

DO $$
DECLARE
  save_def text;
  oral_def text;
  grade_def text;
  review_def text;
  start_def text;
BEGIN
  SELECT pg_get_functiondef('public.save_exam_answer(uuid,uuid,jsonb,boolean)'::regprocedure)
    INTO save_def;
  SELECT pg_get_functiondef('public.save_exam_oral_answer(uuid,uuid,text,text,text,boolean)'::regprocedure)
    INTO oral_def;
  SELECT pg_get_functiondef('public.grade_exam_writing_answer(uuid,uuid,numeric,text,jsonb)'::regprocedure)
    INTO grade_def;
  SELECT pg_get_functiondef('public.get_exam_attempt_review(uuid)'::regprocedure)
    INTO review_def;
  SELECT pg_get_functiondef('public.start_exam_attempt(uuid)'::regprocedure)
    INTO start_def;

  IF save_def NOT LIKE '%goethe_a1_adult_v1%' OR save_def NOT LIKE '%ATTEMPT_EXPIRED%' THEN
    RAISE EXCEPTION 'save_exam_answer is missing the Goethe written-expiry rule';
  END IF;
  IF oral_def NOT LIKE '%A1-SIM-%' OR oral_def NOT LIKE '%ATTEMPT_EXPIRED%' THEN
    RAISE EXCEPTION 'save_exam_oral_answer is missing the non-Goethe oral expiry rule';
  END IF;
  IF grade_def LIKE '%submitted'', ''graded'', ''expired%' THEN
    RAISE EXCEPTION 'grade_exam_writing_answer still accepts expired attempts';
  END IF;
  IF grade_def NOT LIKE '%ATTEMPT_NOT_READY%' THEN
    RAISE EXCEPTION 'grade_exam_writing_answer does not reject an unsubmitted attempt';
  END IF;
  IF review_def NOT LIKE '%ATTEMPT_NOT_SUBMITTED%'
     OR review_def NOT LIKE '%teacher_has_student%' THEN
    RAISE EXCEPTION 'get_exam_attempt_review is missing submission or teacher scope checks';
  END IF;
  IF start_def NOT LIKE '%FOR UPDATE%'
     OR start_def NOT LIKE '%submit_exam_attempt%' THEN
    RAISE EXCEPTION 'start_exam_attempt does not lock and finalize an overdue attempt';
  END IF;
  IF start_def LIKE '%exam_score_percentage%' AND start_def LIKE '%CREATE OR REPLACE FUNCTION public.exam_score_percentage%' THEN
    RAISE EXCEPTION 'start_exam_attempt must not replace the Goethe conversion function';
  END IF;

  RAISE NOTICE 'Function-definition checks passed. Role scenarios below still require real JWTs.';
END $$;

-- Role scenarios, each in its own authenticated session. Do not use the service role.
-- 1. Student A, in_progress attempt: get_exam_attempt_review -> ATTEMPT_NOT_SUBMITTED.
-- 2. Student A, expired non-Goethe attempt: save_exam_answer and save_exam_oral_answer -> ATTEMPT_EXPIRED.
-- 3. Student A, Goethe attempt past expires_at, status still in_progress:
--    save_exam_answer -> ATTEMPT_EXPIRED and status remains in_progress;
--    save_exam_oral_answer on the speaking question succeeds.
-- 4. Student B calls get_exam_attempt_review on student A's submitted attempt -> FORBIDDEN.
-- 5. Teacher without teacher_has_student calls get_exam_attempt_review -> FORBIDDEN.
-- 6. Teacher calls grade_exam_writing_answer on an expired attempt -> ATTEMPT_NOT_READY.
-- 7. Same teacher, after the student submits, grades within the question points.
--    A second submit_exam_attempt returns the same score and does not rescore.
