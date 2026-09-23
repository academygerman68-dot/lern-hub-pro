-- B1 OCR / audio verification publish gates.
-- Extends exam_completeness_report so B1 OCR drafts stay unpublished until
-- manual review confirms OCR text and Hören audio. Classic A1 exams without
-- these metadata flags are unaffected.

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
  v_needs_horen boolean;
  v_has_audio boolean;
  v_is_ocr_draft boolean;
  v_audio_verification text;
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

    v_needs_horen := public.exam_question_needs_horen_audio(r.skill, r.type);
    v_has_audio := public.exam_question_has_audio(r.media_path, r.media_bucket, r.metadata);
    v_is_ocr_draft :=
      coalesce((r.metadata ->> 'needs_review')::boolean, false) = true
      OR coalesce(r.metadata ->> 'transcription_status', '') = 'ocr_unverified';
    v_audio_verification := nullif(btrim(coalesce(r.metadata ->> 'audio_verification_status', '')), '');

    IF v_needs_horen THEN
      v_horen_total := v_horen_total + 1;
      IF v_has_audio THEN
        v_horen_ready := v_horen_ready + 1;
      ELSE
        v_issues := array_append(
          v_issues,
          format('Audio Hören manquant · « %s »', left(r.prompt, 60))
        );
      END IF;
    END IF;

    -- OCR non validé — only when B1 OCR flags are present (A1 unaffected).
    IF v_is_ocr_draft THEN
      v_issues := array_append(
        v_issues,
        format('OCR non validé · « %s »', left(r.prompt, 60))
      );
    END IF;

    -- Audio Hören non confirmé — only when media is present.
    -- Classic A1 uploads without verification/OCR flags stay unaffected.
    IF v_needs_horen AND v_has_audio THEN
      IF v_audio_verification IS NOT NULL AND v_audio_verification <> 'confirmed' THEN
        v_issues := array_append(
          v_issues,
          format('Audio Hören non confirmé · « %s »', left(r.prompt, 60))
        );
      ELSIF v_audio_verification IS NULL AND v_is_ocr_draft THEN
        v_issues := array_append(
          v_issues,
          format('Audio Hören non confirmé · « %s »', left(r.prompt, 60))
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

-- Keep publish_exam gated on completeness (unchanged contract).
-- B1 OCR drafts remain unpublished until review clears the issues above.

REVOKE ALL ON FUNCTION public.exam_completeness_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exam_completeness_report(uuid) TO authenticated;
