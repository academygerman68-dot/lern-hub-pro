-- Billing plan + period on student payments (monthly/quarterly, MAD/EUR).
-- Students can ensure a pending payment for a chosen period via RPC, then submit a proof.

ALTER TABLE public.student_payments
  ADD COLUMN IF NOT EXISTS billing_plan text,
  ADD COLUMN IF NOT EXISTS billing_period text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_payments_billing_plan_check'
  ) THEN
    ALTER TABLE public.student_payments
      ADD CONSTRAINT student_payments_billing_plan_check
      CHECK (billing_plan IS NULL OR billing_plan IN ('monthly', 'quarterly'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS student_payments_billing_period_idx
  ON public.student_payments (student_id, billing_period, billing_plan);

COMMENT ON COLUMN public.student_payments.billing_plan IS
  'Subscription formula: monthly or quarterly.';
COMMENT ON COLUMN public.student_payments.billing_period IS
  'Period key: YYYY-MM (monthly) or YYYY-Qn (quarterly).';

CREATE OR REPLACE FUNCTION public.billing_period_due_date(p_period text, p_plan text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_year int;
  v_month int;
  v_q int;
BEGIN
  IF p_plan = 'quarterly' OR p_period ~* '^\d{4}-Q[1-4]$' THEN
    v_year := substring(p_period from 1 for 4)::int;
    v_q := substring(p_period from 7 for 1)::int;
    v_month := v_q * 3;
    RETURN (make_date(v_year, v_month, 1) + interval '1 month - 1 day')::date;
  END IF;

  IF p_period !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Mois à payer invalide';
  END IF;
  v_year := substring(p_period from 1 for 4)::int;
  v_month := substring(p_period from 6 for 2)::int;
  RETURN (make_date(v_year, v_month, 1) + interval '1 month - 1 day')::date;
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF p_billing_plan NOT IN ('monthly', 'quarterly') THEN
    RAISE EXCEPTION 'Formule invalide';
  END IF;

  IF upper(p_currency) NOT IN ('MAD', 'EUR') THEN
    RAISE EXCEPTION 'Devise invalide';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant attendu invalide';
  END IF;

  v_student_id := public.current_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Profil étudiant introuvable. Contactez l’administration.';
  END IF;

  v_due := public.billing_period_due_date(p_period, p_billing_plan);

  SELECT id INTO v_payment_id
  FROM public.student_payments
  WHERE student_id = v_student_id
    AND billing_plan = p_billing_plan
    AND billing_period = p_period
    AND upper(currency) = upper(p_currency)
    AND status IN ('pending', 'partial', 'overdue')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_payment_id IS NOT NULL THEN
    UPDATE public.student_payments
    SET
      amount = p_amount,
      initial_amount = COALESCE(initial_amount, p_amount),
      currency = upper(p_currency),
      due_date = v_due,
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
    p_amount,
    p_amount,
    0,
    upper(p_currency),
    v_due,
    'pending',
    p_billing_plan,
    p_period
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.billing_period_due_date(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_period_due_date(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.ensure_student_billing_payment(text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_student_billing_payment(text, text, text, numeric) TO authenticated;
