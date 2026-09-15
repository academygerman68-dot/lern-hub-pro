-- Wave 1–2: Library, Assignments, Attendance + curriculum seed (A1–B2)

CREATE TYPE public.library_category AS ENUM (
  'course_material',
  'book',
  'pdf',
  'audio',
  'video',
  'administrative',
  'employment',
  'ausbildung',
  'university',
  'application',
  'announcement'
);

CREATE TYPE public.library_visibility AS ENUM ('private', 'staff', 'academy', 'published');
CREATE TYPE public.assignment_status AS ENUM ('draft', 'published', 'closed', 'archived');
CREATE TYPE public.submission_status AS ENUM ('draft', 'submitted', 'graded', 'returned');
CREATE TYPE public.attendance_mark AS ENUM ('present', 'absent', 'late', 'excused');

CREATE TABLE public.library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category public.library_category NOT NULL DEFAULT 'course_material',
  level_code text REFERENCES public.levels (code) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses (id) ON DELETE SET NULL,
  language text NOT NULL DEFAULT 'de',
  storage_bucket text NOT NULL DEFAULT 'library',
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint,
  visibility public.library_visibility NOT NULL DEFAULT 'academy',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE public.lesson_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  library_item_id uuid NOT NULL REFERENCES public.library_items (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, library_item_id)
);

CREATE TABLE public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  completed_at timestamptz,
  progress_pct integer NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, lesson_id)
);

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  instructions text,
  due_at timestamptz,
  status public.assignment_status NOT NULL DEFAULT 'draft',
  max_score numeric(6,2) NOT NULL DEFAULT 100,
  attachment_path text,
  attachment_bucket text DEFAULT 'course-materials',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  status public.submission_status NOT NULL DEFAULT 'draft',
  content_text text,
  file_path text,
  file_bucket text DEFAULT 'documents',
  score numeric(6,2),
  feedback text,
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers (id) ON DELETE SET NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  mark public.attendance_mark NOT NULL DEFAULT 'present',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE INDEX library_items_level_code_idx ON public.library_items (level_code);
CREATE INDEX library_items_course_id_idx ON public.library_items (course_id);
CREATE INDEX assignments_class_id_idx ON public.assignments (class_id);
CREATE INDEX assignment_submissions_assignment_id_idx ON public.assignment_submissions (assignment_id);
CREATE INDEX assignment_submissions_student_id_idx ON public.assignment_submissions (student_id);
CREATE INDEX attendance_sessions_class_id_idx ON public.attendance_sessions (class_id);
CREATE INDEX attendance_records_session_id_idx ON public.attendance_records (session_id);
CREATE INDEX lesson_progress_student_id_idx ON public.lesson_progress (student_id);

CREATE TRIGGER library_items_set_updated_at BEFORE UPDATE ON public.library_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER assignments_set_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER assignment_submissions_set_updated_at BEFORE UPDATE ON public.assignment_submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER attendance_sessions_set_updated_at BEFORE UPDATE ON public.attendance_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER attendance_records_set_updated_at BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER lesson_progress_set_updated_at BEFORE UPDATE ON public.lesson_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Library: staff write; students see academy/published
CREATE POLICY library_items_select ON public.library_items FOR SELECT TO authenticated
USING (
  public.is_admin() OR public.is_teacher()
  OR visibility IN ('academy', 'published')
  OR created_by = auth.uid()
);

CREATE POLICY library_items_write_staff ON public.library_items FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE POLICY lesson_materials_select ON public.lesson_materials FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_id AND (l.status = 'published' OR public.is_admin() OR public.is_teacher())
  )
);

CREATE POLICY lesson_materials_write_staff ON public.lesson_materials FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher())
WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE POLICY lesson_progress_select ON public.lesson_progress FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.teacher_has_student(student_id)
  OR student_id = public.current_student_id()
);

CREATE POLICY lesson_progress_write_own ON public.lesson_progress FOR ALL TO authenticated
USING (
  public.is_admin()
  OR student_id = public.current_student_id()
)
WITH CHECK (
  public.is_admin()
  OR student_id = public.current_student_id()
);

-- Assignments
CREATE POLICY assignments_select ON public.assignments FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_teacher_of_class(class_id)
  OR (
    status = 'published'
    AND public.is_enrolled_in_class(class_id)
  )
);

CREATE POLICY assignments_write_staff ON public.assignments FOR ALL TO authenticated
USING (
  public.is_admin()
  OR public.is_teacher_of_class(class_id)
)
WITH CHECK (
  public.is_admin()
  OR public.is_teacher()
);

CREATE POLICY submissions_select ON public.assignment_submissions FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR student_id = public.current_student_id()
  OR EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_id AND public.is_teacher_of_class(a.class_id)
  )
);

CREATE POLICY submissions_insert_own ON public.assignment_submissions FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR student_id = public.current_student_id()
);

CREATE POLICY submissions_update ON public.assignment_submissions FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR student_id = public.current_student_id()
  OR EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_id AND public.is_teacher_of_class(a.class_id)
  )
)
WITH CHECK (
  public.is_admin()
  OR student_id = public.current_student_id()
  OR EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_id AND public.is_teacher_of_class(a.class_id)
  )
);

-- Attendance
CREATE POLICY attendance_sessions_select ON public.attendance_sessions FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_teacher_of_class(class_id)
  OR public.is_enrolled_in_class(class_id)
);

CREATE POLICY attendance_sessions_write ON public.attendance_sessions FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher_of_class(class_id))
WITH CHECK (public.is_admin() OR public.is_teacher_of_class(class_id) OR public.is_teacher());

CREATE POLICY attendance_records_select ON public.attendance_records FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR student_id = public.current_student_id()
  OR EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = session_id AND public.is_teacher_of_class(s.class_id)
  )
);

CREATE POLICY attendance_records_write ON public.attendance_records FOR ALL TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = session_id AND public.is_teacher_of_class(s.class_id)
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = session_id AND public.is_teacher_of_class(s.class_id)
  )
);

-- Seed one published course tree per level A1–B2
DO $$
DECLARE
  lvl record;
  course_id uuid;
  module_id uuid;
  unit_id uuid;
BEGIN
  FOR lvl IN SELECT id, code, name FROM public.levels WHERE code IN ('A1','A2','B1','B2') ORDER BY sort_order LOOP
    INSERT INTO public.courses (level_id, title, description, status, sort_order)
    VALUES (lvl.id, lvl.code || ' Core Course', 'Primary curriculum for ' || lvl.name, 'published', 1)
    RETURNING id INTO course_id;

    INSERT INTO public.modules (course_id, title, description, status, sort_order)
    VALUES (course_id, 'Module 1 · Foundations', 'Starter module for ' || lvl.code, 'published', 1)
    RETURNING id INTO module_id;

    INSERT INTO public.units (module_id, title, description, status, sort_order)
    VALUES (module_id, 'Unit 1 · Getting started', 'First unit', 'published', 1)
    RETURNING id INTO unit_id;

    INSERT INTO public.lessons (unit_id, title, description, content_markdown, duration_minutes, status, sort_order)
    VALUES
      (unit_id, lvl.code || ' · Lesson 1', 'Introduction', '# Welcome to ' || lvl.code || E'\n\nStart your German journey.', 45, 'published', 1),
      (unit_id, lvl.code || ' · Lesson 2', 'Practice', '# Practice\n\nComplete the exercises for ' || lvl.code || '.', 40, 'published', 2);
  END LOOP;
END $$;
