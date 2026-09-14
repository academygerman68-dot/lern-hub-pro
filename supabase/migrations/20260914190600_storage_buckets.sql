-- Phase 5b: Storage buckets + policies

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']::text[]),
  ('documents', 'documents', false, 26214400, ARRAY['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]),
  ('library', 'library', false, 52428800, ARRAY['application/pdf','audio/mpeg','audio/wav','video/mp4','image/jpeg','image/png']::text[]),
  ('course-materials', 'course-materials', false, 52428800, ARRAY['application/pdf','audio/mpeg','video/mp4','image/jpeg','image/png','application/zip']::text[]),
  ('recordings', 'recordings', false, 524288000, ARRAY['video/mp4','video/webm','audio/mpeg']::text[])
ON CONFLICT (id) DO NOTHING;

-- Avatars: users manage own folder avatars/{user_id}/*
CREATE POLICY avatars_select_own_or_admin
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY avatars_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.is_active_user()
);

CREATE POLICY avatars_update_own
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY avatars_delete_own_or_admin
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Documents: students/{student_id}/... or admin
CREATE POLICY documents_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    public.is_admin()
    OR (
      (storage.foldername(name))[1] = 'students'
      AND (storage.foldername(name))[2] = public.current_student_id()::text
    )
    OR public.is_teacher()
  )
);

CREATE POLICY documents_write_admin
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (public.is_admin() OR public.is_teacher())
);

CREATE POLICY documents_update_admin
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND (public.is_admin() OR public.is_teacher()))
WITH CHECK (bucket_id = 'documents' AND (public.is_admin() OR public.is_teacher()));

CREATE POLICY documents_delete_admin
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND public.is_admin());

-- Library + course materials: authenticated read if active; staff write
CREATE POLICY library_select_active
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'library' AND public.is_active_user());

CREATE POLICY library_write_staff
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'library' AND (public.is_admin() OR public.is_teacher()))
WITH CHECK (bucket_id = 'library' AND (public.is_admin() OR public.is_teacher()));

CREATE POLICY course_materials_select_active
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'course-materials' AND public.is_active_user());

CREATE POLICY course_materials_write_staff
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'course-materials' AND (public.is_admin() OR public.is_teacher()))
WITH CHECK (bucket_id = 'course-materials' AND (public.is_admin() OR public.is_teacher()));

-- Recordings: admin full; teachers of class folder; enrolled students read
-- Path: classes/{class_id}/recordings/...
CREATE POLICY recordings_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'recordings'
  AND (
    public.is_admin()
    OR (
      (storage.foldername(name))[1] = 'classes'
      AND (
        public.is_teacher_of_class(((storage.foldername(name))[2])::uuid)
        OR public.is_enrolled_in_class(((storage.foldername(name))[2])::uuid)
      )
    )
  )
);

CREATE POLICY recordings_write_staff
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'recordings'
  AND (
    public.is_admin()
    OR (
      (storage.foldername(name))[1] = 'classes'
      AND public.is_teacher_of_class(((storage.foldername(name))[2])::uuid)
    )
  )
);

CREATE POLICY recordings_delete_admin
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'recordings' AND public.is_admin());
