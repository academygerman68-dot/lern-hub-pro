-- Student subscription owns commercial plan + currency (fixed MAD/EUR tariffs).
-- Pending plan/currency apply from a future period without rewriting past échéances.

ALTER TABLE public.student_subscriptions
  ADD COLUMN IF NOT EXISTS billing_plan text,
  ADD COLUMN IF NOT EXISTS billing_currency text,
  ADD COLUMN IF NOT EXISTS pending_billing_plan text,
  ADD COLUMN IF NOT EXISTS pending_billing_currency text,
  ADD COLUMN IF NOT EXISTS plan_change_effective_period text;

UPDATE public.student_subscriptions
SET
  billing_plan = coalesce(billing_plan, 'monthly'),
  billing_currency = coalesce(upper(billing_currency), 'MAD')
WHERE billing_plan IS NULL OR billing_currency IS NULL;

ALTER TABLE public.student_subscriptions
  ALTER COLUMN billing_plan SET DEFAULT 'monthly',
  ALTER COLUMN billing_currency SET DEFAULT 'MAD';

UPDATE public.student_subscriptions
SET billing_plan = 'monthly'
WHERE billing_plan IS NULL;

UPDATE public.student_subscriptions
SET billing_currency = 'MAD'
WHERE billing_currency IS NULL;

ALTER TABLE public.student_subscriptions
  ALTER COLUMN billing_plan SET NOT NULL,
  ALTER COLUMN billing_currency SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_subscriptions_billing_plan_check'
  ) THEN
    ALTER TABLE public.student_subscriptions
      ADD CONSTRAINT student_subscriptions_billing_plan_check
      CHECK (billing_plan IN ('monthly', 'quarterly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_subscriptions_billing_currency_check'
  ) THEN
    ALTER TABLE public.student_subscriptions
      ADD CONSTRAINT student_subscriptions_billing_currency_check
      CHECK (upper(billing_currency) IN ('MAD', 'EUR'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_subscriptions_pending_billing_plan_check'
  ) THEN
    ALTER TABLE public.student_subscriptions
      ADD CONSTRAINT student_subscriptions_pending_billing_plan_check
      CHECK (pending_billing_plan IS NULL OR pending_billing_plan IN ('monthly', 'quarterly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_subscriptions_pending_billing_currency_check'
  ) THEN
    ALTER TABLE public.student_subscriptions
      ADD CONSTRAINT student_subscriptions_pending_billing_currency_check
      CHECK (pending_billing_currency IS NULL OR upper(pending_billing_currency) IN ('MAD', 'EUR'));
  END IF;
END $$;

-- Backfill from latest payment when available.
UPDATE public.student_subscriptions sub
SET
  billing_plan = coalesce(pay.billing_plan, sub.billing_plan),
  billing_currency = coalesce(upper(pay.currency), sub.billing_currency)
FROM (
  SELECT DISTINCT ON (sp.student_id)
    sp.student_id,
    sp.billing_plan,
    sp.currency
  FROM public.student_payments sp
  WHERE sp.billing_plan IN ('monthly', 'quarterly')
  ORDER BY sp.student_id, sp.created_at DESC
) pay
WHERE pay.student_id = sub.student_id;

COMMENT ON COLUMN public.student_subscriptions.billing_plan IS
  'Commercial formula currently in force: monthly or quarterly.';
COMMENT ON COLUMN public.student_subscriptions.billing_currency IS
  'Commercial currency currently in force: MAD or EUR (no FX conversion).';
COMMENT ON COLUMN public.student_subscriptions.pending_billing_plan IS
  'Optional future formula; applied from plan_change_effective_period onward.';
COMMENT ON COLUMN public.student_subscriptions.pending_billing_currency IS
  'Optional future currency; applied from plan_change_effective_period onward.';
COMMENT ON COLUMN public.student_subscriptions.plan_change_effective_period IS
  'Period key (YYYY-MM or YYYY-Qn) when pending plan/currency become active.';

CREATE OR REPLACE FUNCTION public.billing_catalog_amount(p_plan text, p_currency text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_plan = 'monthly' AND upper(p_currency) = 'MAD' THEN 1000::numeric
    WHEN p_plan = 'monthly' AND upper(p_currency) = 'EUR' THEN 100::numeric
    WHEN p_plan = 'quarterly' AND upper(p_currency) = 'MAD' THEN 2400::numeric
    WHEN p_plan = 'quarterly' AND upper(p_currency) = 'EUR' THEN 240::numeric
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.next_billing_period(p_plan text, p_from date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_year int := extract(year from p_from)::int;
  v_month int := extract(month from p_from)::int;
  v_q int;
BEGIN
  IF p_plan = 'quarterly' THEN
    v_q := ((v_month - 1) / 3) + 1;
    RETURN format('%s-Q%s', v_year, v_q);
  END IF;
  RETURN format('%s-%s', v_year, lpad(v_month::text, 2, '0'));
END;
$$;

CREATE OR REPLACE FUNCTION public.period_sort_key(p_period text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_period ~* '^\d{4}-Q[1-4]$' THEN
      (substring(p_period from 1 for 4) || '-' || lpad(((substring(p_period from 7 for 1)::int - 1) * 3 + 1)::text, 2, '0'))
    ELSE p_period
  END;
$$;

CREATE OR REPLACE FUNCTION public.apply_pending_subscription_plan(
  p_student_id uuid,
  p_period text
)
RETURNS public.student_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.student_subscriptions;
BEGIN
  SELECT * INTO v_row
  FROM public.student_subscriptions
  WHERE student_id = p_student_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    INSERT INTO public.student_subscriptions (student_id, status, starts_at, billing_plan, billing_currency)
    VALUES (p_student_id, 'suspended', now(), 'monthly', 'MAD')
    RETURNING * INTO v_row;
  END IF;

  IF v_row.pending_billing_plan IS NOT NULL
     AND v_row.plan_change_effective_period IS NOT NULL
     AND public.period_sort_key(p_period) >= public.period_sort_key(v_row.plan_change_effective_period)
  THEN
    UPDATE public.student_subscriptions
    SET
      billing_plan = v_row.pending_billing_plan,
      billing_currency = coalesce(upper(v_row.pending_billing_currency), billing_currency),
      pending_billing_plan = NULL,
      pending_billing_currency = NULL,
      plan_change_effective_period = NULL,
      updated_at = now()
    WHERE student_id = p_student_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_student_billing_plan(
  p_student_id uuid,
  p_billing_plan text,
  p_billing_currency text,
  p_apply_mode text DEFAULT 'next_period'
)
RETURNS public.student_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.student_subscriptions;
  v_currency text := upper(p_billing_currency);
  v_next text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_billing_plan NOT IN ('monthly', 'quarterly') THEN
    RAISE EXCEPTION 'Formule invalide';
  END IF;

  IF v_currency NOT IN ('MAD', 'EUR') THEN
    RAISE EXCEPTION 'Devise invalide';
  END IF;

  IF p_apply_mode NOT IN ('immediate', 'next_period') THEN
    RAISE EXCEPTION 'Mode d’application invalide';
  END IF;

  PERFORM public.ensure_student_subscription(p_student_id);
  SELECT * INTO v_row FROM public.student_subscriptions WHERE student_id = p_student_id FOR UPDATE;

  IF p_apply_mode = 'immediate' THEN
    UPDATE public.student_subscriptions
    SET
      billing_plan = p_billing_plan,
      billing_currency = v_currency,
      pending_billing_plan = NULL,
      pending_billing_currency = NULL,
      plan_change_effective_period = NULL,
      updated_at = now()
    WHERE student_id = p_student_id
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  IF p_billing_plan = 'quarterly' THEN
    v_next := public.next_billing_period(
      'quarterly',
      (date_trunc('quarter', CURRENT_DATE::timestamp) + interval '3 months')::date
    );
  ELSE
    v_next := to_char(date_trunc('month', CURRENT_DATE::timestamp) + interval '1 month', 'YYYY-MM');
  END IF;

  UPDATE public.student_subscriptions
  SET
    pending_billing_plan = p_billing_plan,
    pending_billing_currency = v_currency,
    plan_change_effective_period = v_next,
    updated_at = now()
  WHERE student_id = p_student_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_student_billing_payment(
  p_billing_plan text,
  p_currency text,
  p_period text,
  p_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_payment_id uuid;
  v_due date;
  v_sub public.student_subscriptions;
  v_plan text;
  v_currency text;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  v_student_id := public.current_student_id();
  IF v_student_id IS NULL THEN
    IF public.is_admin() THEN
      RAISE EXCEPTION 'Utilisez le formulaire admin pour créer une échéance.';
    END IF;
    RAISE EXCEPTION 'Profil étudiant introuvable. Contactez l’administration.';
  END IF;

  v_sub := public.apply_pending_subscription_plan(v_student_id, p_period);

  v_plan := coalesce(nullif(p_billing_plan, ''), v_sub.billing_plan, 'monthly');
  v_currency := upper(coalesce(nullif(p_currency, ''), v_sub.billing_currency, 'MAD'));
  v_amount := coalesce(
    nullif(p_amount, 0),
    public.billing_catalog_amount(v_plan, v_currency)
  );

  IF v_plan NOT IN ('monthly', 'quarterly') THEN
    RAISE EXCEPTION 'Formule invalide';
  END IF;

  IF v_currency NOT IN ('MAD', 'EUR') THEN
    RAISE EXCEPTION 'Devise invalide';
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Montant attendu invalide';
  END IF;

  -- Students may only create échéances for their subscription formula/currency.
  IF NOT public.is_admin() THEN
    IF v_plan IS DISTINCT FROM v_sub.billing_plan OR v_currency IS DISTINCT FROM upper(v_sub.billing_currency) THEN
      RAISE EXCEPTION 'La formule et la devise sont définies par votre abonnement.';
    END IF;
    v_amount := public.billing_catalog_amount(v_plan, v_currency);
  END IF;

  v_due := public.billing_period_due_date(p_period, v_plan);

  SELECT id INTO v_payment_id
  FROM public.student_payments
  WHERE student_id = v_student_id
    AND billing_period = p_period
    AND status IN ('pending', 'partial', 'overdue')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_payment_id IS NOT NULL THEN
    UPDATE public.student_payments
    SET
      amount = v_amount,
      initial_amount = COALESCE(initial_amount, v_amount),
      currency = v_currency,
      due_date = v_due,
      billing_plan = v_plan,
      billing_period = p_period,
      updated_at = now()
    WHERE id = v_payment_id;
    RETURN v_payment_id;
  END IF;

  INSERT INTO public.student_payments (
    student_id,
    amount,
    initial_amount,
    amount_paid,
    currency,
    due_date,
    status,
    billing_plan,
    billing_period
  ) VALUES (
    v_student_id,
    v_amount,
    v_amount,
    0,
    v_currency,
    v_due,
    'pending',
    v_plan,
    p_period
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_my_subscription_payment(p_period text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_sub public.student_subscriptions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  v_student_id := public.current_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Profil étudiant introuvable. Contactez l’administration.';
  END IF;

  v_sub := public.apply_pending_subscription_plan(v_student_id, p_period);

  RETURN public.ensure_student_billing_payment(
    v_sub.billing_plan,
    v_sub.billing_currency,
    p_period,
    public.billing_catalog_amount(v_sub.billing_plan, v_sub.billing_currency)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.billing_catalog_amount(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_catalog_amount(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.next_billing_period(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_billing_period(text, date) TO authenticated;

REVOKE ALL ON FUNCTION public.period_sort_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.period_sort_key(text) TO authenticated;

REVOKE ALL ON FUNCTION public.apply_pending_subscription_plan(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_pending_subscription_plan(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_student_billing_plan(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_student_billing_plan(uuid, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.ensure_student_billing_payment(text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_student_billing_payment(text, text, text, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.ensure_my_subscription_payment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_subscription_payment(text) TO authenticated;
