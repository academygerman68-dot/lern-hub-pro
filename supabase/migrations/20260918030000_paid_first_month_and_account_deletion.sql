-- First month = already paid offline (not a free trial).
-- Month 2+: payment required; unpaid access ends after the 2nd live session.
-- Secure self-service account deletion (DB purge; Auth/Storage handled server-side).

COMMENT ON COLUMN public.students.first_login_at IS
  'First successful login after admin approval; starts the already-paid first-month window.';

CREATE OR REPLACE FUNCTION public.admin_set_profile_status(
  p_profile_id uuid,
  p_status public.profile_status
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.profiles;
  v_student_id uuid;
  v_first_login timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_profile_id = auth.uid() AND p_status IN ('suspended', 'archived', 'pending') THEN
    RAISE EXCEPTION 'CANNOT_SELF_LOCK';
  END IF;

  UPDATE public.profiles
  SET status = p_status,
      updated_at = now()
  WHERE id = p_profile_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_row.role = 'student' THEN
    UPDATE public.students
    SET status = CASE
      WHEN p_status = 'active' THEN 'active'::public.record_status
      WHEN p_status = 'archived' THEN 'archived'::public.record_status
      ELSE 'inactive'::public.record_status
    END,
    updated_at = now()
    WHERE profile_id = p_profile_id
    RETURNING id, first_login_at INTO v_student_id, v_first_login;

    -- Approval after offline payment: open the first paid month from first login.
    IF p_status = 'active' AND v_student_id IS NOT NULL THEN
      INSERT INTO public.student_subscriptions (student_id, status, starts_at, expires_at, notes)
      VALUES (
        v_student_id,
        'active',
        now(),
        CASE WHEN v_first_login IS NULL THEN NULL ELSE v_first_login + interval '1 month' END,
        'Premier mois déjà réglé hors plateforme — accès jusqu’à un mois après la première connexion'
      )
      ON CONFLICT (student_id) DO UPDATE
      SET
        status = 'active',
        starts_at = coalesce(public.student_subscriptions.starts_at, now()),
        expires_at = CASE
          WHEN v_first_login IS NULL THEN NULL
          ELSE coalesce(public.student_subscriptions.expires_at, v_first_login + interval '1 month')
        END,
        grace_until = NULL,
        notes = coalesce(public.student_subscriptions.notes, EXCLUDED.notes),
        updated_at = now();
    END IF;

    IF p_status IN ('suspended', 'archived') AND v_student_id IS NOT NULL THEN
      UPDATE public.student_subscriptions
      SET status = 'suspended',
          updated_at = now()
      WHERE student_id = v_student_id;
    END IF;
  END IF;

  IF v_row.role = 'teacher' THEN
    UPDATE public.teachers
    SET status = CASE
      WHEN p_status = 'active' THEN 'active'::public.record_status
      WHEN p_status = 'archived' THEN 'archived'::public.record_status
      ELSE 'inactive'::public.record_status
    END,
    updated_at = now()
    WHERE profile_id = p_profile_id;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_student_first_login()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_first timestamptz;
  v_profile_status public.profile_status;
BEGIN
  SELECT p.status INTO v_profile_status
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_profile_status IS DISTINCT FROM 'active' THEN
    RETURN NULL;
  END IF;

  SELECT s.id, s.first_login_at INTO v_student_id, v_first
  FROM public.students s
  WHERE s.profile_id = auth.uid();

  IF v_student_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_first IS NULL THEN
    UPDATE public.students
    SET first_login_at = now(),
        updated_at = now()
    WHERE id = v_student_id
    RETURNING first_login_at INTO v_first;

    INSERT INTO public.student_subscriptions (student_id, status, starts_at, expires_at, notes)
    VALUES (
      v_student_id,
      'active',
      v_first,
      v_first + interval '1 month',
      'Premier mois déjà réglé hors plateforme — échéance un mois après la première connexion'
    )
    ON CONFLICT (student_id) DO UPDATE
    SET
      status = 'active',
      starts_at = coalesce(public.student_subscriptions.starts_at, v_first),
      expires_at = coalesce(public.student_subscriptions.expires_at, v_first + interval '1 month'),
      updated_at = now();
  END IF;

  RETURN v_first;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_first_month_live_sessions_count(p_student_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT count(*)::integer
    FROM public.students s
    JOIN public.live_session_participants lsp ON lsp.profile_id = s.profile_id
    JOIN public.live_sessions ls ON ls.id = lsp.session_id
    WHERE s.id = p_student_id
      AND s.first_login_at IS NOT NULL
      AND ls.starts_at >= s.first_login_at + interval '1 month'
      AND ls.status IN ('scheduled', 'live', 'completed')
  ), 0);
$$;

-- Keep previous name as alias for any leftover callers.
CREATE OR REPLACE FUNCTION public.post_trial_live_sessions_count(p_student_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.post_first_month_live_sessions_count(p_student_id);
$$;

CREATE OR REPLACE FUNCTION public.has_academic_access(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    LEFT JOIN public.student_subscriptions sub ON sub.student_id = s.id
    WHERE s.id = p_student_id
      AND s.status = 'active'
      AND p.status = 'active'
      AND (
        -- Approved, first login not yet recorded → allow bootstrap
        s.first_login_at IS NULL
        -- First month from first connection (already paid offline)
        OR now() < s.first_login_at + interval '1 month'
        -- Paid / extended subscription still valid
        OR (
          sub.status IN ('active', 'grace_period', 'manually_extended')
          AND (
            sub.expires_at IS NULL
            OR sub.expires_at > now()
            OR (sub.grace_until IS NOT NULL AND sub.grace_until > now())
          )
        )
        -- Following month unpaid: grace until after the 2nd live session
        OR (
          s.first_login_at IS NOT NULL
          AND now() >= s.first_login_at + interval '1 month'
          AND public.post_first_month_live_sessions_count(s.id) < 2
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_active_academic_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_user_id AND p.role IN ('admin', 'teacher') AND p.status = 'active'
    ) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.profile_id = p_user_id
        AND public.has_academic_access(s.id)
    )
  END;
$$;

-- Purge personal DB rows for the authenticated caller. Auth + Storage cleanup is server-side.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_student_id uuid;
  v_teacher_id uuid;
  v_other_admins integer;
  v_paths text[] := ARRAY[]::text[];
  r record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
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

  -- Avatar paths under avatars/{user_id}/…
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
    DELETE FROM public.teachers WHERE id = v_teacher_id;
  END IF;

  -- Personal message attachments
  FOR r IN
    SELECT coalesce(attachment_bucket, 'message-attachments') AS storage_bucket,
           attachment_path
    FROM public.messages
    WHERE sender_id = v_uid
      AND attachment_path IS NOT NULL
  LOOP
    v_paths := array_append(v_paths, r.storage_bucket || ':' || r.attachment_path);
  END LOOP;

  -- Wipe PII on profile before Auth user deletion cascades the row.
  UPDATE public.profiles
  SET
    email = 'deleted+' || replace(v_uid::text, '-', '') || '@invalid.local',
    first_name = 'Compte',
    last_name = 'supprimé',
    phone = NULL,
    avatar_url = NULL,
    status = 'archived',
    updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'user_id', v_uid,
    'role', v_role,
    'storage_refs', to_jsonb(v_paths)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

REVOKE ALL ON FUNCTION public.post_first_month_live_sessions_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_first_month_live_sessions_count(uuid) TO authenticated;

-- Soft-correct prior "trial / offert" subscription notes for active students still in month 1.
UPDATE public.student_subscriptions sub
SET
  notes = 'Premier mois déjà réglé hors plateforme — accès jusqu’à un mois après la première connexion',
  updated_at = now()
FROM public.students s
JOIN public.profiles p ON p.id = s.profile_id
WHERE sub.student_id = s.id
  AND p.status = 'active'
  AND s.status = 'active'
  AND (
    sub.notes ILIKE '%essai%'
    OR sub.notes ILIKE '%offert%'
    OR sub.notes ILIKE '%trial%'
  );
