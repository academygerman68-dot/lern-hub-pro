-- Secure admin promotion for bootstrap / ops (never from client user_metadata).
-- Uses a transaction-local bypass recognized by profiles_guard_privileged_fields.

CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF coalesce(current_setting('app.bypass_profile_guard', true), 'off') = 'on' THEN
      RETURN NEW;
    END IF;
    IF (
      NEW.role IS DISTINCT FROM OLD.role
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
      OR NEW.email IS DISTINCT FROM OLD.email
    ) AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can change role, status, email, or archive state';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_promote_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles
  SET role = 'admin'
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.secure_promote_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.secure_promote_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.secure_promote_admin(uuid) FROM authenticated;
