-- Admin account management: change role, delete/anonymize another user.

CREATE OR REPLACE FUNCTION public.admin_set_profile_role(
  p_profile_id uuid,
  p_role public.app_role
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.profiles;
  v_old public.app_role;
  v_other_admins integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT role INTO v_old FROM public.profiles WHERE id = p_profile_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_old = p_role THEN
    SELECT * INTO v_row FROM public.profiles WHERE id = p_profile_id;
    RETURN v_row;
  END IF;

  -- Protect last active admin (self or others).
  IF v_old = 'admin' AND p_role <> 'admin' THEN
    SELECT count(*)::integer INTO v_other_admins
    FROM public.profiles
    WHERE role = 'admin'
      AND status = 'active'
      AND id <> p_profile_id;
    IF coalesce(v_other_admins, 0) < 1 THEN
      RAISE EXCEPTION 'LAST_ADMIN';
    END IF;
  END IF;

  IF p_profile_id = auth.uid() AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'CANNOT_SELF_DEMOTE';
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  UPDATE public.profiles
  SET role = p_role,
      updated_at = now()
  WHERE id = p_profile_id
  RETURNING * INTO v_row;

  IF p_role = 'student' THEN
    INSERT INTO public.students (profile_id)
    VALUES (p_profile_id)
    ON CONFLICT (profile_id) DO NOTHING;
  ELSIF p_role = 'teacher' THEN
    INSERT INTO public.teachers (profile_id)
    VALUES (p_profile_id)
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_profile_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_role(uuid, public.app_role) TO authenticated;

-- Admin soft-delete / anonymize (auth.users removed by edge function).
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := p_profile_id;
  v_role text;
  v_student_id uuid;
  v_teacher_id uuid;
  v_other_admins integer;
  v_paths text[] := ARRAY[]::text[];
  r record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_uid = auth.uid() THEN
    RAISE EXCEPTION 'CANNOT_SELF_DELETE';
  END IF;

  SELECT role::text INTO v_role
  FROM public.profiles
  WHERE id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_role = 'admin' THEN
    SELECT count(*)::integer INTO v_other_admins
    FROM public.profiles
    WHERE role = 'admin'
      AND status = 'active'
      AND id <> v_uid;
    IF coalesce(v_other_admins, 0) < 1 THEN
      RAISE EXCEPTION 'LAST_ADMIN';
    END IF;
  END IF;

  v_paths := array_append(v_paths, 'avatars:' || v_uid::text);

  SELECT s.id INTO v_student_id
  FROM public.students s
  WHERE s.profile_id = v_uid;

  IF v_student_id IS NOT NULL THEN
    FOR r IN
      SELECT storage_bucket, storage_path
      FROM public.payment_proofs
      WHERE student_id = v_student_id
        AND storage_path IS NOT NULL
    LOOP
      v_paths := array_append(
        v_paths,
        coalesce(r.storage_bucket, 'documents') || ':' || r.storage_path
      );
    END LOOP;

    DELETE FROM public.payment_proofs WHERE student_id = v_student_id;
    DELETE FROM public.student_payments WHERE student_id = v_student_id;
    DELETE FROM public.invoices WHERE student_id = v_student_id;
    DELETE FROM public.student_subscriptions WHERE student_id = v_student_id;
    DELETE FROM public.enrollments WHERE student_id = v_student_id;
    DELETE FROM public.students WHERE id = v_student_id;
  END IF;

  SELECT t.id INTO v_teacher_id
  FROM public.teachers t
  WHERE t.profile_id = v_uid;

  IF v_teacher_id IS NOT NULL THEN
    UPDATE public.classes SET teacher_id = NULL WHERE teacher_id = v_teacher_id;
    DELETE FROM public.teachers WHERE id = v_teacher_id;
  END IF;

  FOR r IN
    SELECT coalesce(attachment_bucket, 'message-attachments') AS storage_bucket,
           attachment_path
    FROM public.messages
    WHERE sender_id = v_uid
      AND attachment_path IS NOT NULL
  LOOP
    v_paths := array_append(v_paths, r.storage_bucket || ':' || r.attachment_path);
  END LOOP;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  UPDATE public.profiles
  SET
    email = 'deleted+' || replace(v_uid::text, '-', '') || '@invalid.local',
    first_name = 'Compte',
    last_name = 'supprimé',
    phone = NULL,
    avatar_url = NULL,
    status = 'archived',
    role = 'student',
    updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'user_id', v_uid,
    'role', v_role,
    'storage_refs', to_jsonb(v_paths)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
