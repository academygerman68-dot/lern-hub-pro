-- Additive: exam_audio_tracks for B1 Hören (4 tracks per exam).
-- Does not alter A1 question media_path; backfills from existing Hören rows.

CREATE TABLE IF NOT EXISTS public.exam_audio_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams (id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.exam_sections (id) ON DELETE SET NULL,
  part_number integer NOT NULL CHECK (part_number BETWEEN 1 AND 4),
  media_bucket text NOT NULL DEFAULT 'course-materials',
  media_path text NOT NULL,
  original_filename text,
  mime_type text,
  duration_seconds numeric,
  sha256 text,
  verification_status text NOT NULL DEFAULT 'needs_review'
    CHECK (verification_status IN ('uploaded', 'needs_review', 'content_verified', 'invalid')),
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, part_number)
);

CREATE INDEX IF NOT EXISTS exam_audio_tracks_exam_id_idx
  ON public.exam_audio_tracks (exam_id);

ALTER TABLE public.exam_audio_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_audio_tracks_staff_select ON public.exam_audio_tracks;
CREATE POLICY exam_audio_tracks_staff_select
  ON public.exam_audio_tracks
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS exam_audio_tracks_staff_write ON public.exam_audio_tracks;
CREATE POLICY exam_audio_tracks_staff_write
  ON public.exam_audio_tracks
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_teacher())
  WITH CHECK (public.is_admin() OR public.is_teacher());

-- Students: no direct table access; playback stays via signed URLs on questions.

-- Backfill from Hören questions (one row per exam + part with a media_path).
INSERT INTO public.exam_audio_tracks (
  exam_id,
  section_id,
  part_number,
  media_bucket,
  media_path,
  original_filename,
  mime_type,
  duration_seconds,
  sha256,
  verification_status,
  sort_order,
  metadata
)
SELECT DISTINCT ON (es.exam_id, part_num)
  es.exam_id,
  es.id AS section_id,
  part_num,
  coalesce(nullif(btrim(eq.media_bucket), ''), 'course-materials'),
  eq.media_path,
  nullif(eq.metadata ->> 'original_filename', ''),
  nullif(eq.metadata ->> 'mime_type', ''),
  CASE
    WHEN (eq.metadata ->> 'duration_seconds') ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (eq.metadata ->> 'duration_seconds')::numeric
    ELSE NULL
  END,
  nullif(eq.metadata ->> 'sha256', ''),
  CASE
    WHEN coalesce(eq.metadata ->> 'audio_verification_status', '') = 'content_verified'
      THEN 'content_verified'
    WHEN coalesce(eq.metadata ->> 'audio_verification_status', '') = 'invalid'
      THEN 'invalid'
    WHEN coalesce(eq.metadata ->> 'audio_verification_status', '') = 'uploaded'
      THEN 'uploaded'
    ELSE 'needs_review'
  END,
  part_num,
  jsonb_build_object(
    'backfilled_from_question_id', eq.id,
    'audio_verification_note', eq.metadata -> 'audio_verification_note'
  )
FROM public.exam_questions eq
JOIN public.exam_sections es ON es.id = eq.section_id
CROSS JOIN LATERAL (
  SELECT COALESCE(
    NULLIF((eq.metadata ->> 'audio_slot')::int, 0),
    NULLIF((eq.metadata ->> 'teil')::int, 0)
  ) AS part_num
) parts
WHERE es.skill = 'hoeren'
  AND eq.media_path IS NOT NULL
  AND btrim(eq.media_path) <> ''
  AND part_num BETWEEN 1 AND 4
ORDER BY es.exam_id, part_num, eq.sort_order
ON CONFLICT (exam_id, part_number) DO UPDATE SET
  media_path = EXCLUDED.media_path,
  media_bucket = EXCLUDED.media_bucket,
  original_filename = COALESCE(EXCLUDED.original_filename, public.exam_audio_tracks.original_filename),
  duration_seconds = COALESCE(EXCLUDED.duration_seconds, public.exam_audio_tracks.duration_seconds),
  sha256 = COALESCE(EXCLUDED.sha256, public.exam_audio_tracks.sha256),
  verification_status = EXCLUDED.verification_status,
  metadata = public.exam_audio_tracks.metadata || EXCLUDED.metadata,
  updated_at = now();

-- Completeness: for exams with audio_tracks, count 4 tracks (not 30 questions).
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
