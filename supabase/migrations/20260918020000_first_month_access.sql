-- First-month academic access after admin approval + first login.
-- Unpaid restriction starts after month 1, with a 2-session grace in month 2.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS first_login_at timestamptz;

COMMENT ON COLUMN public.students.first_login_at IS
  'First successful login after admin approval; starts the free first-month window.';

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

    -- Approval unlocks academic access for the first-month trial.
    IF p_status = 'active' AND v_student_id IS NOT NULL THEN
      INSERT INTO public.student_subscriptions (student_id, status, starts_at, expires_at, notes)
      VALUES (
        v_student_id,
        'active',
        now(),
        CASE WHEN v_first_login IS NULL THEN NULL ELSE v_first_login + interval '1 month' END,
        'Accès ouvert après validation admin — 1er mois offert dès la première connexion'
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
      '1er mois offert — accès jusqu’à la date d’expiration'
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

REVOKE ALL ON FUNCTION public.record_student_first_login() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_student_first_login() TO authenticated;

CREATE OR REPLACE FUNCTION public.post_trial_live_sessions_count(p_student_id uuid)
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
        -- First month from first connection → never restrict
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
          AND public.post_trial_live_sessions_count(s.id) < 2
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

-- Backfill subscriptions for already-approved active students.
INSERT INTO public.student_subscriptions (student_id, status, starts_at, expires_at, notes)
SELECT
  s.id,
  'active',
  coalesce(s.first_login_at, s.created_at, now()),
  CASE
    WHEN s.first_login_at IS NULL THEN NULL
    ELSE s.first_login_at + interval '1 month'
  END,
  'Backfill accès après validation — 1er mois offert'
FROM public.students s
JOIN public.profiles p ON p.id = s.profile_id
WHERE p.role = 'student'
  AND p.status = 'active'
  AND s.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.student_subscriptions sub WHERE sub.student_id = s.id
  )
ON CONFLICT (student_id) DO NOTHING;

UPDATE public.student_subscriptions sub
SET
  status = 'active',
  updated_at = now(),
  notes = coalesce(sub.notes, 'Réactivation période d’essai')
FROM public.students s
JOIN public.profiles p ON p.id = s.profile_id
WHERE sub.student_id = s.id
  AND p.status = 'active'
  AND s.status = 'active'
  AND sub.status IN ('suspended', 'past_due')
  AND (s.first_login_at IS NULL OR now() < s.first_login_at + interval '1 month');
