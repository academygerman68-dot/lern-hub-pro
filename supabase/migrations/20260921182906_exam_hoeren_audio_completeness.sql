-- Hören audio: expand mime types + completeness validation (publish + start).

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'video/mp4',
  'image/jpeg',
  'image/png',
  'application/zip'
]::text[]
WHERE id = 'course-materials';

CREATE OR REPLACE FUNCTION public.exam_question_needs_horen_audio(
  p_skill public.exam_skill,
  p_type public.exam_question_type
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_skill = 'hoeren' OR p_type = 'listening';
$$;

CREATE OR REPLACE FUNCTION public.exam_question_has_audio(
  p_media_path text,
  p_media_bucket text,
  p_metadata jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    (nullif(btrim(coalesce(p_media_path, '')), '') IS NOT NULL
      AND nullif(btrim(coalesce(p_media_bucket, '')), '') IS NOT NULL)
    OR nullif(btrim(coalesce(p_metadata ->> 'audio_url', '')), '') IS NOT NULL;
$$;

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
  v_class_id uuid;
  v_level_id uuid;
  r record;
BEGIN
  SELECT class_id, level_id INTO v_class_id, v_level_id
  FROM public.exams WHERE id = p_exam_id;

  IF v_class_id IS NULL AND v_level_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.exams WHERE id = p_exam_id
  ) THEN
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

    IF public.exam_question_needs_horen_audio(r.skill, r.type) THEN
      v_horen_total := v_horen_total + 1;
      IF public.exam_question_has_audio(r.media_path, r.media_bucket, r.metadata) THEN
        v_horen_ready := v_horen_ready + 1;
      ELSE
        v_issues := array_append(
          v_issues,
          format('Audio Hören manquant · « %s »', left(r.prompt, 60))
        );
      END IF;
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

CREATE OR REPLACE FUNCTION public.exam_is_complete(p_exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((public.exam_completeness_report(p_exam_id) ->> 'ok')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.publish_exam(p_exam_id uuid)
RETURNS public.exams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam public.exams;
  v_report jsonb;
BEGIN
  SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id FOR UPDATE;
  IF v_exam.id IS NULL THEN
    RAISE EXCEPTION 'EXAM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.teacher_can_manage_exam(v_exam.class_id, v_exam.level_id)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  v_report := public.exam_completeness_report(p_exam_id);
  IF NOT coalesce((v_report ->> 'ok')::boolean, false) THEN
    RAISE EXCEPTION 'EXAM_INCOMPLETE: %', coalesce(v_report ->> 'issues', '[]')
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.exams
  SET
    status = 'published',
    published_at = coalesce(published_at, now()),
    updated_at = now()
  WHERE id = p_exam_id
  RETURNING * INTO v_exam;

  RETURN v_exam;
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

REVOKE ALL ON FUNCTION public.exam_question_needs_horen_audio(public.exam_skill, public.exam_question_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exam_question_needs_horen_audio(public.exam_skill, public.exam_question_type) TO authenticated;

REVOKE ALL ON FUNCTION public.exam_question_has_audio(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exam_question_has_audio(text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.exam_completeness_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exam_completeness_report(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.exam_is_complete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exam_is_complete(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.publish_exam(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_exam(uuid) TO authenticated;
