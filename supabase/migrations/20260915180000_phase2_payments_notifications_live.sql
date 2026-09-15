-- Phase 2: payment workflow RPCs, notifications, live_sessions

CREATE TYPE public.notification_channel AS ENUM ('in_app', 'email', 'whatsapp');
CREATE TYPE public.notification_status AS ENUM ('unread', 'read', 'archived');
CREATE TYPE public.live_session_status AS ENUM ('scheduled', 'live', 'completed', 'cancelled');
CREATE TYPE public.meeting_provider AS ENUM ('jitsi', 'jaas', 'none');

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  link_page text,
  link_id text,
  status public.notification_status NOT NULL DEFAULT 'unread',
  channel public.notification_channel NOT NULL DEFAULT 'in_app',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_recipient_id_idx ON public.notifications (recipient_id);
CREATE INDEX IF NOT EXISTS notifications_status_idx ON public.notifications (status);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  in_app_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers (id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status public.live_session_status NOT NULL DEFAULT 'scheduled',
  meeting_provider public.meeting_provider NOT NULL DEFAULT 'jitsi',
  meeting_room text NOT NULL,
  meeting_url text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_sessions_class_id_idx ON public.live_sessions (class_id);
CREATE INDEX IF NOT EXISTS live_sessions_starts_at_idx ON public.live_sessions (starts_at);
CREATE INDEX IF NOT EXISTS live_sessions_status_idx ON public.live_sessions (status);

CREATE TRIGGER notification_preferences_set_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER live_sessions_set_updated_at
BEFORE UPDATE ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
FOR SELECT TO authenticated
USING (recipient_id = auth.uid() OR public.is_admin());

CREATE POLICY notifications_update_own ON public.notifications
FOR UPDATE TO authenticated
USING (recipient_id = auth.uid() OR public.is_admin())
WITH CHECK (recipient_id = auth.uid() OR public.is_admin());

CREATE POLICY notifications_insert_staff ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_teacher() OR recipient_id = auth.uid());

CREATE POLICY notifications_delete_own ON public.notifications
FOR DELETE TO authenticated
USING (recipient_id = auth.uid() OR public.is_admin());

CREATE POLICY notification_prefs_own ON public.notification_preferences
FOR ALL TO authenticated
USING (profile_id = auth.uid() OR public.is_admin())
WITH CHECK (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY live_sessions_select ON public.live_sessions
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_teacher_of_class(class_id)
  OR public.is_enrolled_in_class(class_id)
);

CREATE POLICY live_sessions_write_staff ON public.live_sessions
FOR ALL TO authenticated
USING (public.is_admin() OR public.is_teacher_of_class(class_id))
WITH CHECK (public.is_admin() OR public.is_teacher_of_class(class_id));

CREATE OR REPLACE FUNCTION public.create_in_app_notification(
  p_recipient_id uuid,
  p_title text,
  p_message text,
  p_category text DEFAULT 'general',
  p_link_page text DEFAULT NULL,
  p_link_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notifications;
BEGIN
  INSERT INTO public.notifications (
    recipient_id, title, message, category, link_page, link_id, metadata
  ) VALUES (
    p_recipient_id, p_title, p_message, coalesce(p_category, 'general'),
    p_link_page, p_link_id, coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_in_app_notification(uuid, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_in_app_notification(uuid, text, text, text, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_student_subscription(p_student_id uuid)
RETURNS public.student_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.student_subscriptions;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.student_subscriptions (student_id, status, starts_at)
  VALUES (p_student_id, 'suspended', now())
  ON CONFLICT (student_id) DO UPDATE
    SET updated_at = now()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.student_subscriptions WHERE student_id = p_student_id;
  END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_student_subscription(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_student_subscription(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_student_payment_paid(p_payment_id uuid)
RETURNS public.student_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.student_payments;
  v_profile_id uuid;
  v_expires timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.student_payments
  SET
    status = 'paid',
    payment_date = coalesce(payment_date, CURRENT_DATE),
    updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.invoice_id IS NOT NULL THEN
    UPDATE public.invoices
    SET status = 'paid', paid_at = now(), updated_at = now()
    WHERE id = v_payment.invoice_id;
  END IF;

  v_expires := now() + interval '30 days';

  INSERT INTO public.student_subscriptions (student_id, status, starts_at, expires_at)
  VALUES (v_payment.student_id, 'active', now(), v_expires)
  ON CONFLICT (student_id) DO UPDATE
  SET
    status = 'active',
    starts_at = coalesce(public.student_subscriptions.starts_at, now()),
    expires_at = greatest(coalesce(public.student_subscriptions.expires_at, now()), v_expires),
    grace_until = null,
    manually_extended = false,
    updated_at = now();

  SELECT profile_id INTO v_profile_id FROM public.students WHERE id = v_payment.student_id;
  IF v_profile_id IS NOT NULL THEN
    PERFORM public.create_in_app_notification(
      v_profile_id,
      'Payment received',
      format('Your payment of %s %s was recorded. Academic access is active.', v_payment.amount, v_payment.currency),
      'payment',
      'payments',
      v_payment.id::text,
      jsonb_build_object('payment_id', v_payment.id, 'amount', v_payment.amount)
    );
  END IF;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_student_payment_paid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_student_payment_paid(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_student_payment_overdue(p_payment_id uuid)
RETURNS public.student_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.student_payments;
  v_profile_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.student_payments
  SET status = 'overdue', updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.student_subscriptions
  SET status = 'past_due', updated_at = now()
  WHERE student_id = v_payment.student_id
    AND status IN ('active', 'grace_period', 'manually_extended');

  SELECT profile_id INTO v_profile_id FROM public.students WHERE id = v_payment.student_id;
  IF v_profile_id IS NOT NULL THEN
    PERFORM public.create_in_app_notification(
      v_profile_id,
      'Payment overdue',
      format('Your payment of %s %s is overdue. Academic access may be restricted.', v_payment.amount, v_payment.currency),
      'payment',
      'payments',
      v_payment.id::text,
      jsonb_build_object('payment_id', v_payment.id)
    );
  END IF;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_student_payment_overdue(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_student_payment_overdue(uuid) TO authenticated;

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
    JOIN public.student_subscriptions sub ON sub.student_id = s.id
    WHERE s.id = p_student_id
      AND s.status = 'active'
      AND sub.status IN ('active', 'grace_period', 'manually_extended')
      AND (
        sub.expires_at IS NULL
        OR sub.expires_at > now()
        OR (sub.grace_until IS NOT NULL AND sub.grace_until > now())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_academic_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_academic_access(uuid) TO authenticated;
