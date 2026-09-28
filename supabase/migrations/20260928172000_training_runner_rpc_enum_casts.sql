-- Fix enum casts in training runner RPCs + form_fill field key.
-- Additive / idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.save_training_answer_draft(
  p_attempt_id uuid,
  p_activity_id text,
  p_activity_type text,
  p_answer jsonb,
  p_current_activity_id text DEFAULT NULL
)
RETURNS public.training_module_answers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  att public.training_module_attempts;
  row public.training_module_answers;
BEGIN
  SELECT * INTO att FROM public.training_module_attempts WHERE id = p_attempt_id;
  IF att.id IS NULL THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_FOUND';
  END IF;
  IF att.profile_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF att.status NOT IN ('in_progress', 'pending_review') THEN
    RAISE EXCEPTION 'ATTEMPT_LOCKED';
  END IF;

  INSERT INTO public.training_module_answers AS a (
    attempt_id, activity_id, activity_type, status, answer
  ) VALUES (
    p_attempt_id, p_activity_id, p_activity_type, 'draft'::public.training_answer_status, p_answer
  )
  ON CONFLICT (attempt_id, activity_id) DO UPDATE SET
    answer = EXCLUDED.answer,
    activity_type = EXCLUDED.activity_type,
    status = CASE
      WHEN a.status IN (
        'validated'::public.training_answer_status,
        'pending_review'::public.training_answer_status,
        'answered'::public.training_answer_status
      ) THEN a.status
      ELSE 'draft'::public.training_answer_status
    END,
    updated_at = now()
  RETURNING * INTO row;

  UPDATE public.training_module_attempts
  SET
    last_saved_at = now(),
    current_activity_id = COALESCE(p_current_activity_id, current_activity_id)
  WHERE id = p_attempt_id;

  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_training_objective_answer(
  p_attempt_id uuid,
  p_activity_id text,
  p_answer jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  att public.training_module_attempts;
  mod public.training_modules;
  act jsonb;
  activity_type text;
  correct boolean := false;
  explanation text;
  positive text;
  common_err text;
  points numeric := 0;
  max_points numeric := 0;
  row public.training_module_answers;
  allow_retry boolean := true;
  choice text;
  expected text;
  expected_arr jsonb;
  form jsonb;
  field text;
  val text;
  submitted jsonb;
  new_status public.training_answer_status;
BEGIN
  SELECT * INTO att FROM public.training_module_attempts WHERE id = p_attempt_id;
  IF att.id IS NULL THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_FOUND';
  END IF;
  IF att.profile_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF att.status NOT IN ('in_progress', 'pending_review') THEN
    RAISE EXCEPTION 'ATTEMPT_LOCKED';
  END IF;

  SELECT * INTO mod FROM public.training_modules WHERE id = att.module_id;
  allow_retry := COALESCE((mod.definition->'correction'->>'allow_retry')::boolean, true);

  SELECT value INTO act
  FROM jsonb_array_elements(mod.definition->'activities') value
  WHERE value->>'id' = p_activity_id
  LIMIT 1;

  IF act IS NULL THEN
    RAISE EXCEPTION 'ACTIVITY_NOT_FOUND';
  END IF;

  activity_type := act->>'activity_type';
  IF activity_type IN ('writing', 'speaking') THEN
    RAISE EXCEPTION 'USE_MANUAL_SUBMIT';
  END IF;

  max_points := COALESCE((act->>'points')::numeric, 1);
  explanation := act->>'explanation';
  positive := act->>'positive_feedback';
  common_err := act->>'common_error';

  IF activity_type IN ('single_choice', 'listening') THEN
    choice := COALESCE(p_answer->>'value', p_answer#>>'{}');
    expected := act->>'correct_answer';
    correct := choice = expected;
  ELSIF activity_type = 'true_false' THEN
    correct := (p_answer->>'value')::boolean = (act->>'correct_answer')::boolean
      OR lower(p_answer->>'value') = lower(act->>'correct_answer');
  ELSIF activity_type = 'multiple_choice' THEN
    expected_arr := COALESCE(act->'correct_answers', act->'correct_answer');
    correct := COALESCE(p_answer->'values', '[]'::jsonb) @> expected_arr
      AND expected_arr @> COALESCE(p_answer->'values', '[]'::jsonb);
  ELSIF activity_type = 'form_fill' THEN
    correct := true;
    form := COALESCE(act->'correct_form', '{}'::jsonb);
    submitted := COALESCE(p_answer->'fields', p_answer->'form', '{}'::jsonb);
    FOR field, val IN SELECT * FROM jsonb_each_text(form)
    LOOP
      IF lower(trim(COALESCE(submitted->>field, ''))) <> lower(trim(val)) THEN
        correct := false;
      END IF;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'UNSUPPORTED_ACTIVITY_TYPE';
  END IF;

  points := CASE WHEN correct THEN max_points ELSE 0 END;
  new_status := CASE
    WHEN correct THEN 'validated'::public.training_answer_status
    WHEN allow_retry THEN 'review'::public.training_answer_status
    ELSE 'answered'::public.training_answer_status
  END;

  INSERT INTO public.training_module_answers AS a (
    attempt_id, activity_id, activity_type, status, answer,
    is_correct, points_awarded, attempt_count, first_is_correct, best_is_correct,
    feedback_short, explanation, common_error, positive_feedback, answered_at
  ) VALUES (
    p_attempt_id, p_activity_id, activity_type,
    new_status,
    p_answer, correct, points, 1, correct, correct,
    CASE WHEN correct THEN positive ELSE common_err END,
    explanation, common_err, positive, now()
  )
  ON CONFLICT (attempt_id, activity_id) DO UPDATE SET
    answer = EXCLUDED.answer,
    is_correct = EXCLUDED.is_correct,
    points_awarded = GREATEST(COALESCE(a.points_awarded, 0), EXCLUDED.points_awarded),
    attempt_count = a.attempt_count + 1,
    first_is_correct = COALESCE(a.first_is_correct, EXCLUDED.first_is_correct),
    best_is_correct = COALESCE(a.best_is_correct, false) OR EXCLUDED.is_correct,
    status = CASE
      WHEN EXCLUDED.is_correct THEN 'validated'::public.training_answer_status
      WHEN allow_retry THEN 'review'::public.training_answer_status
      ELSE 'answered'::public.training_answer_status
    END,
    feedback_short = EXCLUDED.feedback_short,
    explanation = EXCLUDED.explanation,
    common_error = EXCLUDED.common_error,
    positive_feedback = EXCLUDED.positive_feedback,
    answered_at = now(),
    updated_at = now()
  RETURNING * INTO row;

  UPDATE public.training_module_attempts
  SET last_saved_at = now(), current_activity_id = p_activity_id
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'answer', row,
    'is_correct', correct,
    'points_awarded', row.points_awarded,
    'max_points', max_points,
    'explanation', explanation,
    'positive_feedback', positive,
    'common_error', common_err,
    'allow_retry', allow_retry,
    'attempt_count', row.attempt_count,
    'first_is_correct', row.first_is_correct,
    'best_is_correct', row.best_is_correct
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_training_manual_answer(
  p_attempt_id uuid,
  p_activity_id text,
  p_activity_type text,
  p_answer jsonb,
  p_media_bucket text DEFAULT NULL,
  p_media_path text DEFAULT NULL,
  p_mime_type text DEFAULT NULL,
  p_duration_seconds numeric DEFAULT NULL
)
RETURNS public.training_module_answers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  att public.training_module_attempts;
  row public.training_module_answers;
BEGIN
  SELECT * INTO att FROM public.training_module_attempts WHERE id = p_attempt_id;
  IF att.id IS NULL THEN RAISE EXCEPTION 'ATTEMPT_NOT_FOUND'; END IF;
  IF att.profile_id <> auth.uid() AND NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_activity_type NOT IN ('writing', 'speaking') THEN RAISE EXCEPTION 'NOT_MANUAL'; END IF;

  INSERT INTO public.training_module_answers AS a (
    attempt_id, activity_id, activity_type, status, answer,
    answer_media_bucket, answer_media_path, answer_mime_type, answer_duration_seconds,
    attempt_count, answered_at
  ) VALUES (
    p_attempt_id, p_activity_id, p_activity_type, 'pending_review'::public.training_answer_status, p_answer,
    p_media_bucket, p_media_path, p_mime_type, p_duration_seconds,
    1, now()
  )
  ON CONFLICT (attempt_id, activity_id) DO UPDATE SET
    answer = EXCLUDED.answer,
    status = 'pending_review'::public.training_answer_status,
    answer_media_bucket = COALESCE(EXCLUDED.answer_media_bucket, a.answer_media_bucket),
    answer_media_path = COALESCE(EXCLUDED.answer_media_path, a.answer_media_path),
    answer_mime_type = COALESCE(EXCLUDED.answer_mime_type, a.answer_mime_type),
    answer_duration_seconds = COALESCE(EXCLUDED.answer_duration_seconds, a.answer_duration_seconds),
    attempt_count = a.attempt_count + 1,
    answered_at = now(),
    updated_at = now()
  RETURNING * INTO row;

  UPDATE public.training_module_attempts
  SET
    status = 'pending_review'::public.training_attempt_status,
    last_saved_at = now(),
    current_activity_id = p_activity_id
  WHERE id = p_attempt_id
    AND status = 'in_progress'::public.training_attempt_status;

  RETURN row;
END;
$$;
