-- Profile personal info edit (self + admin) + avatar admin insert + protect sensitive columns

-- Prevent non-admins from escalating role/status/email via direct UPDATE
CREATE OR REPLACE FUNCTION public.profiles_protect_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.email := OLD.email;
    NEW.id := OLD.id;
    NEW.archived_at := OLD.archived_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_sensitive_columns ON public.profiles;
CREATE TRIGGER profiles_protect_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_protect_sensitive_columns();

-- Self-service: update first_name, last_name, phone only
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.profiles;
  v_first text := trim(coalesce(p_first_name, ''));
  v_last text := trim(coalesce(p_last_name, ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_account_usable() THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_USABLE';
  END IF;

  IF length(v_first) < 1 OR length(v_last) < 1 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;

  IF length(v_first) > 80 OR length(v_last) > 80 THEN
    RAISE EXCEPTION 'NAME_TOO_LONG';
  END IF;

  IF v_phone IS NOT NULL AND length(v_phone) > 40 THEN
    RAISE EXCEPTION 'PHONE_TOO_LONG';
  END IF;

  UPDATE public.profiles
  SET
    first_name = v_first,
    last_name = v_last,
    phone = v_phone,
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text) TO authenticated;

-- Admin: update another user's personal fields (not role/status)
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_profile_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_clear_avatar boolean DEFAULT false
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.profiles;
  v_first text := trim(coalesce(p_first_name, ''));
  v_last text := trim(coalesce(p_last_name, ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF length(v_first) < 1 OR length(v_last) < 1 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;

  IF length(v_first) > 80 OR length(v_last) > 80 THEN
    RAISE EXCEPTION 'NAME_TOO_LONG';
  END IF;

  IF v_phone IS NOT NULL AND length(v_phone) > 40 THEN
    RAISE EXCEPTION 'PHONE_TOO_LONG';
  END IF;

  UPDATE public.profiles
  SET
    first_name = v_first,
    last_name = v_last,
    phone = v_phone,
    avatar_url = CASE
      WHEN p_clear_avatar THEN NULL
      WHEN p_avatar_url IS NOT NULL THEN p_avatar_url
      ELSE avatar_url
    END,
    updated_at = now()
  WHERE id = p_profile_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) TO authenticated;

-- Self can set own avatar_url path after storage upload
CREATE OR REPLACE FUNCTION public.update_my_avatar_url(p_avatar_url text)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_account_usable() THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_USABLE';
  END IF;

  UPDATE public.profiles
  SET
    avatar_url = nullif(trim(coalesce(p_avatar_url, '')), ''),
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_avatar_url(text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_my_avatar_url(text) TO authenticated;

-- Allow admins to upload into any avatar folder
DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own_or_admin
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    public.is_admin()
    OR (
      (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_active_user()
    )
  )
);
