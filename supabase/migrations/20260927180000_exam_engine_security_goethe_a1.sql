-- GLOBAL exam-engine security + Goethe A1 scoring (no A1 seed content).
-- Companion: 20260927120000_a1_complete_exam_additive.sql (columns + A1-SIM-01 seed only).
--
-- RPC BEHAVIOR DIFF (old → new)
-- 1) teacher_can_manage_exam(class_id, level_id)
--    OLD: admin OR (class_id NOT NULL AND teacher_of_class). Level-wide mocks (class_id NULL) not manageable by teachers.
--    NEW: also allows teachers who teach that level to manage class_id-null exams.
--    IMPACT: teachers of A1 classes can author/manage level-wide A1 mocks. Other exams unchanged if class-scoped.
--
-- 2) exam_score_percentage(exam_id, raw, max) [NEW]
--    OLD: inline (score/max)*100 in submit/grade.
--    NEW: if format_profile=goethe_a1_adult_v1 → round(raw*1.66) integer (60→100); else classic %.
--    IMPACT: only exams with that profile; B1/others keep ratio scoring.
--
-- 3) start_exam_attempt(exam_id)
--    OLD: expires_at = now() + duration_minutes.
--    NEW: expires_at = now() + coalesce(written_duration_minutes, duration_minutes, 65).
--    IMPACT: Goethe A1 uses written clock; others unchanged when written_duration is null.
--
-- 4) submit_exam_attempt(attempt_id)
--    OLD: percentage = (score/max)*100.
--    NEW: percentage = exam_score_percentage(...). Manual/objective loop unchanged otherwise.
--    IMPACT: Goethe A1 conversion only when profile set; other exams identical ratio.
--
-- 5) grade_exam_writing_answer(...)
--    OLD: admin OR teacher_can_manage_exam(exam); no check that student is in teacher's class.
--    NEW: same manage check + teacher must be teacher_of_class(student.class_id); uses exam_score_percentage.
--    IMPACT: teachers cannot grade students outside their classes (security tighten).
--
-- 6) exam_completeness_report(exam_id)
--    OLD: B1/audio-track gates; listening keys not always required; no Goethe structure gates.
--    NEW: preserves B1/track gates + Goethe A1 structure (4×15, Hören 6/4/5, Lesen 5/5/5, rubrics).
--    IMPACT: only exams with profile goethe_a1_adult_v1 or code A1-SIM-01 get extra gates.
--
-- RLS DIFF
-- exam_attempts_select / exam_answers_select:
--   OLD: any teacher can SELECT all attempts/answers.
--   NEW: teacher only if manages exam AND is_teacher_of_class(student.class_id); students own rows; admin all.
-- course_materials_exam_oral_select:
--   OLD: any teacher can read exam-oral storage.
--   NEW: teacher only for attempts of their class students.
-- exam_answer_keys:
--   ENSURE staff-only ALL policy (admin/teacher). Students must never SELECT teacher_payload/correct_values.
--
-- NON-GOETHE COMPAT: format_profile NULL → scoring/timer/completeness behave as before (plus tighter teacher RLS).

-- Teachers may manage level-wide mock exams (class_id null) for levels they teach.
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
      public.is_teacher()
      AND (
        (p_class_id IS NOT NULL AND public.is_teacher_of_class(p_class_id))
        OR (
          p_class_id IS NULL
          AND p_level_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.classes c
            WHERE c.teacher_id = public.current_teacher_id()
              AND c.level_id = p_level_id
              AND c.status <> 'archived'
          )
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.exam_score_percentage(
  p_exam_id uuid,
  p_raw_score numeric,
  p_raw_max numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text;
BEGIN
  SELECT format_profile INTO v_profile FROM public.exams WHERE id = p_exam_id;
  IF v_profile = 'goethe_a1_adult_v1' THEN
    -- Integer half-up: 60*1.66=99.6 → 100 (matches convertA1RawToHundred)
    RETURN round(coalesce(p_raw_score, 0) * 1.66);
  END IF;
  IF coalesce(p_raw_max, 0) <= 0 THEN
    RETURN 0;
  END IF;
  RETURN round((coalesce(p_raw_score, 0) / p_raw_max) * 100, 2);
END;
$$;

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

  -- Written clock for Goethe A1; oral is recorded async in-app.
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
    percentage = public.exam_score_percentage(attempt_row.exam_id, total_score, total_max),
    skill_breakdown = skill_map,
    updated_at = now()
  WHERE id = p_attempt_id
  RETURNING * INTO attempt_row;

  RETURN attempt_row;
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
  IF attempt_row.status NOT IN ('submitted', 'graded', 'expired') THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_READY';
  END IF;

  SELECT e.class_id, e.level_id INTO v_class_id, v_level_id
  FROM public.exams e WHERE e.id = attempt_row.exam_id;

  IF NOT (public.is_admin() OR public.teacher_can_manage_exam(v_class_id, v_level_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Teachers may only grade students in their own classes.
  IF NOT public.is_admin() THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = attempt_row.student_id
        AND s.class_id IS NOT NULL
        AND public.is_teacher_of_class(s.class_id)
    ) THEN
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

-- Completeness: preserve B1/audio-track gates + Goethe A1 adult structure checks.
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
  v_profile text;
  v_code text;
  v_skill text;
  v_skill_points numeric;
  v_count int;
  v_part int;
  v_part_counts int[];
  r record;
  t record;
BEGIN
  SELECT class_id, level_id, format_profile, code
  INTO v_class_id, v_level_id, v_profile, v_code
  FROM public.exams WHERE id = p_exam_id;

  IF NOT FOUND THEN
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

    IF r.type IN ('true_false', 'single_choice', 'multiple_choice', 'listening') THEN
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
      IF coalesce(r.metadata -> 'rubric', '{}'::jsonb) = '{}'::jsonb
         AND coalesce(r.teacher_payload -> 'rubric', '{}'::jsonb) = '{}'::jsonb THEN
        v_issues := array_append(
          v_issues,
          format('Grille manuelle absente · « %s »', left(r.prompt, 60))
        );
      END IF;
    END IF;

    -- Student metadata must not embed teacher-only keys.
    IF r.metadata ? 'audio_script' OR r.metadata ? 'sample_answer' OR r.metadata ? 'correct_answer' THEN
      v_issues := array_append(
        v_issues,
        format('Contenu correcteur dans métadonnées étudiant · « %s »', left(r.prompt, 60))
      );
    END IF;
  END LOOP;

  IF v_question_count = 0 THEN
    v_issues := array_append(v_issues, 'Aucune question dans l’examen');
  END IF;

  IF v_profile = 'goethe_a1_adult_v1' OR v_code = 'A1-SIM-01' THEN
    FOREACH v_skill IN ARRAY ARRAY['hoeren', 'lesen', 'schreiben', 'sprechen']
    LOOP
      SELECT coalesce(sum(eq.points), 0), count(*)::int
      INTO v_skill_points, v_count
      FROM public.exam_questions eq
      JOIN public.exam_sections es ON es.id = eq.section_id
      WHERE es.exam_id = p_exam_id AND es.skill::text = v_skill;

      IF v_count = 0 THEN
        v_issues := array_append(v_issues, 'Compétence manquante · ' || v_skill);
      ELSIF v_skill_points <> 15 THEN
        v_issues := array_append(
          v_issues,
          format('Points compétence %s · %s (attendu 15)', v_skill, v_skill_points)
        );
      END IF;
    END LOOP;

    v_part_counts := ARRAY[]::int[];
    FOR v_part IN 1..3 LOOP
      SELECT count(*)::int INTO v_count
      FROM public.exam_questions eq
      JOIN public.exam_sections es ON es.id = eq.section_id
      WHERE es.exam_id = p_exam_id
        AND es.skill = 'hoeren'
        AND coalesce((eq.metadata ->> 'part')::int, 0) = v_part;
      v_part_counts := v_part_counts || v_count;
    END LOOP;
    IF v_part_counts IS DISTINCT FROM ARRAY[6, 4, 5] THEN
      v_issues := array_append(v_issues, 'Hören parties attendues 6/4/5');
    END IF;

    v_part_counts := ARRAY[]::int[];
    FOR v_part IN 1..3 LOOP
      SELECT count(*)::int INTO v_count
      FROM public.exam_questions eq
      JOIN public.exam_sections es ON es.id = eq.section_id
      WHERE es.exam_id = p_exam_id
        AND es.skill = 'lesen'
        AND coalesce((eq.metadata ->> 'part')::int, 0) = v_part;
      v_part_counts := v_part_counts || v_count;
    END LOOP;
    IF v_part_counts IS DISTINCT FROM ARRAY[5, 5, 5] THEN
      v_issues := array_append(v_issues, 'Lesen parties attendues 5/5/5');
    END IF;

    -- Schreiben form = 5 pts; writing = 10; speaking total 15 already checked.
    SELECT coalesce(sum(eq.points), 0) INTO v_skill_points
    FROM public.exam_questions eq
    JOIN public.exam_sections es ON es.id = eq.section_id
    WHERE es.exam_id = p_exam_id AND es.skill = 'schreiben' AND eq.type = 'form_fill';
    IF v_skill_points <> 5 THEN
      v_issues := array_append(v_issues, format('Schreiben formulaire · %s pts (attendu 5)', v_skill_points));
    END IF;
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

-- Teachers only see attempts of students in their classes (admins keep global).
DROP POLICY IF EXISTS exam_attempts_select ON public.exam_attempts;
CREATE POLICY exam_attempts_select
  ON public.exam_attempts FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      student_id = public.current_student_id()
      AND public.is_active_user()
    )
    OR (
      public.is_teacher()
      AND EXISTS (
        SELECT 1
        FROM public.exams e
        JOIN public.students s ON s.id = exam_attempts.student_id
        WHERE e.id = exam_attempts.exam_id
          AND public.teacher_can_manage_exam(e.class_id, e.level_id)
          AND s.class_id IS NOT NULL
          AND public.is_teacher_of_class(s.class_id)
      )
    )
  );

DROP POLICY IF EXISTS exam_answers_select ON public.exam_answers;
CREATE POLICY exam_answers_select
  ON public.exam_answers FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = attempt_id
        AND a.student_id = public.current_student_id()
        AND public.is_active_user()
    )
    OR (
      public.is_teacher()
      AND EXISTS (
        SELECT 1
        FROM public.exam_attempts a
        JOIN public.exams e ON e.id = a.exam_id
        JOIN public.students s ON s.id = a.student_id
        WHERE a.id = attempt_id
          AND public.teacher_can_manage_exam(e.class_id, e.level_id)
          AND s.class_id IS NOT NULL
          AND public.is_teacher_of_class(s.class_id)
      )
    )
  );

-- Oral audio: teachers only for their class students.
DROP POLICY IF EXISTS course_materials_exam_oral_select ON storage.objects;
CREATE POLICY course_materials_exam_oral_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (storage.foldername(name))[1] = 'exam-oral'
  AND (
    public.is_admin()
    OR (
      public.current_student_id() IS NOT NULL
      AND (storage.foldername(name))[3] = public.current_student_id()::text
    )
    OR (
      public.is_teacher()
      AND EXISTS (
        SELECT 1
        FROM public.exam_attempts a
        JOIN public.students s ON s.id = a.student_id
        WHERE a.id = ((storage.foldername(name))[2])::uuid
          AND s.class_id IS NOT NULL
          AND public.is_teacher_of_class(s.class_id)
      )
    )
  )
);


-- Staff-only answer keys: students must never read correct_values / teacher_payload via PostgREST.
DROP POLICY IF EXISTS exam_answer_keys_staff ON public.exam_answer_keys;
CREATE POLICY exam_answer_keys_staff
  ON public.exam_answer_keys FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_teacher())
  WITH CHECK (public.is_admin() OR public.is_teacher());

REVOKE ALL ON FUNCTION public.exam_score_percentage(uuid, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exam_score_percentage(uuid, numeric, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.grade_exam_writing_answer(uuid, uuid, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_exam_writing_answer(uuid, uuid, numeric, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.exam_completeness_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exam_completeness_report(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.teacher_can_manage_exam(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_can_manage_exam(uuid, uuid) TO authenticated;
