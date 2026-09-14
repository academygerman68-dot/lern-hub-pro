-- Phase 8 foundation: Payments + Subscriptions + access helper
-- Separated from teacher_payroll (created later)

CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.subscription_status AS ENUM (
  'active',
  'grace_period',
  'past_due',
  'suspended',
  'cancelled',
  'manually_extended'
);
CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'paid', 'void', 'overdue');

CREATE TABLE public.student_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES public.students (id) ON DELETE RESTRICT,
  status public.subscription_status NOT NULL DEFAULT 'suspended',
  starts_at timestamptz,
  expires_at timestamptz,
  grace_until timestamptz,
  manually_extended boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE RESTRICT,
  invoice_number text NOT NULL UNIQUE,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issued_at timestamptz,
  due_date date,
  paid_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.student_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES public.invoices (id) ON DELETE SET NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  due_date date,
  payment_date date,
  status public.payment_status NOT NULL DEFAULT 'pending',
  payment_method text,
  reference text,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX student_subscriptions_status_idx ON public.student_subscriptions (status);
CREATE INDEX invoices_student_id_idx ON public.invoices (student_id);
CREATE INDEX invoices_status_idx ON public.invoices (status);
CREATE INDEX invoices_due_date_idx ON public.invoices (due_date);
CREATE INDEX student_payments_student_id_idx ON public.student_payments (student_id);
CREATE INDEX student_payments_status_idx ON public.student_payments (status);
CREATE INDEX student_payments_due_date_idx ON public.student_payments (due_date);

CREATE TRIGGER student_subscriptions_set_updated_at BEFORE UPDATE ON public.student_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER student_payments_set_updated_at BEFORE UPDATE ON public.student_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_active_academic_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_user_id AND p.role IN ('admin', 'teacher') AND p.status = 'active'
      ) THEN true
      ELSE EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.students s ON s.profile_id = p.id
        JOIN public.student_subscriptions sub ON sub.student_id = s.id
        WHERE p.id = p_user_id
          AND p.status = 'active'
          AND s.status = 'active'
          AND sub.status IN ('active', 'grace_period', 'manually_extended')
          AND (
            sub.expires_at IS NULL
            OR sub.expires_at > now()
            OR (sub.grace_until IS NOT NULL AND sub.grace_until > now())
          )
      )
    END;
$$;

REVOKE ALL ON FUNCTION public.has_active_academic_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_academic_access(uuid) TO authenticated;

ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_own_or_admin
ON public.student_subscriptions FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR student_id = public.current_student_id()
);

CREATE POLICY subscriptions_write_admin
ON public.student_subscriptions FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY invoices_select_own_or_admin
ON public.invoices FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR student_id = public.current_student_id()
);

CREATE POLICY invoices_write_admin
ON public.invoices FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY payments_select_own_or_admin
ON public.student_payments FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR student_id = public.current_student_id()
);

CREATE POLICY payments_write_admin
ON public.student_payments FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
