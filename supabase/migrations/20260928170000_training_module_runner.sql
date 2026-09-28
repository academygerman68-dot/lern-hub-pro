-- Training module runner (ga_training_module_v1) — additive, separate from exam engine.
-- Rollback notes: see scripts/rollback-training-module-runner.sql

CREATE TYPE public.training_module_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.training_attempt_kind AS ENUM ('live', 'preview');
CREATE TYPE public.training_attempt_status AS ENUM (
  'not_started',
  'in_progress',
  'pending_review',
  'completed'
);
CREATE TYPE public.training_answer_status AS ENUM (
  'todo',
  'in_progress',
  'answered',
  'validated',
  'review',
  'pending_review',
  'draft'
);

CREATE TABLE IF NOT EXISTS public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  level_code text NOT NULL REFERENCES public.levels (code) ON DELETE RESTRICT,
  title text NOT NULL,
  theme text,
  estimated_minutes integer NOT NULL DEFAULT 30 CHECK (estimated_minutes > 0),
  status public.training_module_status NOT NULL DEFAULT 'draft',
  format_profile text NOT NULL DEFAULT 'ga_training_module_v1'
    CHECK (format_profile = 'ga_training_module_v1'),
  definition jsonb NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_modules_code_format CHECK (code ~ '^GA-[A-C][0-9]-M[0-9]{2}$')
);

CREATE TABLE IF NOT EXISTS public.training_module_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.training_modules (id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind public.training_attempt_kind NOT NULL DEFAULT 'live',
  status public.training_attempt_status NOT NULL DEFAULT 'in_progress',
  current_activity_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_saved_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_module_attempts_live_needs_student CHECK (
    kind = 'preview' OR student_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.training_module_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.training_module_attempts (id) ON DELETE CASCADE,
  activity_id text NOT NULL,
  activity_type text NOT NULL,
  status public.training_answer_status NOT NULL DEFAULT 'todo',
  answer jsonb,
  is_correct boolean,
  points_awarded numeric(6,2),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  first_is_correct boolean,
  best_is_correct boolean,
  feedback_short text,
  explanation text,
  common_error text,
  positive_feedback text,
  teacher_comment text,
  grading_detail jsonb,
  answer_media_bucket text,
  answer_media_path text,
  answer_mime_type text,
  answer_duration_seconds numeric(8,2),
  answered_at timestamptz,
  graded_at timestamptz,
  graded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, activity_id)
);

CREATE INDEX IF NOT EXISTS training_modules_status_idx ON public.training_modules (status);
CREATE INDEX IF NOT EXISTS training_modules_level_idx ON public.training_modules (level_code);
CREATE INDEX IF NOT EXISTS training_attempts_module_idx ON public.training_module_attempts (module_id);
CREATE INDEX IF NOT EXISTS training_attempts_student_idx ON public.training_module_attempts (student_id);
CREATE INDEX IF NOT EXISTS training_attempts_profile_idx ON public.training_module_attempts (profile_id);
CREATE INDEX IF NOT EXISTS training_answers_attempt_idx ON public.training_module_answers (attempt_id);

CREATE UNIQUE INDEX IF NOT EXISTS training_attempts_one_active_live
  ON public.training_module_attempts (student_id, module_id)
  WHERE kind = 'live' AND status IN ('in_progress', 'pending_review') AND student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS training_attempts_one_active_preview
  ON public.training_module_attempts (profile_id, module_id)
  WHERE kind = 'preview' AND status IN ('in_progress', 'pending_review');

DROP TRIGGER IF EXISTS training_modules_set_updated_at ON public.training_modules;
CREATE TRIGGER training_modules_set_updated_at
  BEFORE UPDATE ON public.training_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS training_attempts_set_updated_at ON public.training_module_attempts;
CREATE TRIGGER training_attempts_set_updated_at
  BEFORE UPDATE ON public.training_module_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS training_answers_set_updated_at ON public.training_module_answers;
CREATE TRIGGER training_answers_set_updated_at
  BEFORE UPDATE ON public.training_module_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_module_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_module_answers ENABLE ROW LEVEL SECURITY;

-- Modules: students see published only; staff see all (incl. draft)
DROP POLICY IF EXISTS training_modules_select ON public.training_modules;
CREATE POLICY training_modules_select ON public.training_modules
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.current_profile_role() IN ('teacher', 'admin')
    OR status = 'published'
  );

DROP POLICY IF EXISTS training_modules_write ON public.training_modules;
CREATE POLICY training_modules_write ON public.training_modules
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.current_profile_role() = 'admin')
  WITH CHECK (public.is_admin() OR public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS training_attempts_select ON public.training_module_attempts;
CREATE POLICY training_attempts_select ON public.training_module_attempts
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR profile_id = auth.uid()
    OR (
      kind = 'live'
      AND student_id IS NOT NULL
      AND public.teacher_has_student(student_id)
    )
  );

DROP POLICY IF EXISTS training_attempts_insert ON public.training_module_attempts;
CREATE POLICY training_attempts_insert ON public.training_module_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND (
      (kind = 'live' AND student_id = public.current_student_id())
      OR (
        kind = 'preview'
        AND (
          public.is_admin()
          OR public.current_profile_role() IN ('teacher', 'admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS training_attempts_update ON public.training_module_attempts;
CREATE POLICY training_attempts_update ON public.training_module_attempts
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR profile_id = auth.uid()
    OR (
      kind = 'live'
      AND student_id IS NOT NULL
      AND public.teacher_has_student(student_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR profile_id = auth.uid()
    OR (
      kind = 'live'
      AND student_id IS NOT NULL
      AND public.teacher_has_student(student_id)
    )
  );

DROP POLICY IF EXISTS training_answers_select ON public.training_module_answers;
CREATE POLICY training_answers_select ON public.training_module_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_module_attempts a
      WHERE a.id = attempt_id
        AND (
          public.is_admin()
          OR a.profile_id = auth.uid()
          OR (
            a.kind = 'live'
            AND a.student_id IS NOT NULL
            AND public.teacher_has_student(a.student_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS training_answers_write ON public.training_module_answers;
CREATE POLICY training_answers_write ON public.training_module_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_module_attempts a
      WHERE a.id = attempt_id
        AND (
          public.is_admin()
          OR a.profile_id = auth.uid()
          OR (
            a.kind = 'live'
            AND a.student_id IS NOT NULL
            AND public.teacher_has_student(a.student_id)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_module_attempts a
      WHERE a.id = attempt_id
        AND (
          public.is_admin()
          OR a.profile_id = auth.uid()
          OR (
            a.kind = 'live'
            AND a.student_id IS NOT NULL
            AND public.teacher_has_student(a.student_id)
          )
        )
    )
  );

-- Private oral bucket (reuse course-materials path convention under training-oral/)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-oral',
  'training-oral',
  false,
  10485760,
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS training_oral_select ON storage.objects;
CREATE POLICY training_oral_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'training-oral'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR (
        public.current_profile_role() IN ('teacher', 'admin')
        AND EXISTS (
          SELECT 1
          FROM public.training_module_answers ans
          JOIN public.training_module_attempts att ON att.id = ans.attempt_id
          WHERE ans.answer_media_bucket = 'training-oral'
            AND ans.answer_media_path = name
            AND att.student_id IS NOT NULL
            AND public.teacher_has_student(att.student_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS training_oral_insert ON storage.objects;
CREATE POLICY training_oral_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'training-oral'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS training_oral_update ON storage.objects;
CREATE POLICY training_oral_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'training-oral'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS training_oral_delete ON storage.objects;
CREATE POLICY training_oral_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'training-oral'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- Strip staff-only keys for students
CREATE OR REPLACE FUNCTION public.training_module_student_definition(p_def jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  acts jsonb := '[]'::jsonb;
  act jsonb;
  media jsonb;
  safe_act jsonb;
BEGIN
  FOR act IN SELECT * FROM jsonb_array_elements(COALESCE(p_def->'activities', '[]'::jsonb))
  LOOP
    media := act->'media';
    IF media IS NOT NULL THEN
      media := media - 'audio_script_staff_only';
    END IF;
    safe_act := act
      - 'correct_answer'
      - 'correct_form'
      - 'correct_answers'
      - 'explanation'
      - 'common_error'
      - 'positive_feedback'
      - 'sample_answer_staff_only';
    IF media IS NOT NULL THEN
      safe_act := jsonb_set(safe_act, '{media}', media);
    END IF;
    acts := acts || jsonb_build_array(safe_act);
  END LOOP;

  RETURN jsonb_build_object(
    'schema_version', p_def->>'schema_version',
    'module_id', p_def->>'module_id',
    'kind', p_def->>'kind',
    'format_profile', p_def->>'format_profile',
    'level', p_def->>'level',
    'sequence', p_def->'sequence',
    'title', p_def->>'title',
    'theme', p_def->>'theme',
    'subtitle', p_def->>'subtitle',
    'estimated_minutes', p_def->'estimated_minutes',
    'prerequisites', COALESCE(p_def->'prerequisites', '[]'::jsonb),
    'learning_objectives', COALESCE(p_def->'learning_objectives', '[]'::jsonb),
    'vocabulary_targets', COALESCE(p_def->'vocabulary_targets', '[]'::jsonb),
    'grammar_targets', COALESCE(p_def->'grammar_targets', '[]'::jsonb),
    'skills', COALESCE(p_def->'skills', '[]'::jsonb),
    'publication_status', p_def->>'publication_status',
    'correction', COALESCE(p_def->'correction', '{}'::jsonb),
    'media', jsonb_build_object(
      'audio_tracks',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', t->>'id',
              'url', t->>'url',
              'duration_seconds', t->'duration_seconds'
            )
          )
          FROM jsonb_array_elements(COALESCE(p_def->'media'->'audio_tracks', '[]'::jsonb)) t
        ),
        '[]'::jsonb
      )
    ),
    'activities', acts
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_training_module_for_learner(p_code text, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mod public.training_modules;
  staff boolean;
BEGIN
  SELECT * INTO mod FROM public.training_modules WHERE code = p_code;
  IF mod.id IS NULL THEN
    RAISE EXCEPTION 'MODULE_NOT_FOUND';
  END IF;

  staff := public.is_admin() OR public.current_profile_role() IN ('teacher', 'admin');
  IF mod.status <> 'published' AND NOT (p_preview AND staff) THEN
    RAISE EXCEPTION 'MODULE_NOT_AVAILABLE';
  END IF;

  IF p_preview AND staff THEN
    RETURN jsonb_build_object(
      'id', mod.id,
      'code', mod.code,
      'status', mod.status,
      'level_code', mod.level_code,
      'preview', true,
      'definition', public.training_module_student_definition(mod.definition)
    );
  END IF;

  RETURN jsonb_build_object(
    'id', mod.id,
    'code', mod.code,
    'status', mod.status,
    'level_code', mod.level_code,
    'preview', false,
    'definition', public.training_module_student_definition(mod.definition)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.start_or_resume_training_attempt(
  p_module_code text,
  p_kind public.training_attempt_kind DEFAULT 'live'
)
RETURNS public.training_module_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mod public.training_modules;
  sid uuid := public.current_student_id();
  existing public.training_module_attempts;
  created public.training_module_attempts;
  staff boolean;
BEGIN
  SELECT * INTO mod FROM public.training_modules WHERE code = p_module_code;
  IF mod.id IS NULL THEN
    RAISE EXCEPTION 'MODULE_NOT_FOUND';
  END IF;

  staff := public.is_admin() OR public.current_profile_role() IN ('teacher', 'admin');

  IF p_kind = 'live' THEN
    IF sid IS NULL THEN
      RAISE EXCEPTION 'STUDENT_REQUIRED';
    END IF;
    IF mod.status <> 'published' THEN
      RAISE EXCEPTION 'MODULE_NOT_AVAILABLE';
    END IF;

    SELECT * INTO existing
    FROM public.training_module_attempts
    WHERE module_id = mod.id
      AND student_id = sid
      AND kind = 'live'
      AND status IN ('in_progress', 'pending_review')
    ORDER BY started_at DESC
    LIMIT 1;

    IF existing.id IS NOT NULL THEN
      RETURN existing;
    END IF;

    INSERT INTO public.training_module_attempts (module_id, student_id, profile_id, kind, status)
    VALUES (mod.id, sid, auth.uid(), 'live', 'in_progress')
    RETURNING * INTO created;
    RETURN created;
  END IF;

  -- preview
  IF NOT staff THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF mod.status = 'archived' THEN
    RAISE EXCEPTION 'MODULE_NOT_AVAILABLE';
  END IF;

  SELECT * INTO existing
  FROM public.training_module_attempts
  WHERE module_id = mod.id
    AND profile_id = auth.uid()
    AND kind = 'preview'
    AND status IN ('in_progress', 'pending_review')
  ORDER BY started_at DESC
  LIMIT 1;

  IF existing.id IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.training_module_attempts (module_id, student_id, profile_id, kind, status)
  VALUES (mod.id, sid, auth.uid(), 'preview', 'in_progress')
  RETURNING * INTO created;
  RETURN created;
END;
$$;

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
    p_attempt_id, p_activity_id, p_activity_type, 'draft', p_answer
  )
  ON CONFLICT (attempt_id, activity_id) DO UPDATE SET
    answer = EXCLUDED.answer,
    activity_type = EXCLUDED.activity_type,
    status = CASE
      WHEN a.status IN ('validated', 'pending_review', 'answered') THEN a.status
      ELSE 'draft'
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
    FOR field, val IN SELECT * FROM jsonb_each_text(form)
    LOOP
      IF lower(trim(COALESCE(p_answer->'form'->>field, ''))) <> lower(trim(val)) THEN
        correct := false;
      END IF;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'UNSUPPORTED_ACTIVITY_TYPE';
  END IF;

  points := CASE WHEN correct THEN max_points ELSE 0 END;

  INSERT INTO public.training_module_answers AS a (
    attempt_id, activity_id, activity_type, status, answer,
    is_correct, points_awarded, attempt_count, first_is_correct, best_is_correct,
    feedback_short, explanation, common_error, positive_feedback, answered_at
  ) VALUES (
    p_attempt_id, p_activity_id, activity_type,
    CASE WHEN correct THEN 'validated' ELSE 'review' END,
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
      WHEN EXCLUDED.is_correct THEN 'validated'
      WHEN allow_retry THEN 'review'
      ELSE 'answered'
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
  prev_bucket text;
  prev_path text;
BEGIN
  SELECT * INTO att FROM public.training_module_attempts WHERE id = p_attempt_id;
  IF att.id IS NULL THEN RAISE EXCEPTION 'ATTEMPT_NOT_FOUND'; END IF;
  IF att.profile_id <> auth.uid() AND NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_activity_type NOT IN ('writing', 'speaking') THEN RAISE EXCEPTION 'NOT_MANUAL'; END IF;

  SELECT answer_media_bucket, answer_media_path INTO prev_bucket, prev_path
  FROM public.training_module_answers
  WHERE attempt_id = p_attempt_id AND activity_id = p_activity_id;

  INSERT INTO public.training_module_answers AS a (
    attempt_id, activity_id, activity_type, status, answer,
    answer_media_bucket, answer_media_path, answer_mime_type, answer_duration_seconds,
    attempt_count, answered_at
  ) VALUES (
    p_attempt_id, p_activity_id, p_activity_type, 'pending_review', p_answer,
    p_media_bucket, p_media_path, p_mime_type, p_duration_seconds,
    1, now()
  )
  ON CONFLICT (attempt_id, activity_id) DO UPDATE SET
    answer = EXCLUDED.answer,
    status = 'pending_review',
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
    status = 'pending_review',
    last_saved_at = now(),
    current_activity_id = p_activity_id
  WHERE id = p_attempt_id
    AND status = 'in_progress';

  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.grade_training_manual_answer(
  p_answer_id uuid,
  p_points numeric,
  p_teacher_comment text,
  p_grading_detail jsonb DEFAULT '{}'::jsonb,
  p_finalize boolean DEFAULT true
)
RETURNS public.training_module_answers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.training_module_answers;
  att public.training_module_attempts;
BEGIN
  SELECT * INTO row FROM public.training_module_answers WHERE id = p_answer_id;
  IF row.id IS NULL THEN RAISE EXCEPTION 'ANSWER_NOT_FOUND'; END IF;
  SELECT * INTO att FROM public.training_module_attempts WHERE id = row.attempt_id;

  IF NOT (
    public.is_admin()
    OR (
      att.kind = 'live'
      AND att.student_id IS NOT NULL
      AND public.teacher_has_student(att.student_id)
    )
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.training_module_answers
  SET
    points_awarded = p_points,
    teacher_comment = p_teacher_comment,
    grading_detail = COALESCE(p_grading_detail, '{}'::jsonb),
    status = CASE WHEN p_finalize THEN 'validated' ELSE 'pending_review' END,
    graded_at = CASE WHEN p_finalize THEN now() ELSE graded_at END,
    graded_by = CASE WHEN p_finalize THEN auth.uid() ELSE graded_by END,
    updated_at = now()
  WHERE id = p_answer_id
  RETURNING * INTO row;

  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_training_attempt(p_attempt_id uuid)
RETURNS public.training_module_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  att public.training_module_attempts;
  pending int;
BEGIN
  SELECT * INTO att FROM public.training_module_attempts WHERE id = p_attempt_id;
  IF att.id IS NULL THEN RAISE EXCEPTION 'ATTEMPT_NOT_FOUND'; END IF;
  IF att.profile_id <> auth.uid() AND NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT count(*) INTO pending
  FROM public.training_module_answers
  WHERE attempt_id = p_attempt_id AND status = 'pending_review';

  UPDATE public.training_module_attempts
  SET
    status = CASE WHEN pending > 0 THEN 'pending_review'::public.training_attempt_status ELSE 'completed'::public.training_attempt_status END,
    completed_at = CASE WHEN pending > 0 THEN NULL ELSE now() END,
    last_saved_at = now()
  WHERE id = p_attempt_id
  RETURNING * INTO att;

  RETURN att;
END;
$$;

REVOKE ALL ON FUNCTION public.training_module_student_definition(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_training_module_for_learner(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_or_resume_training_attempt(text, public.training_attempt_kind) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_training_answer_draft(uuid, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_training_objective_answer(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_training_manual_answer(uuid, text, text, jsonb, text, text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grade_training_manual_answer(uuid, numeric, text, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_training_attempt(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_training_module_for_learner(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_or_resume_training_attempt(text, public.training_attempt_kind) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_training_answer_draft(uuid, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_training_objective_answer(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_training_manual_answer(uuid, text, text, jsonb, text, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_training_manual_answer(uuid, numeric, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_training_attempt(uuid) TO authenticated;
