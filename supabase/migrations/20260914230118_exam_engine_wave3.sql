-- Wave 3: Exam engine + mock exam seeds A1–B2

CREATE TYPE public.exam_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.exam_attempt_status AS ENUM ('in_progress', 'submitted', 'graded', 'expired');
CREATE TYPE public.exam_skill AS ENUM (
  'lesen',
  'hoeren',
  'schreiben',
  'sprechen',
  'grammatik',
  'wortschatz'
);
CREATE TYPE public.exam_question_type AS ENUM (
  'single_choice',
  'multiple_choice',
  'true_false',
  'text',
  'matching',
  'ordering',
  'listening',
  'writing',
  'speaking'
);

CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  level_id uuid NOT NULL REFERENCES public.levels (id) ON DELETE RESTRICT,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  pass_percentage numeric(5, 2) NOT NULL DEFAULT 60 CHECK (pass_percentage BETWEEN 0 AND 100),
  status public.exam_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  is_mock boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.exam_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams (id) ON DELETE CASCADE,
  skill public.exam_skill NOT NULL,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  duration_minutes integer,
  max_score numeric(8, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.exam_sections (id) ON DELETE CASCADE,
  type public.exam_question_type NOT NULL,
  prompt text NOT NULL,
  media_path text,
  media_bucket text DEFAULT 'course-materials',
  points numeric(6, 2) NOT NULL DEFAULT 1 CHECK (points >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.exam_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.exam_questions (id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Protected answer key — never exposed via student SELECT policies
CREATE TABLE public.exam_answer_keys (
  question_id uuid PRIMARY KEY REFERENCES public.exam_questions (id) ON DELETE CASCADE,
  correct_values text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  expires_at timestamptz NOT NULL,
  status public.exam_attempt_status NOT NULL DEFAULT 'in_progress',
  score numeric(8, 2),
  max_score numeric(8, 2),
  percentage numeric(5, 2),
  skill_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.exam_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.exam_questions (id) ON DELETE CASCADE,
  answer jsonb NOT NULL DEFAULT 'null'::jsonb,
  is_correct boolean,
  points_awarded numeric(6, 2),
  flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX exams_level_id_idx ON public.exams (level_id);
CREATE INDEX exams_status_idx ON public.exams (status);
CREATE INDEX exam_sections_exam_id_idx ON public.exam_sections (exam_id);
CREATE INDEX exam_questions_section_id_idx ON public.exam_questions (section_id);
CREATE INDEX exam_question_options_question_id_idx ON public.exam_question_options (question_id);
CREATE INDEX exam_attempts_student_id_idx ON public.exam_attempts (student_id);
CREATE INDEX exam_attempts_exam_id_idx ON public.exam_attempts (exam_id);
CREATE INDEX exam_attempts_status_idx ON public.exam_attempts (status);
CREATE INDEX exam_answers_attempt_id_idx ON public.exam_answers (attempt_id);

CREATE TRIGGER exams_set_updated_at BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER exam_sections_set_updated_at BEFORE UPDATE ON public.exam_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER exam_questions_set_updated_at BEFORE UPDATE ON public.exam_questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER exam_answer_keys_set_updated_at BEFORE UPDATE ON public.exam_answer_keys FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER exam_attempts_set_updated_at BEFORE UPDATE ON public.exam_attempts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER exam_answers_set_updated_at BEFORE UPDATE ON public.exam_answers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helpers
CREATE OR REPLACE FUNCTION public.student_level_sort_order(p_student_id uuid DEFAULT public.current_student_id())
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT l.sort_order
      FROM public.students s
      JOIN public.levels l ON l.code = s.level_code
      WHERE s.id = p_student_id
    ),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.student_can_access_exam(p_exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exams e
    JOIN public.levels l ON l.id = e.level_id
    WHERE e.id = p_exam_id
      AND e.status = 'published'
      AND (
        public.is_admin()
        OR public.is_teacher()
        OR (
          public.is_student()
          AND public.current_student_id() IS NOT NULL
          AND public.has_active_academic_access()
          AND l.sort_order <= public.student_level_sort_order()
        )
      )
  );
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
BEGIN
  SELECT * INTO attempt_row FROM public.exam_attempts WHERE id = p_attempt_id;
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
    UPDATE public.exam_attempts SET status = 'expired' WHERE id = attempt_row.id;
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
      es.skill::text AS skill,
      ak.correct_values
    FROM public.exam_questions eq
    JOIN public.exam_sections es ON es.id = eq.section_id
    LEFT JOIN public.exam_answer_keys ak ON ak.question_id = eq.id
    WHERE es.exam_id = attempt_row.exam_id
  LOOP
    total_max := total_max + q.points;
    SELECT a.answer INTO student_answer
    FROM public.exam_answers a
    WHERE a.attempt_id = p_attempt_id AND a.question_id = q.question_id;

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

REVOKE ALL ON FUNCTION public.student_level_sort_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.student_can_access_exam(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_exam_answer(uuid, uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.student_level_sort_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_access_exam(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_exam_answer(uuid, uuid, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid) TO authenticated;

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY exams_select ON public.exams
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_teacher()
  OR (status = 'published' AND public.student_can_access_exam(id))
);

CREATE POLICY exams_write ON public.exams
FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE POLICY exam_sections_select ON public.exam_sections
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_teacher()
  OR public.student_can_access_exam(exam_id)
);

CREATE POLICY exam_sections_write ON public.exam_sections
FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE POLICY exam_questions_select ON public.exam_questions
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_teacher()
  OR EXISTS (
    SELECT 1 FROM public.exam_sections s
    WHERE s.id = section_id AND public.student_can_access_exam(s.exam_id)
  )
);

CREATE POLICY exam_questions_write ON public.exam_questions
FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE POLICY exam_options_select ON public.exam_question_options
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_teacher()
  OR EXISTS (
    SELECT 1
    FROM public.exam_questions q
    JOIN public.exam_sections s ON s.id = q.section_id
    WHERE q.id = question_id AND public.student_can_access_exam(s.exam_id)
  )
);

CREATE POLICY exam_options_write ON public.exam_question_options
FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE POLICY exam_answer_keys_staff ON public.exam_answer_keys
FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE POLICY exam_attempts_select ON public.exam_attempts
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_teacher()
  OR student_id = public.current_student_id()
);

-- Students must not insert/update attempts directly; use RPCs
CREATE POLICY exam_attempts_admin_write ON public.exam_attempts
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY exam_answers_select ON public.exam_answers
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_teacher()
  OR EXISTS (
    SELECT 1 FROM public.exam_attempts a
    WHERE a.id = attempt_id AND a.student_id = public.current_student_id()
  )
);

CREATE POLICY exam_answers_admin_write ON public.exam_answers
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- DEMO SEED: one published mock exam per level A1–B2
DO $$
DECLARE
  lvl record;
  exam_id uuid;
  sec_id uuid;
  qid uuid;
  titles text[] := ARRAY[
    'A1 Mock Exam 01',
    'A2 Mock Exam 01',
    'B1 Mock Exam 01',
    'B2 Mock Exam 01'
  ];
  idx integer := 0;
BEGIN
  FOR lvl IN
    SELECT id, code FROM public.levels WHERE code IN ('A1', 'A2', 'B1', 'B2') ORDER BY sort_order
  LOOP
    idx := idx + 1;
    INSERT INTO public.exams (
      title, description, level_id, duration_minutes, pass_percentage, status, published_at, is_mock, max_attempts
    )
    VALUES (
      titles[idx],
      'Development seed mock exam for level ' || lvl.code,
      lvl.id,
      25,
      60,
      'published',
      now(),
      true,
      5
    )
    RETURNING id INTO exam_id;

    -- Grammatik section
    INSERT INTO public.exam_sections (exam_id, skill, title, description, sort_order, max_score)
    VALUES (exam_id, 'grammatik', 'Grammatik', 'Objective grammar items', 1, 3)
    RETURNING id INTO sec_id;

    INSERT INTO public.exam_questions (section_id, type, prompt, points, sort_order)
    VALUES (sec_id, 'single_choice', 'Wählen Sie die richtige Form: Ich ___ Student.', 1, 1)
    RETURNING id INTO qid;
    INSERT INTO public.exam_question_options (question_id, label, value, sort_order) VALUES
      (qid, 'bin', 'bin', 1),
      (qid, 'bist', 'bist', 2),
      (qid, 'ist', 'ist', 3),
      (qid, 'sind', 'sind', 4);
    INSERT INTO public.exam_answer_keys (question_id, correct_values) VALUES (qid, ARRAY['bin']);

    INSERT INTO public.exam_questions (section_id, type, prompt, points, sort_order)
    VALUES (sec_id, 'true_false', 'Der Artikel für „Haus“ ist „die“.', 1, 2)
    RETURNING id INTO qid;
    INSERT INTO public.exam_question_options (question_id, label, value, sort_order) VALUES
      (qid, 'Wahr', 'true', 1),
      (qid, 'Falsch', 'false', 2);
    INSERT INTO public.exam_answer_keys (question_id, correct_values) VALUES (qid, ARRAY['false']);

    INSERT INTO public.exam_questions (section_id, type, prompt, points, sort_order)
    VALUES (sec_id, 'single_choice', 'Welches Verb passt? Wir ___ nach Berlin.', 1, 3)
    RETURNING id INTO qid;
    INSERT INTO public.exam_question_options (question_id, label, value, sort_order) VALUES
      (qid, 'fahre', 'fahre', 1),
      (qid, 'fährst', 'faehrst', 2),
      (qid, 'fahren', 'fahren', 3),
      (qid, 'fahrt', 'fahrt', 4);
    INSERT INTO public.exam_answer_keys (question_id, correct_values) VALUES (qid, ARRAY['fahren']);

    -- Wortschatz / Lesen
    INSERT INTO public.exam_sections (exam_id, skill, title, description, sort_order, max_score)
    VALUES (exam_id, 'wortschatz', 'Wortschatz', 'Vocabulary for ' || lvl.code, 2, 2)
    RETURNING id INTO sec_id;

    INSERT INTO public.exam_questions (section_id, type, prompt, points, sort_order)
    VALUES (sec_id, 'single_choice', 'Was bedeutet „Bahnhof“?', 1, 1)
    RETURNING id INTO qid;
    INSERT INTO public.exam_question_options (question_id, label, value, sort_order) VALUES
      (qid, 'Airport', 'airport', 1),
      (qid, 'Train station', 'station', 2),
      (qid, 'Hospital', 'hospital', 3),
      (qid, 'Library', 'library', 4);
    INSERT INTO public.exam_answer_keys (question_id, correct_values) VALUES (qid, ARRAY['station']);

    INSERT INTO public.exam_questions (section_id, type, prompt, points, sort_order)
    VALUES (sec_id, 'single_choice', 'Welches Wort passt zu „Guten Morgen“?', 1, 2)
    RETURNING id INTO qid;
    INSERT INTO public.exam_question_options (question_id, label, value, sort_order) VALUES
      (qid, 'Greeting', 'greeting', 1),
      (qid, 'Food', 'food', 2),
      (qid, 'Color', 'color', 3),
      (qid, 'Number', 'number', 4);
    INSERT INTO public.exam_answer_keys (question_id, correct_values) VALUES (qid, ARRAY['greeting']);

    -- Hören (listening type, media optional)
    INSERT INTO public.exam_sections (exam_id, skill, title, description, sort_order, max_score)
    VALUES (exam_id, 'hoeren', 'Hören', 'Listening comprehension (audio optional)', 3, 1)
    RETURNING id INTO sec_id;

    INSERT INTO public.exam_questions (section_id, type, prompt, points, sort_order, media_path, metadata)
    VALUES (
      sec_id,
      'listening',
      'Hören Sie (Audio optional). Wohin geht die Person?',
      1,
      1,
      NULL,
      jsonb_build_object('audio_status', 'missing', 'level', lvl.code)
    )
    RETURNING id INTO qid;
    INSERT INTO public.exam_question_options (question_id, label, value, sort_order) VALUES
      (qid, 'Zur Schule', 'schule', 1),
      (qid, 'Zum Arzt', 'arzt', 2),
      (qid, 'Zum Supermarkt', 'markt', 3),
      (qid, 'Nach Hause', 'hause', 4);
    INSERT INTO public.exam_answer_keys (question_id, correct_values) VALUES (qid, ARRAY['schule']);

    -- Schreiben (manual)
    INSERT INTO public.exam_sections (exam_id, skill, title, description, sort_order, max_score)
    VALUES (exam_id, 'schreiben', 'Schreiben', 'Short writing task', 4, 2)
    RETURNING id INTO sec_id;

    INSERT INTO public.exam_questions (section_id, type, prompt, points, sort_order)
    VALUES (
      sec_id,
      'writing',
      'Schreiben Sie 3–5 Sätze über Ihren Alltag (Niveau ' || lvl.code || ').',
      2,
      1
    );
  END LOOP;
END $$;
