-- MANUAL ROLLBACK for 20260927180000_exam_engine_security_goethe_a1.sql
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

CREATE OR REPLACE FUNCTION public.teacher_can_manage_exam(p_class_id uuid, p_level_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_admin()
    OR (
      p_class_id IS NOT NULL
      AND public.is_teacher_of_class(p_class_id)
    );
$$;

REVOKE ALL ON FUNCTION public.teacher_can_manage_exam(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_can_manage_exam(uuid, uuid) TO authenticated;

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
  LIMIT 1;

  IF existing.id IS NOT NULL THEN
    IF existing.expires_at <= now() THEN
      UPDATE public.exam_attempts
      SET status = 'expired', updated_at = now()
      WHERE id = existing.id;
    ELSE
      RETURN existing;
    END IF;
  END IF;

  SELECT count(*) INTO attempt_count
  FROM public.exam_attempts
  WHERE exam_id = p_exam_id
    AND student_id = sid
    AND status IN ('submitted', 'graded');

  IF attempt_count >= exam_row.max_attempts THEN
    RAISE EXCEPTION 'MAX_ATTEMPTS_REACHED';
  END IF;

  INSERT INTO public.exam_attempts (exam_id, student_id, expires_at, status)
  VALUES (
    p_exam_id,
    sid,
    now() + make_interval(mins => exam_row.duration_minutes),
    'in_progress'
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;

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

REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid) TO authenticated;

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

REVOKE ALL ON FUNCTION public.grade_exam_writing_answer(uuid, uuid, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_exam_writing_answer(uuid, uuid, numeric, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.exam_completeness_report(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues text[] := ARRAY[]::text[];
  v_question_count int := 0;
  v_horen_total int := 0;
  v_horen_ready int := 0;
  v_track_count int := 0;
  v_class_id uuid;
  v_level_id uuid;
  v_needs_horen boolean;
  v_has_audio boolean;
  v_is_ocr_draft boolean;
  v_audio_verification text;
  v_points_rubric text;
  v_transform_status text;
  v_has_tracks boolean := false;
  r record;
  t record;
BEGIN
  SELECT class_id, level_id INTO v_class_id, v_level_id
  FROM public.exams WHERE id = p_exam_id;

  IF NOT EXISTS (SELECT 1 FROM public.exams WHERE id = p_exam_id) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'issues', jsonb_build_array('Examen introuvable'),
      'horen_ready', 0,
      'horen_total', 0
    );
  END IF;

  IF NOT (
    public.is_admin()
    OR public.is_teacher()
    OR public.student_can_access_exam(p_exam_id)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_track_count
  FROM public.exam_audio_tracks
  WHERE exam_id = p_exam_id;
  v_has_tracks := v_track_count > 0;

  IF v_has_tracks THEN
    v_horen_total := 4;
    SELECT count(*) INTO v_horen_ready
    FROM public.exam_audio_tracks
    WHERE exam_id = p_exam_id
      AND media_path IS NOT NULL
      AND btrim(media_path) <> ''
      AND verification_status <> 'invalid';

    FOR t IN
      SELECT part_number, media_path, verification_status
      FROM public.exam_audio_tracks
      WHERE exam_id = p_exam_id
      ORDER BY part_number
    LOOP
      IF t.media_path IS NULL OR btrim(t.media_path) = '' THEN
        v_issues := array_append(
          v_issues,
          format('Audio Hören manquant · Teil %s', t.part_number)
        );
      ELSIF t.verification_status <> 'content_verified' THEN
        v_issues := array_append(
          v_issues,
          format('Audio Hören non vérifié (contenu) · Teil %s', t.part_number)
        );
      END IF;
    END LOOP;

    -- Missing parts entirely
    IF v_track_count < 4 THEN
      v_issues := array_append(
        v_issues,
        format('Pistes Hören incomplètes · %s/4', v_track_count)
      );
    END IF;
  END IF;

  FOR r IN
    SELECT
      eq.id,
      eq.prompt,
      eq.type,
      eq.points,
      eq.media_path,
      eq.media_bucket,
      eq.metadata,
      es.skill,
      es.title AS section_title,
      ak.correct_values,
      ak.teacher_payload
    FROM public.exam_questions eq
    JOIN public.exam_sections es ON es.id = eq.section_id
    LEFT JOIN public.exam_answer_keys ak ON ak.question_id = eq.id
    WHERE es.exam_id = p_exam_id
    ORDER BY es.sort_order, eq.sort_order
  LOOP
    v_question_count := v_question_count + 1;

    IF coalesce(r.points, 0) <= 0 THEN
      v_issues := array_append(
        v_issues,
        format('Barème invalide · %s · « %s »', r.section_title, left(r.prompt, 60))
      );
    END IF;

    IF nullif(btrim(r.prompt), '') IS NULL THEN
      v_issues := array_append(
        v_issues,
        format('Consigne manquante · %s', r.section_title)
      );
    END IF;

    v_needs_horen := public.exam_question_needs_horen_audio(r.skill, r.type);
    v_has_audio := public.exam_question_has_audio(r.media_path, r.media_bucket, r.metadata);
    v_is_ocr_draft :=
      coalesce((r.metadata ->> 'needs_review')::boolean, false) = true
      OR coalesce(r.metadata ->> 'transcription_status', '') = 'ocr_unverified';
    v_audio_verification := nullif(btrim(coalesce(r.metadata ->> 'audio_verification_status', '')), '');
    v_points_rubric := nullif(btrim(coalesce(r.metadata ->> 'points_rubric', '')), '');
    v_transform_status := nullif(btrim(coalesce(r.metadata ->> 'transform_status', '')), '');

    -- Legacy per-question audio only when no exam_audio_tracks (A1 / classic).
    IF v_needs_horen AND NOT v_has_tracks THEN
      v_horen_total := v_horen_total + 1;
      IF v_has_audio THEN
        v_horen_ready := v_horen_ready + 1;
      ELSE
        v_issues := array_append(
          v_issues,
          format('Audio Hören manquant · « %s »', left(r.prompt, 60))
        );
      END IF;

      IF v_has_audio THEN
        IF v_audio_verification IS NOT NULL AND v_audio_verification <> 'content_verified' THEN
          v_issues := array_append(
            v_issues,
            format('Audio Hören non vérifié (contenu) · « %s »', left(r.prompt, 60))
          );
        ELSIF v_audio_verification IS NULL AND v_is_ocr_draft THEN
          v_issues := array_append(
            v_issues,
            format('Audio Hören non confirmé · « %s »', left(r.prompt, 60))
          );
        END IF;
      END IF;
    END IF;

    IF v_is_ocr_draft THEN
      v_issues := array_append(
        v_issues,
        format('OCR non validé · « %s »', left(r.prompt, 60))
      );
    END IF;

    IF v_points_rubric = 'provisional_needs_review' THEN
      v_issues := array_append(
        v_issues,
        format('Barème provisoire · « %s »', left(r.prompt, 60))
      );
    END IF;

    IF v_transform_status = 'placeholder' THEN
      v_issues := array_append(
        v_issues,
        format('Placeholder OCR · « %s »', left(r.prompt, 60))
      );
    END IF;

    IF r.type IN ('true_false', 'single_choice', 'multiple_choice') THEN
      IF r.correct_values IS NULL OR cardinality(r.correct_values) = 0 THEN
        v_issues := array_append(
          v_issues,
          format('Réponse correcte manquante · « %s »', left(r.prompt, 60))
        );
      END IF;
    ELSIF r.type = 'form_fill' THEN
      IF coalesce(r.metadata -> 'fields', '[]'::jsonb) = '[]'::jsonb
         AND coalesce(r.teacher_payload -> 'fields', '[]'::jsonb) = '[]'::jsonb THEN
        v_issues := array_append(
          v_issues,
          format('Formulaire incomplet · « %s »', left(r.prompt, 60))
        );
      END IF;
      IF coalesce(r.teacher_payload -> 'source_data', '{}'::jsonb) = '{}'::jsonb THEN
        v_issues := array_append(
          v_issues,
          format('Clé formulaire manquante · « %s »', left(r.prompt, 60))
        );
      END IF;
    ELSIF r.type IN ('writing', 'text', 'open_text', 'speaking') THEN
      IF nullif(btrim(r.prompt), '') IS NULL THEN
        v_issues := array_append(
          v_issues,
          format('Writing mal configuré · %s', r.section_title)
        );
      END IF;
    END IF;
  END LOOP;

  IF v_question_count = 0 THEN
    v_issues := array_append(v_issues, 'Aucune question dans l’examen');
  END IF;

  RETURN jsonb_build_object(
    'ok', coalesce(cardinality(v_issues), 0) = 0,
    'issues', to_jsonb(v_issues),
    'horen_ready', v_horen_ready,
    'horen_total', v_horen_total,
    'question_count', v_question_count
  );
END;
$$;

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
