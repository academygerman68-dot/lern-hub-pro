-- Phase 2: Students + Teachers

CREATE TYPE public.record_status AS ENUM ('active', 'inactive', 'archived');

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE RESTRICT,
  student_code text UNIQUE,
  level_code text,
  notes text,
  status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE RESTRICT,
  employee_code text UNIQUE,
  specialties text[] NOT NULL DEFAULT '{}',
  bio text,
  hourly_rate numeric(12, 2),
  status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX students_status_idx ON public.students (status);
CREATE INDEX teachers_status_idx ON public.teachers (status);

CREATE TRIGGER students_set_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER teachers_set_updated_at
BEFORE UPDATE ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_role_entity_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  profile_role public.app_role;
BEGIN
  SELECT role INTO profile_role FROM public.profiles WHERE id = NEW.profile_id;
  IF TG_TABLE_NAME = 'students' AND profile_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'students.profile_id must reference a profile with role=student';
  END IF;
  IF TG_TABLE_NAME = 'teachers' AND profile_role IS DISTINCT FROM 'teacher' THEN
    RAISE EXCEPTION 'teachers.profile_id must reference a profile with role=teacher';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER students_role_consistency
BEFORE INSERT OR UPDATE OF profile_id ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.enforce_role_entity_consistency();

CREATE TRIGGER teachers_role_consistency
BEFORE INSERT OR UPDATE OF profile_id ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_role_entity_consistency();

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.students WHERE profile_id = auth.uid() AND status <> 'archived' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.teachers WHERE profile_id = auth.uid() AND status <> 'archived' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_student_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_teacher_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_teacher_id() TO authenticated;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Temporary teacher visibility; tightened after enrollments exist.
CREATE POLICY students_select_own_teacher_or_admin
ON public.students
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR profile_id = auth.uid()
  OR public.is_teacher()
);

CREATE POLICY students_write_admin
ON public.students
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY teachers_select
ON public.teachers
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR profile_id = auth.uid()
  OR public.is_student()
  OR public.is_teacher()
);

CREATE POLICY teachers_write_admin
ON public.teachers
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
