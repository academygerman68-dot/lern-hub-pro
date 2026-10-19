-- Courses can target a whole level (class_id null) or a specific group.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS courses_class_id_idx ON public.courses (class_id);

COMMENT ON COLUMN public.courses.class_id IS
  'Optional group audience. NULL = whole level; set = only that class.';

-- Keep class/level consistent when a group is chosen.
CREATE OR REPLACE FUNCTION public.courses_enforce_class_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  class_level uuid;
BEGIN
  IF NEW.class_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.level_id INTO class_level
  FROM public.classes c
  WHERE c.id = NEW.class_id;

  IF class_level IS NULL THEN
    RAISE EXCEPTION 'COURSE_CLASS_NOT_FOUND';
  END IF;

  IF class_level <> NEW.level_id THEN
    RAISE EXCEPTION 'COURSE_CLASS_LEVEL_MISMATCH';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS courses_enforce_class_level ON public.courses;
CREATE TRIGGER courses_enforce_class_level
BEFORE INSERT OR UPDATE OF class_id, level_id ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.courses_enforce_class_level();

-- Mirror assignment access: level-wide OR enrolled in the course class.
CREATE OR REPLACE FUNCTION public.student_can_access_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses c
    JOIN public.levels l ON l.id = c.level_id
    JOIN public.students s ON s.profile_id = auth.uid()
    WHERE c.id = p_course_id
      AND c.status = 'published'
      AND public.is_active_user()
      AND (
        (
          c.class_id IS NOT NULL
          AND public.is_enrolled_in_class(c.class_id)
        )
        OR (
          c.class_id IS NULL
          AND s.level_code IS NOT NULL
          AND s.level_code = l.code
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.student_can_access_course(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.student_can_access_course(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
