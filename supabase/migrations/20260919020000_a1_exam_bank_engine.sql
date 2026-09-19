-- A1 mock exam bank: form_fill type, exam codes, answer key explanations,
-- grading_detail, enhanced submit scoring, attempt review RPC.

-- 1) Exam business code for idempotent imports
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS code text;

CREATE UNIQUE INDEX IF NOT EXISTS exams_code_unique_idx
  ON public.exams (code)
  WHERE code IS NOT NULL;

COMMENT ON COLUMN public.exams.code IS 'Stable business id (e.g. A1-01) for idempotent seeding.';

-- 2) form_fill question type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'exam_question_type' AND e.enumlabel = 'form_fill'
  ) THEN
    ALTER TYPE public.exam_question_type ADD VALUE 'form_fill';
  END IF;
END $$;

-- 3) Answer key explanation + teacher payload (audio scripts, samples, rubric)
ALTER TABLE public.exam_answer_keys
  ADD COLUMN IF NOT EXISTS explanation text,
  ADD COLUMN IF NOT EXISTS teacher_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4) Rubric / field-level grading detail on answers
ALTER TABLE public.exam_answers
  ADD COLUMN IF NOT EXISTS grading_detail jsonb;

-- 5) Normalize helper for form_fill
CREATE OR REPLACE FUNCTION public.normalize_exam_text(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(both FROM regexp_replace(replace(coalesce(p_value, ''), chr(160), ' '), '\s+', ' ', 'g')));
$$;

CREATE OR REPLACE FUNCTION public.score_form_fill_answer(
  p_answer jsonb,
  p_source jsonb,
  p_fields jsonb
)
RETURNS TABLE (awarded numeric, is_all_correct boolean, detail jsonb)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  field jsonb;
  v_key text;
  v_points numeric;
  v_expected text;
  v_student text;
  v_ok boolean;
  v_awarded numeric := 0;
  v_max numeric := 0;
  v_detail jsonb := '{}'::jsonb;
BEGIN
  FOR field IN SELECT * FROM jsonb_array_elements(coalesce(p_fields, '[]'::jsonb))
  LOOP
    v_key := field ->> 'key';
    v_points := coalesce((field ->> 'points')::numeric, 0);
    v_max := v_max + v_points;
    v_expected := public.normalize_exam_text(p_source ->> v_key);
    v_student := public.normalize_exam_text(p_answer ->> v_key);
    v_ok := v_expected <> '' AND v_student = v_expected;
    IF v_ok THEN
      v_awarded := v_awarded + v_points;
    END IF;
    v_detail := jsonb_set(v_detail, ARRAY[v_key], to_jsonb(v_ok), true);
  END LOOP;
  awarded := v_awarded;
  is_all_correct := (v_max > 0 AND v_awarded = v_max);
  detail := v_detail;
  RETURN NEXT;
END;
$$;

-- 6) Submit attempt with form_fill auto-grade
CREATE OR REPLACE FUNCTION public.submit_exam_attempt(p_attempt_id uuid)
RETURNS public.exam_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_row public.exam_attempts;
  q record;
  student_answer jsonb;
  student_values text[];
  key_values text[];
  is_obj boolean;
  correct boolean;
  awarded numeric(6, 2);
  total_score numeric(8, 2) := 0;
  total_max numeric(8, 2) := 0;
  skill_map jsonb := '{}'::jsonb;
  skill_key text;
  skill_score numeric;
  skill_max numeric;
  needs_manual boolean := false;
  final_status public.exam_attempt_status;
  form_score record;
  form_source jsonb;
  form_fields jsonb;
  grading_detail jsonb;
BEGIN
  SELECT * INTO attempt_row FROM public.exam_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF attempt_row.id IS NULL THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_FOUND';
  END IF;
  IF attempt_row.student_id <> public.current_student_id() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF attempt_row.status NOT IN ('in_progress', 'expired') THEN
    RETURN attempt_row;
  END IF;

  FOR q IN
    SELECT
      eq.id AS question_id,
      eq.type,
      eq.points,
      eq.metadata,
      es.skill::text AS skill,
      ak.correct_values,
      ak.teacher_payload
    FROM public.exam_questions eq
    JOIN public.exam_sections es ON es.id = eq.section_id
    LEFT JOIN public.exam_answer_keys ak ON ak.question_id = eq.id
    WHERE es.exam_id = attempt_row.exam_id
  LOOP
    total_max := total_max + q.points;
    SELECT a.answer INTO student_answer
    FROM public.exam_answers a
    WHERE a.attempt_id = p_attempt_id AND a.question_id = q.question_id;

    grading_detail := NULL;

    IF q.type = 'form_fill' THEN
      form_source := coalesce(q.teacher_payload -> 'source_data', '{}'::jsonb);
      form_fields := coalesce(q.metadata -> 'fields', q.teacher_payload -> 'fields', '[]'::jsonb);
      SELECT * INTO form_score
      FROM public.score_form_fill_answer(
        CASE WHEN jsonb_typeof(student_answer) = 'object' THEN student_answer ELSE '{}'::jsonb END,
        form_source,
        form_fields
      );
      awarded := form_score.awarded;
      correct := form_score.is_all_correct;
      grading_detail := jsonb_build_object('field_results', form_score.detail);
      total_score := total_score + awarded;

      INSERT INTO public.exam_answers (
        attempt_id, question_id, answer, is_correct, points_awarded, grading_detail
      )
      VALUES (
        p_attempt_id,
        q.question_id,
        coalesce(student_answer, '{}'::jsonb),
        correct,
        awarded,
        grading_detail
      )
      ON CONFLICT (attempt_id, question_id)
      DO UPDATE SET
        is_correct = excluded.is_correct,
        points_awarded = excluded.points_awarded,
        grading_detail = excluded.grading_detail,
        updated_at = now();

      skill_key := q.skill;
      skill_max := coalesce((skill_map -> skill_key ->> 'max')::numeric, 0) + q.points;
      skill_score := coalesce((skill_map -> skill_key ->> 'score')::numeric, 0) + awarded;
      skill_map := jsonb_set(
        skill_map,
        ARRAY[skill_key],
        jsonb_build_object('score', skill_score, 'max', skill_max),
        true
      );
      CONTINUE;
    END IF;

    is_obj := q.type IN (
      'single_choice', 'multiple_choice', 'true_false', 'listening', 'ordering', 'matching'
    );

    IF NOT is_obj OR q.correct_values IS NULL THEN
      needs_manual := true;
      UPDATE public.exam_answers
      SET is_correct = NULL, points_awarded = 0, updated_at = now()
      WHERE attempt_id = p_attempt_id AND question_id = q.question_id;
      IF NOT FOUND THEN
        INSERT INTO public.exam_answers (attempt_id, question_id, answer, is_correct, points_awarded)
        VALUES (p_attempt_id, q.question_id, 'null'::jsonb, NULL, 0);
      END IF;
      skill_key := q.skill;
      skill_max := coalesce((skill_map -> skill_key ->> 'max')::numeric, 0) + q.points;
      skill_score := coalesce((skill_map -> skill_key ->> 'score')::numeric, 0);
      skill_map := jsonb_set(
        skill_map,
        ARRAY[skill_key],
        jsonb_build_object('score', skill_score, 'max', skill_max),
        true
      );
      CONTINUE;
    END IF;

    IF student_answer IS NULL OR student_answer = 'null'::jsonb THEN
      student_values := ARRAY[]::text[];
    ELSIF jsonb_typeof(student_answer) = 'array' THEN
      SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::text[])
      INTO student_values
      FROM (
        SELECT jsonb_array_elements_text(student_answer) AS x
      ) t;
    ELSE
      student_values := ARRAY[trim(both '"' from student_answer::text)];
    END IF;

    key_values := q.correct_values;
    SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::text[])
    INTO key_values
    FROM unnest(q.correct_values) AS x;

    SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::text[])
    INTO student_values
    FROM unnest(student_values) AS x;

    correct := student_values = key_values;
    awarded := CASE WHEN correct THEN q.points ELSE 0 END;
    total_score := total_score + awarded;

    INSERT INTO public.exam_answers (attempt_id, question_id, answer, is_correct, points_awarded)
    VALUES (
      p_attempt_id,
      q.question_id,
      coalesce(student_answer, 'null'::jsonb),
      correct,
      awarded
    )
    ON CONFLICT (attempt_id, question_id)
    DO UPDATE SET
      is_correct = excluded.is_correct,
      points_awarded = excluded.points_awarded,
      updated_at = now();

    skill_key := q.skill;
    skill_max := coalesce((skill_map -> skill_key ->> 'max')::numeric, 0) + q.points;
    skill_score := coalesce((skill_map -> skill_key ->> 'score')::numeric, 0) + awarded;
    skill_map := jsonb_set(
      skill_map,
      ARRAY[skill_key],
      jsonb_build_object('score', skill_score, 'max', skill_max),
      true
    );
  END LOOP;

  final_status := CASE WHEN needs_manual THEN 'submitted'::public.exam_attempt_status ELSE 'graded'::public.exam_attempt_status END;

  UPDATE public.exam_attempts
  SET
    status = final_status,
    submitted_at = now(),
    score = total_score,
    max_score = total_max,
    percentage = CASE WHEN total_max > 0 THEN round((total_score / total_max) * 100, 2) ELSE 0 END,
    skill_breakdown = skill_map,
    updated_at = now()
  WHERE id = p_attempt_id
  RETURNING * INTO attempt_row;

  RETURN attempt_row;
END;
$$;

-- 7) Writing grade with optional rubric detail
DROP FUNCTION IF EXISTS public.grade_exam_writing_answer(uuid, uuid, numeric, text);
CREATE OR REPLACE FUNCTION public.grade_exam_writing_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_points numeric,
  p_comment text DEFAULT NULL,
  p_grading_detail jsonb DEFAULT NULL
)
RETURNS public.exam_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_row public.exam_attempts;
  v_class_id uuid;
  v_level_id uuid;
  q_type text;
  q_points numeric(6, 2);
  total_score numeric(8, 2) := 0;
  total_max numeric(8, 2) := 0;
  skill_map jsonb := '{}'::jsonb;
  skill_key text;
  skill_score numeric;
  skill_max numeric;
  pending_manual boolean := false;
  r record;
BEGIN
  SELECT * INTO attempt_row FROM public.exam_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF attempt_row.id IS NULL THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_FOUND';
  END IF;
  IF attempt_row.status NOT IN ('submitted', 'graded', 'expired') THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_READY';
  END IF;

  SELECT e.class_id, e.level_id INTO v_class_id, v_level_id
  FROM public.exams e WHERE e.id = attempt_row.exam_id;

  IF NOT (public.is_admin() OR public.teacher_can_manage_exam(v_class_id, v_level_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT eq.type::text, eq.points
  INTO q_type, q_points
  FROM public.exam_questions eq
  JOIN public.exam_sections es ON es.id = eq.section_id
  WHERE eq.id = p_question_id AND es.exam_id = attempt_row.exam_id;

  IF q_type IS NULL THEN
    RAISE EXCEPTION 'QUESTION_NOT_FOUND';
  END IF;
  IF q_type NOT IN ('writing', 'text', 'speaking', 'open_text') THEN
    RAISE EXCEPTION 'NOT_MANUAL_QUESTION';
  END IF;
  IF p_points IS NULL OR p_points < 0 OR p_points > q_points THEN
    RAISE EXCEPTION 'INVALID_POINTS';
  END IF;

  INSERT INTO public.exam_answers (
    attempt_id, question_id, answer, is_correct, points_awarded, teacher_comment, grading_detail
  )
  VALUES (
    p_attempt_id,
    p_question_id,
    coalesce(
      (SELECT answer FROM public.exam_answers WHERE attempt_id = p_attempt_id AND question_id = p_question_id),
      'null'::jsonb
    ),
    CASE WHEN p_points > 0 THEN true ELSE false END,
    p_points,
    nullif(trim(coalesce(p_comment, '')), ''),
    p_grading_detail
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    is_correct = EXCLUDED.is_correct,
    points_awarded = EXCLUDED.points_awarded,
    teacher_comment = EXCLUDED.teacher_comment,
    grading_detail = COALESCE(EXCLUDED.grading_detail, public.exam_answers.grading_detail),
    updated_at = now();

  FOR r IN
    SELECT
      eq.id AS question_id,
      eq.type::text AS qtype,
      eq.points,
      es.skill::text AS skill,
      a.points_awarded,
      a.is_correct
    FROM public.exam_questions eq
    JOIN public.exam_sections es ON es.id = eq.section_id
    LEFT JOIN public.exam_answers a
      ON a.question_id = eq.id AND a.attempt_id = p_attempt_id
    WHERE es.exam_id = attempt_row.exam_id
  LOOP
    total_max := total_max + r.points;
    total_score := total_score + coalesce(r.points_awarded, 0);

    IF r.qtype IN ('writing', 'text', 'speaking', 'open_text')
       AND r.is_correct IS NULL THEN
      pending_manual := true;
    END IF;

    skill_key := r.skill;
    skill_max := coalesce((skill_map -> skill_key ->> 'max')::numeric, 0) + r.points;
    skill_score := coalesce((skill_map -> skill_key ->> 'score')::numeric, 0)
      + coalesce(r.points_awarded, 0);
    skill_map := jsonb_set(
      skill_map,
      ARRAY[skill_key],
      jsonb_build_object('score', skill_score, 'max', skill_max),
      true
    );
  END LOOP;

  UPDATE public.exam_attempts
  SET
    status = CASE WHEN pending_manual THEN 'submitted'::public.exam_attempt_status
                  ELSE 'graded'::public.exam_attempt_status END,
    score = total_score,
    max_score = total_max,
    percentage = CASE WHEN total_max > 0 THEN round((total_score / total_max) * 100, 2) ELSE 0 END,
    skill_breakdown = skill_map,
    updated_at = now()
  WHERE id = p_attempt_id
  RETURNING * INTO attempt_row;

  IF attempt_row.status = 'graded' THEN
    PERFORM public.create_in_app_notification(
      (SELECT profile_id FROM public.students WHERE id = attempt_row.student_id),
      'Examen corrigé',
      'Votre examen a été corrigé. Consultez votre résultat.',
      'exam',
      'exam-result',
      attempt_row.id::text,
      jsonb_build_object('attempt_id', attempt_row.id, 'percentage', attempt_row.percentage)
    );
  END IF;

  RETURN attempt_row;
END;
$$;

-- 8) Post-submit review: reveal correct answers + explanations only after submit
CREATE OR REPLACE FUNCTION public.get_exam_attempt_review(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_row public.exam_attempts;
  v_class_id uuid;
  v_level_id uuid;
  result jsonb;
BEGIN
  SELECT * INTO attempt_row FROM public.exam_attempts WHERE id = p_attempt_id;
  IF attempt_row.id IS NULL THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_FOUND';
  END IF;
  IF attempt_row.status = 'in_progress' THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_SUBMITTED';
  END IF;

  SELECT e.class_id, e.level_id INTO v_class_id, v_level_id
  FROM public.exams e WHERE e.id = attempt_row.exam_id;

  IF NOT (
    public.is_admin()
    OR public.teacher_can_manage_exam(v_class_id, v_level_id)
    OR attempt_row.student_id = public.current_student_id()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT coalesce(jsonb_agg(row_data ORDER BY sort_section, sort_question), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      es.sort_order AS sort_section,
      eq.sort_order AS sort_question,
      jsonb_build_object(
        'question_id', eq.id,
        'external_id', eq.metadata ->> 'bank_question_id',
        'skill', es.skill,
        'section_title', es.title,
        'type', eq.type,
        'prompt', eq.prompt,
        'instruction', eq.metadata ->> 'instruction',
        'passage', eq.metadata ->> 'passage',
        'points', eq.points,
        'student_answer', a.answer,
        'is_correct', a.is_correct,
        'points_awarded', a.points_awarded,
        'correct_values', CASE
          WHEN eq.type = 'form_fill' THEN NULL
          ELSE ak.correct_values
        END,
        'correct_form', CASE
          WHEN eq.type = 'form_fill' THEN ak.teacher_payload -> 'source_data'
          ELSE NULL
        END,
        'explanation', ak.explanation,
        'options', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'value', o.value,
            'label', o.label
          ) ORDER BY o.sort_order), '[]'::jsonb)
          FROM public.exam_question_options o
          WHERE o.question_id = eq.id
        ),
        'teacher_comment', a.teacher_comment,
        'grading_detail', a.grading_detail
      ) AS row_data
    FROM public.exam_questions eq
    JOIN public.exam_sections es ON es.id = eq.section_id
    LEFT JOIN public.exam_answers a
      ON a.question_id = eq.id AND a.attempt_id = p_attempt_id
    LEFT JOIN public.exam_answer_keys ak ON ak.question_id = eq.id
    WHERE es.exam_id = attempt_row.exam_id
  ) t;

  RETURN jsonb_build_object(
    'attempt_id', attempt_row.id,
    'status', attempt_row.status,
    'score', attempt_row.score,
    'max_score', attempt_row.max_score,
    'percentage', attempt_row.percentage,
    'skill_breakdown', attempt_row.skill_breakdown,
    'items', result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_exam_text(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.score_form_fill_answer(jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exam_attempt_review(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_exam_writing_answer(uuid, uuid, numeric, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exam_attempt_review(uuid) TO authenticated;
