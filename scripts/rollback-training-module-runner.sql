-- Rollback strategy for 20260928170000_training_module_runner.sql
-- Run only if you need to remove the training runner (destructive for training_* data).

-- DROP POLICY IF EXISTS training_oral_delete ON storage.objects;
-- DROP POLICY IF EXISTS training_oral_update ON storage.objects;
-- DROP POLICY IF EXISTS training_oral_insert ON storage.objects;
-- DROP POLICY IF EXISTS training_oral_select ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'training-oral';
-- DROP FUNCTION IF EXISTS public.complete_training_attempt(uuid);
-- DROP FUNCTION IF EXISTS public.grade_training_manual_answer(uuid, numeric, text, jsonb, boolean);
-- DROP FUNCTION IF EXISTS public.submit_training_manual_answer(uuid, text, text, jsonb, text, text, text, numeric);
-- DROP FUNCTION IF EXISTS public.validate_training_objective_answer(uuid, text, jsonb);
-- DROP FUNCTION IF EXISTS public.save_training_answer_draft(uuid, text, text, jsonb, text);
-- DROP FUNCTION IF EXISTS public.start_or_resume_training_attempt(text, public.training_attempt_kind);
-- DROP FUNCTION IF EXISTS public.get_training_module_for_learner(text, boolean);
-- DROP FUNCTION IF EXISTS public.training_module_student_definition(jsonb);
-- DROP TABLE IF EXISTS public.training_module_answers;
-- DROP TABLE IF EXISTS public.training_module_attempts;
-- DROP TABLE IF EXISTS public.training_modules;
-- DROP TYPE IF EXISTS public.training_answer_status;
-- DROP TYPE IF EXISTS public.training_attempt_status;
-- DROP TYPE IF EXISTS public.training_attempt_kind;
-- DROP TYPE IF EXISTS public.training_module_status;

SELECT 'Rollback statements are commented above — uncomment carefully.' AS note;
