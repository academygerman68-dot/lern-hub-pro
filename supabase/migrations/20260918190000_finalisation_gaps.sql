-- Finalisation gaps: scheduled payment expiry, writing grading, missing notifications

-- ── 1) Server-scheduled expiry of stale payment proofs (48h) ─────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-payment-proofs') THEN
    PERFORM cron.unschedule('expire-stale-payment-proofs');
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-stale-payment-proofs',
  '*/15 * * * *',
  $$SELECT public.expire_stale_payment_proofs();$$
);

GRANT EXECUTE ON FUNCTION public.expire_stale_payment_proofs() TO postgres;

-- ── 2) Writing / manual exam grading ────────────────────────────────────────
ALTER TABLE public.exam_answers
  ADD COLUMN IF NOT EXISTS teacher_comment text;

CREATE OR REPLACE FUNCTION public.grade_exam_writing_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_points numeric,
  p_comment text DEFAULT NULL
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
  q_skill text;
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

  SELECT eq.type::text, eq.points, es.skill::text
  INTO q_type, q_points, q_skill
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
    attempt_id, question_id, answer, is_correct, points_awarded, teacher_comment
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
    nullif(trim(coalesce(p_comment, '')), '')
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    is_correct = EXCLUDED.is_correct,
    points_awarded = EXCLUDED.points_awarded,
    teacher_comment = EXCLUDED.teacher_comment,
    updated_at = now();

  -- Recalculate totals from all answers + question max scores
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

  -- Notify student when fully graded
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

REVOKE ALL ON FUNCTION public.grade_exam_writing_answer(uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_exam_writing_answer(uuid, uuid, numeric, text) TO authenticated;

-- ── 3) Notification: new message ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_preview text;
BEGIN
  v_preview := left(coalesce(nullif(trim(NEW.body), ''), NEW.attachment_name, 'Pièce jointe'), 120);
  FOR r IN
    SELECT cm.profile_id
    FROM public.conversation_members cm
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.profile_id IS DISTINCT FROM NEW.sender_id
  LOOP
    PERFORM public.create_in_app_notification(
      r.profile_id,
      'Nouveau message',
      v_preview,
      'message',
      'messages',
      NEW.conversation_id::text,
      jsonb_build_object('message_id', NEW.id, 'conversation_id', NEW.conversation_id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_notify_members ON public.messages;
CREATE TRIGGER messages_notify_members
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- ── 4) Notification: live session created / schedule changed ────────────────
CREATE OR REPLACE FUNCTION public.notify_live_session_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_title text;
  v_message text;
  v_class_name text;
BEGIN
  SELECT name INTO v_class_name FROM public.classes WHERE id = NEW.class_id;
  IF TG_OP = 'INSERT' THEN
    v_title := 'Nouveau cours en direct';
    v_message := coalesce(NEW.title, 'Séance') || ' · ' || coalesce(v_class_name, 'groupe')
      || ' · ' || to_char(NEW.starts_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
  ELSIF TG_OP = 'UPDATE' AND (
    NEW.starts_at IS DISTINCT FROM OLD.starts_at
    OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
    OR NEW.status IS DISTINCT FROM OLD.status
  ) THEN
    v_title := 'Changement d’horaire live';
    v_message := coalesce(NEW.title, 'Séance') || ' · ' || coalesce(v_class_name, 'groupe')
      || ' · ' || to_char(NEW.starts_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
  ELSE
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT s.profile_id
    FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    WHERE e.class_id = NEW.class_id
      AND e.status = 'active'
      AND s.profile_id IS NOT NULL
  LOOP
    PERFORM public.create_in_app_notification(
      r.profile_id,
      v_title,
      v_message,
      'live',
      'live',
      NEW.id::text,
      jsonb_build_object('session_id', NEW.id, 'starts_at', NEW.starts_at)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_sessions_notify ON public.live_sessions;
CREATE TRIGGER live_sessions_notify
  AFTER INSERT OR UPDATE ON public.live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_live_session_change();

-- ── 5) Notification: new library / resource document ────────────────────────
CREATE OR REPLACE FUNCTION public.notify_new_library_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.class_id IS NOT NULL THEN
    FOR r IN
      SELECT s.profile_id
      FROM public.enrollments e
      JOIN public.students s ON s.id = e.student_id
      WHERE e.class_id = NEW.class_id
        AND e.status = 'active'
        AND s.profile_id IS NOT NULL
    LOOP
      PERFORM public.create_in_app_notification(
        r.profile_id,
        'Nouveau document',
        'Ressource « ' || coalesce(NEW.title, '') || ' » disponible.',
        'document',
        'library',
        NEW.id::text,
        jsonb_build_object('library_item_id', NEW.id)
      );
    END LOOP;
  ELSIF NEW.level_code IS NOT NULL THEN
    FOR r IN
      SELECT DISTINCT s.profile_id
      FROM public.students s
      JOIN public.enrollments e ON e.student_id = s.id AND e.status = 'active'
      JOIN public.classes c ON c.id = e.class_id
      JOIN public.levels l ON l.id = c.level_id
      WHERE l.code = NEW.level_code
        AND s.profile_id IS NOT NULL
    LOOP
      PERFORM public.create_in_app_notification(
        r.profile_id,
        'Nouveau document',
        'Ressource « ' || coalesce(NEW.title, '') || ' » disponible.',
        'document',
        'library',
        NEW.id::text,
        jsonb_build_object('library_item_id', NEW.id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_items_notify ON public.library_items;
CREATE TRIGGER library_items_notify
  AFTER INSERT ON public.library_items
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_library_item();
