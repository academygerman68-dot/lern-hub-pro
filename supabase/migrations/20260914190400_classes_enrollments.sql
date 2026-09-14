-- Phase 4: Classes + Enrollments + tightened student visibility

CREATE TYPE public.class_status AS ENUM ('planned', 'active', 'completed', 'archived');
CREATE TYPE public.enrollment_status AS ENUM ('active', 'completed', 'withdrawn', 'suspended');

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level_id uuid NOT NULL REFERENCES public.levels (id) ON DELETE RESTRICT,
  teacher_id uuid REFERENCES public.teachers (id) ON DELETE SET NULL,
  capacity integer NOT NULL DEFAULT 20 CHECK (capacity > 0),
  status public.class_status NOT NULL DEFAULT 'planned',
  start_date date,
  end_date date,
  room text,
  schedule_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT classes_name_unique UNIQUE (name)
);

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE RESTRICT,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE RESTRICT,
  status public.enrollment_status NOT NULL DEFAULT 'active',
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX enrollments_one_active_per_student_class
ON public.enrollments (student_id, class_id)
WHERE status = 'active';

CREATE INDEX classes_level_id_idx ON public.classes (level_id);
CREATE INDEX classes_teacher_id_idx ON public.classes (teacher_id);
CREATE INDEX classes_status_idx ON public.classes (status);
CREATE INDEX enrollments_student_id_idx ON public.enrollments (student_id);
CREATE INDEX enrollments_class_id_idx ON public.enrollments (class_id);
CREATE INDEX enrollments_status_idx ON public.enrollments (status);

CREATE TRIGGER classes_set_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER enrollments_set_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_teacher_of_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = p_class_id
      AND c.teacher_id = public.current_teacher_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled_in_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.class_id = p_class_id
      AND e.student_id = public.current_student_id()
      AND e.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_has_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.classes c ON c.id = e.class_id
    WHERE e.student_id = p_student_id
      AND e.status = 'active'
      AND c.teacher_id = public.current_teacher_id()
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_of_class(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_enrolled_in_class(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_has_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enrolled_in_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_has_student(uuid) TO authenticated;

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY classes_select
ON public.classes FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_teacher_of_class(id)
  OR public.is_enrolled_in_class(id)
);

CREATE POLICY classes_write_admin
ON public.classes FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY enrollments_select
ON public.enrollments FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR student_id = public.current_student_id()
  OR public.is_teacher_of_class(class_id)
);

CREATE POLICY enrollments_write_admin
ON public.enrollments FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Tighten students SELECT: teachers only see assigned students
DROP POLICY IF EXISTS students_select_own_teacher_or_admin ON public.students;
CREATE POLICY students_select_own_assigned_or_admin
ON public.students
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR profile_id = auth.uid()
  OR public.teacher_has_student(id)
);
