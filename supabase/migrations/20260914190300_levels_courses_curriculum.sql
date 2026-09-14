-- Phase 3: Levels + Courses + Modules + Units + Lessons

CREATE TYPE public.content_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE public.levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT levels_code_format CHECK (code ~ '^[A-Z][0-9]$')
);

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES public.levels (id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  status public.content_status NOT NULL DEFAULT 'draft',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  status public.content_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  status public.content_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  content_markdown text,
  duration_minutes integer,
  sort_order integer NOT NULL DEFAULT 0,
  status public.content_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX courses_level_id_idx ON public.courses (level_id);
CREATE INDEX courses_status_idx ON public.courses (status);
CREATE INDEX modules_course_id_idx ON public.modules (course_id);
CREATE INDEX units_module_id_idx ON public.units (module_id);
CREATE INDEX lessons_unit_id_idx ON public.lessons (unit_id);

CREATE TRIGGER levels_set_updated_at BEFORE UPDATE ON public.levels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER courses_set_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER modules_set_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER units_set_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER lessons_set_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.levels (code, name, description, sort_order) VALUES
  ('A1', 'A1 — Beginner', 'Basic German for absolute beginners', 1),
  ('A2', 'A2 — Elementary', 'Elementary German communication', 2),
  ('B1', 'B1 — Intermediate', 'Independent intermediate German', 3),
  ('B2', 'B2 — Upper Intermediate', 'Upper-intermediate German proficiency', 4);

-- Link students.level_code to levels.code when present
ALTER TABLE public.students
  ADD CONSTRAINT students_level_code_fkey
  FOREIGN KEY (level_code) REFERENCES public.levels (code) ON DELETE SET NULL;

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY levels_select_authenticated
ON public.levels FOR SELECT TO authenticated
USING (is_active = true OR public.is_admin());

CREATE POLICY levels_write_admin
ON public.levels FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY courses_select
ON public.courses FOR SELECT TO authenticated
USING (status = 'published' OR public.is_admin() OR public.is_teacher());

CREATE POLICY courses_write_staff
ON public.courses FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE POLICY modules_select
ON public.modules FOR SELECT TO authenticated
USING (status = 'published' OR public.is_admin() OR public.is_teacher());

CREATE POLICY modules_write_staff
ON public.modules FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE POLICY units_select
ON public.units FOR SELECT TO authenticated
USING (status = 'published' OR public.is_admin() OR public.is_teacher());

CREATE POLICY units_write_staff
ON public.units FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE POLICY lessons_select
ON public.lessons FOR SELECT TO authenticated
USING (status = 'published' OR public.is_admin() OR public.is_teacher());

CREATE POLICY lessons_write_staff
ON public.lessons FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());
