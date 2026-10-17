-- Finalize overdue mock-exam attempts and hide answer keys until submission.
--
-- Does not drop training tables, does not rewrite submitted/graded historical scores,
-- and does not change exam_score_percentage (Goethe conversion stays on goethe_a1_adult_v1 only).
--
-- 1) start_exam_attempt
--    OLD: an in-progress attempt past expires_at was marked expired and did not count
--         toward max_attempts, so a student could open another attempt and still submit
--         the expired one later.
--    NEW: that attempt is graded from answers already stored (submit_exam_attempt).
--         Rows left as expired also count toward max_attempts.
--         A still-valid in-progress attempt is resumed unchanged.
--
-- 2) get_exam_attempt_review
--    OLD: any status other than in_progress returned correct_values (including expired).
--    NEW: correct answers are returned only for submitted or graded attempts.
--
-- submit_exam_attempt still accepts in_progress and expired so the stored answers can
-- be graded once. save_exam_answer rejects writes after expires_at.
--
-- Expired-attempt rules:
--   Written and objective saves stop at expires_at.
--   A non-Goethe late save marks the attempt expired.
--   A Goethe A1 late written save does not change the status, so Sprechen can
--   still be stored while the attempt remains in_progress, then submitted.
--   Non-Goethe oral saves after expires_at are rejected.
--   Manual grading accepts only submitted or graded attempts, so objective
--   answers are scored by submit_exam_attempt before a teacher assigns points.

CREATE OR REPLACE FUNCTION public.start_exam_attempt(p_exam_id uuid)
RETURNS public.exam_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid := public.current_student_id();
  exam_row public.exams;
  existing public.exam_attempts;
  attempt_count integer;
  result public.exam_attempts;
  v_report jsonb;
  mins integer;
BEGIN
  IF sid IS NULL THEN
    RAISE EXCEPTION 'STUDENT_REQUIRED';
  END IF;
  IF NOT public.student_can_access_exam(p_exam_id) THEN
    RAISE EXCEPTION 'EXAM_NOT_ALLOWED';
  END IF;

  SELECT * INTO exam_row FROM public.exams WHERE id = p_exam_id;
  IF exam_row.id IS NULL OR exam_row.status <> 'published' THEN
    RAISE EXCEPTION 'EXAM_NOT_PUBLISHED';
  END IF;

  v_report := public.exam_completeness_report(p_exam_id);
  IF NOT coalesce((v_report ->> 'ok')::boolean, false) THEN
    RAISE EXCEPTION 'EXAM_INCOMPLETE'
      USING ERRCODE = 'P0001',
            DETAIL = coalesce(v_report ->> 'issues', '[]');
  END IF;

  SELECT * INTO existing
  FROM public.exam_attempts
  WHERE exam_id = p_exam_id
    AND student_id = sid
    AND status = 'in_progress'
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF existing.id IS NOT NULL THEN
    IF existing.expires_at > now() THEN
      RETURN existing;
    END IF;
    -- Server clock is the authority. Grade answers already saved; do not open
    -- a fresh attempt while this one is still unfinished.
    PERFORM public.submit_exam_attempt(existing.id);
  END IF;

  SELECT count(*) INTO attempt_count
  FROM public.exam_attempts
  WHERE exam_id = p_exam_id
    AND student_id = sid
    AND status IN ('submitted', 'graded', 'expired');

  IF attempt_count >= exam_row.max_attempts THEN
    RAISE EXCEPTION 'MAX_ATTEMPTS_REACHED';
  END IF;

  -- Written clock. speaking_duration_minutes is indicative only and is not added
  -- here, so objective items cannot be edited during an extra oral window.
  mins := coalesce(exam_row.written_duration_minutes, exam_row.duration_minutes, 65);

  INSERT INTO public.exam_attempts (exam_id, student_id, expires_at, status)
  VALUES (
    p_exam_id,
    sid,
    now() + make_interval(mins => mins),
    'in_progress'
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

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
  -- expired and in_progress must not reveal correct_values.
  IF attempt_row.status NOT IN ('submitted', 'graded') THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_SUBMITTED';
  END IF;

  SELECT e.class_id, e.level_id INTO v_class_id, v_level_id
  FROM public.exams e WHERE e.id = attempt_row.exam_id;

  -- SECURITY DEFINER bypasses exam_attempts RLS. Match that policy:
  -- admin, the attempt owner, or a teacher of both the exam and that student.
  IF NOT (
    public.is_admin()
    OR attempt_row.student_id = public.current_student_id()
    OR (
      public.is_teacher()
      AND public.teacher_can_manage_exam(v_class_id, v_level_id)
      AND public.teacher_has_student(attempt_row.student_id)
    )
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
        'answer_media_bucket', a.answer_media_bucket,
        'answer_media_path', a.answer_media_path,
        'answer_mime_type', a.answer_mime_type,
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

REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_exam_attempt_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exam_attempt_review(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_exam_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_answer jsonb,
  p_flagged boolean DEFAULT false
)
RETURNS public.exam_answers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_row public.exam_attempts;
  result public.exam_answers;
  v_profile text;
  v_code text;
  v_goethe boolean;
BEGIN
  SELECT * INTO attempt_row FROM public.exam_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF attempt_row.id IS NULL THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_FOUND';
  END IF;
  IF attempt_row.student_id <> public.current_student_id() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF attempt_row.status <> 'in_progress' THEN
    RAISE EXCEPTION 'ATTEMPT_LOCKED';
  END IF;
  IF attempt_row.expires_at <= now() THEN
    SELECT e.format_profile, e.code INTO v_profile, v_code
    FROM public.exams e WHERE e.id = attempt_row.exam_id;
    v_goethe := v_profile = 'goethe_a1_adult_v1' OR coalesce(v_code, '') LIKE 'A1-SIM-%';
    IF NOT v_goethe THEN
      UPDATE public.exam_attempts SET status = 'expired' WHERE id = attempt_row.id;
    END IF;
    RAISE EXCEPTION 'ATTEMPT_EXPIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.exam_questions q
    JOIN public.exam_sections s ON s.id = q.section_id
    WHERE q.id = p_question_id AND s.exam_id = attempt_row.exam_id
  ) THEN
    RAISE EXCEPTION 'QUESTION_NOT_IN_EXAM';
  END IF;

  INSERT INTO public.exam_answers (attempt_id, question_id, answer, flagged)
  VALUES (p_attempt_id, p_question_id, coalesce(p_answer, 'null'::jsonb), coalesce(p_flagged, false))
  ON CONFLICT (attempt_id, question_id)
  DO UPDATE SET
    answer = excluded.answer,
    flagged = excluded.flagged,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_exam_oral_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_bucket text,
  p_path text,
  p_mime_type text DEFAULT NULL,
  p_flagged boolean DEFAULT false
)
RETURNS public.exam_answers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_row public.exam_attempts;
  q_type text;
  answer_row public.exam_answers;
  payload jsonb;
  v_profile text;
  v_code text;
  v_goethe boolean;
BEGIN
  IF p_bucket IS NULL OR nullif(trim(p_bucket), '') IS NULL THEN
    RAISE EXCEPTION 'BUCKET_REQUIRED';
  END IF;
  IF p_path IS NULL OR nullif(trim(p_path), '') IS NULL THEN
    RAISE EXCEPTION 'PATH_REQUIRED';
  END IF;

  SELECT * INTO attempt_row FROM public.exam_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF attempt_row.id IS NULL THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_FOUND';
  END IF;
  IF attempt_row.status <> 'in_progress' THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_EDITABLE';
  END IF;
  IF attempt_row.student_id <> public.current_student_id() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF attempt_row.expires_at IS NOT NULL AND attempt_row.expires_at <= now() THEN
    SELECT e.format_profile, e.code INTO v_profile, v_code
    FROM public.exams e WHERE e.id = attempt_row.exam_id;
    v_goethe := v_profile = 'goethe_a1_adult_v1' OR coalesce(v_code, '') LIKE 'A1-SIM-%';
    IF NOT v_goethe THEN
      UPDATE public.exam_attempts SET status = 'expired' WHERE id = attempt_row.id;
      RAISE EXCEPTION 'ATTEMPT_EXPIRED';
    END IF;
  END IF;

  SELECT eq.type::text
  INTO q_type
  FROM public.exam_questions eq
  JOIN public.exam_sections es ON es.id = eq.section_id
  WHERE eq.id = p_question_id AND es.exam_id = attempt_row.exam_id;

  IF q_type IS NULL THEN
    RAISE EXCEPTION 'QUESTION_NOT_FOUND';
  END IF;
  IF q_type <> 'speaking' THEN
    RAISE EXCEPTION 'NOT_SPEAKING_QUESTION';
  END IF;

  IF split_part(p_path, '/', 1) <> 'exam-oral'
     OR split_part(p_path, '/', 2) <> p_attempt_id::text
     OR split_part(p_path, '/', 3) <> attempt_row.student_id::text THEN
    RAISE EXCEPTION 'INVALID_ORAL_PATH';
  END IF;

  payload := jsonb_build_object(
    'kind', 'oral_audio',
    'bucket', p_bucket,
    'path', p_path,
    'mime_type', nullif(trim(coalesce(p_mime_type, '')), '')
  );

  INSERT INTO public.exam_answers (
    attempt_id, question_id, answer, flagged,
    answer_media_bucket, answer_media_path, answer_mime_type
  )
  VALUES (
    p_attempt_id, p_question_id, payload, coalesce(p_flagged, false),
    p_bucket, p_path, nullif(trim(coalesce(p_mime_type, '')), '')
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    answer = excluded.answer,
    flagged = excluded.flagged,
    answer_media_bucket = excluded.answer_media_bucket,
    answer_media_path = excluded.answer_media_path,
    answer_mime_type = excluded.answer_mime_type,
    updated_at = now()
  RETURNING * INTO answer_row;

  RETURN answer_row;
END;
$$;

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
  IF attempt_row.status NOT IN ('submitted', 'graded') THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_READY';
  END IF;

  SELECT e.class_id, e.level_id INTO v_class_id, v_level_id
  FROM public.exams e WHERE e.id = attempt_row.exam_id;

  IF NOT (public.is_admin() OR public.teacher_can_manage_exam(v_class_id, v_level_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT public.is_admin() THEN
    IF NOT public.teacher_has_student(attempt_row.student_id) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
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
    CASE WHEN p_points >= q_points THEN true WHEN p_points > 0 THEN false ELSE false END,
    p_points,
    nullif(trim(coalesce(p_comment, '')), ''),
    p_grading_detail
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    is_correct = EXCLUDED.is_correct,
    points_awarded = EXCLUDED.points_awarded,
    teacher_comment = EXCLUDED.teacher_comment,
    grading_detail = coalesce(EXCLUDED.grading_detail, public.exam_answers.grading_detail),
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
       AND (r.is_correct IS NULL OR r.points_awarded IS NULL) THEN
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
    percentage = public.exam_score_percentage(attempt_row.exam_id, total_score, total_max),
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

REVOKE ALL ON FUNCTION public.save_exam_answer(uuid, uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_exam_answer(uuid, uuid, jsonb, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.save_exam_oral_answer(uuid, uuid, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_exam_oral_answer(uuid, uuid, text, text, text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.grade_exam_writing_answer(uuid, uuid, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_exam_writing_answer(uuid, uuid, numeric, text, jsonb) TO authenticated;
