-- Optional audit trail for Gemini grade assistance (never auto-publishes scores).
CREATE TABLE IF NOT EXISTS public.ai_grade_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_kind text NOT NULL CHECK (target_kind IN ('assignment', 'exam_writing')),
  target_id uuid NOT NULL,
  student_id uuid REFERENCES public.students (id) ON DELETE SET NULL,
  requested_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  level_code text,
  prompt_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggestion jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'accepted', 'edited', 'ignored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_grade_suggestions_target_idx
  ON public.ai_grade_suggestions (target_kind, target_id);

CREATE INDEX IF NOT EXISTS ai_grade_suggestions_requested_by_idx
  ON public.ai_grade_suggestions (requested_by);

ALTER TABLE public.ai_grade_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_grade_suggestions_staff_select ON public.ai_grade_suggestions;
CREATE POLICY ai_grade_suggestions_staff_select
ON public.ai_grade_suggestions FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS ai_grade_suggestions_staff_insert ON public.ai_grade_suggestions;
CREATE POLICY ai_grade_suggestions_staff_insert
ON public.ai_grade_suggestions FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS ai_grade_suggestions_staff_update ON public.ai_grade_suggestions;
CREATE POLICY ai_grade_suggestions_staff_update
ON public.ai_grade_suggestions FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE TRIGGER ai_grade_suggestions_set_updated_at
  BEFORE UPDATE ON public.ai_grade_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
