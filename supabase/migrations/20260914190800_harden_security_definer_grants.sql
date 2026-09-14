-- Harden SECURITY DEFINER EXECUTE grants (anon revoked; trigger-only funcs locked).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'current_profile_role','current_profile_status','current_student_id','current_teacher_id',
        'handle_new_user','has_active_academic_access','is_active_user','is_admin',
        'is_enrolled_in_class','is_student','is_teacher','is_teacher_of_class',
        'sync_profile_email','teacher_has_student','write_audit_log'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_academic_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enrolled_in_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_has_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_log(text, text, uuid, jsonb, jsonb, jsonb) TO authenticated;
