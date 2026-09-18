-- Payment amounts, discounts, and partial payment tracking

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_status'
      AND e.enumlabel = 'suspended'
  ) THEN
    ALTER TYPE public.payment_status ADD VALUE 'suspended';
  END IF;
END $$;

ALTER TABLE public.student_payments
  ADD COLUMN IF NOT EXISTS initial_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_payments_discount_type_check'
  ) THEN
    ALTER TABLE public.student_payments
      ADD CONSTRAINT student_payments_discount_type_check
      CHECK (discount_type IS NULL OR discount_type IN ('percent', 'fixed'));
  END IF;
END $$;

UPDATE public.student_payments
SET initial_amount = amount
WHERE initial_amount IS NULL;
