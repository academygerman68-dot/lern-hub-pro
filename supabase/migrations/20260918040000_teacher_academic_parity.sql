-- Align teacher write rights with admin for academic content,
-- but require teachers to target only their assigned classes (or levels they teach for courses).

CREATE OR REPLACE FUNCTION public.teacher_can_manage_assignment(p_class_id uuid, p_level_id uuid)
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

CREATE OR REPLACE FUNCTION public.teacher_can_manage_library_item(
  p_audience text,
  p_class_id uuid,
  p_level_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_admin()
    OR (
      p_audience = 'class'
      AND p_class_id IS NOT NULL
      AND public.is_teacher_of_class(p_class_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_manage_course(p_level_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.teacher_id = public.current_teacher_id()
        AND c.level_id = p_level_id
        AND c.status <> 'archived'
    );
$$;

REVOKE ALL ON FUNCTION public.teacher_can_manage_exam(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_can_manage_library_item(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_can_manage_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_can_manage_exam(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_manage_library_item(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_manage_course(uuid) TO authenticated;

-- Assignments: already uses teacher_can_manage_assignment (now class-required for teachers).

-- Exams write policies
DROP POLICY IF EXISTS exams_write ON public.exams;
DROP POLICY IF EXISTS exams_insert_staff ON public.exams;
DROP POLICY IF EXISTS exams_update_staff ON public.exams;
DROP POLICY IF EXISTS exams_delete_staff ON public.exams;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exams' AND policyname = 'exams_write_staff'
  ) THEN
    DROP POLICY exams_write_staff ON public.exams;
  END IF;
END $$;

CREATE POLICY exams_insert_staff
  ON public.exams
  FOR INSERT
  TO authenticated
  WITH CHECK (public.teacher_can_manage_exam(class_id, level_id));

CREATE POLICY exams_update_staff
  ON public.exams
  FOR UPDATE
  TO authenticated
  USING (public.teacher_can_manage_exam(class_id, level_id))
  WITH CHECK (public.teacher_can_manage_exam(class_id, level_id));

CREATE POLICY exams_delete_staff
  ON public.exams
  FOR DELETE
  TO authenticated
  USING (public.teacher_can_manage_exam(class_id, level_id));

-- Library items write
DROP POLICY IF EXISTS library_items_write_staff ON public.library_items;
DROP POLICY IF EXISTS library_items_insert_staff ON public.library_items;
DROP POLICY IF EXISTS library_items_update_staff ON public.library_items;
DROP POLICY IF EXISTS library_items_delete_staff ON public.library_items;

CREATE POLICY library_items_insert_staff
  ON public.library_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.teacher_can_manage_library_item(audience::text, class_id, level_code)
  );

CREATE POLICY library_items_update_staff
  ON public.library_items
  FOR UPDATE
  TO authenticated
  USING (public.teacher_can_manage_library_item(audience::text, class_id, level_code))
  WITH CHECK (public.teacher_can_manage_library_item(audience::text, class_id, level_code));

CREATE POLICY library_items_delete_staff
  ON public.library_items
  FOR DELETE
  TO authenticated
  USING (public.teacher_can_manage_library_item(audience::text, class_id, level_code));

-- Courses write: teachers only for levels of their assigned groups
DROP POLICY IF EXISTS courses_write_staff ON public.courses;
DROP POLICY IF EXISTS courses_insert_staff ON public.courses;
DROP POLICY IF EXISTS courses_update_staff ON public.courses;
DROP POLICY IF EXISTS courses_delete_staff ON public.courses;

CREATE POLICY courses_insert_staff
  ON public.courses
  FOR INSERT
  TO authenticated
  WITH CHECK (public.teacher_can_manage_course(level_id));

CREATE POLICY courses_update_staff
  ON public.courses
  FOR UPDATE
  TO authenticated
  USING (public.teacher_can_manage_course(level_id))
  WITH CHECK (public.teacher_can_manage_course(level_id));

CREATE POLICY courses_delete_staff
  ON public.courses
  FOR DELETE
  TO authenticated
  USING (public.teacher_can_manage_course(level_id));
