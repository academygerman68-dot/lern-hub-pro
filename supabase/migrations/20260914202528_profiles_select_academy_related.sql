-- Allow teachers to read profiles of students in their classes,
-- and enrolled students to read their class teacher's profile.
-- Does not open profiles publicly; scoped via existing SECURITY DEFINER helpers.

CREATE POLICY profiles_select_assigned_students
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.profile_id = profiles.id
      AND public.teacher_has_student(s.id)
  )
);

CREATE POLICY profiles_select_class_teachers
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.teachers t
    JOIN public.classes c ON c.teacher_id = t.id
    WHERE t.profile_id = profiles.id
      AND (
        public.is_enrolled_in_class(c.id)
        OR public.is_teacher_of_class(c.id)
      )
  )
);

-- Teachers need subscription status for assigned students (roster / 360).
CREATE POLICY subscriptions_select_assigned_teacher
ON public.student_subscriptions
FOR SELECT
TO authenticated
USING (public.teacher_has_student(student_id));
