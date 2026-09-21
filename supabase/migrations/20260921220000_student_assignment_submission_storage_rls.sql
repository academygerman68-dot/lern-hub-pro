-- Allow students to upload/read/replace their own assignment submission files.
-- Path contract: submissions/{assignment_id}/{student_id}/{filename}
-- Isolation: folder[3] must equal current_student_id(); never another student's folder.
-- Staff read/write remains covered by course_materials_select_targeted + course_materials_write_staff.

DROP POLICY IF EXISTS course_materials_student_submission_insert ON storage.objects;
CREATE POLICY course_materials_student_submission_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND public.is_active_user()
  AND public.current_student_id() IS NOT NULL
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[3] = public.current_student_id()::text
  AND public.student_can_access_assignment(((storage.foldername(name))[2])::uuid)
);

DROP POLICY IF EXISTS course_materials_student_submission_select ON storage.objects;
CREATE POLICY course_materials_student_submission_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-materials'
  AND public.is_active_user()
  AND public.current_student_id() IS NOT NULL
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[3] = public.current_student_id()::text
);

DROP POLICY IF EXISTS course_materials_student_submission_update ON storage.objects;
CREATE POLICY course_materials_student_submission_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND public.is_active_user()
  AND public.current_student_id() IS NOT NULL
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[3] = public.current_student_id()::text
)
WITH CHECK (
  bucket_id = 'course-materials'
  AND public.is_active_user()
  AND public.current_student_id() IS NOT NULL
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[3] = public.current_student_id()::text
  AND public.student_can_access_assignment(((storage.foldername(name))[2])::uuid)
);

DROP POLICY IF EXISTS course_materials_student_submission_delete ON storage.objects;
CREATE POLICY course_materials_student_submission_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND public.is_active_user()
  AND public.current_student_id() IS NOT NULL
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[3] = public.current_student_id()::text
);
