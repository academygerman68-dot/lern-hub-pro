-- Admin receipt on recorded payments + distinct class names from level codes
-- Matches remote migration payment_admin_receipt_on_student_payments + class name cleanup.

ALTER TABLE public.student_payments
  ADD COLUMN IF NOT EXISTS admin_receipt_bucket text,
  ADD COLUMN IF NOT EXISTS admin_receipt_path text,
  ADD COLUMN IF NOT EXISTS admin_receipt_mime text;

COMMENT ON COLUMN public.student_payments.admin_receipt_path IS
  'Storage path for admin-uploaded payment receipt (PDF/JPEG/PNG) on the payment row.';

-- Prefer group reference as display name when the class name was still a bare level code
UPDATE public.classes c
SET name = coalesce(nullif(trim(c.reference), ''), c.name || '-GRP')
WHERE c.name IN ('A1', 'A2', 'B1', 'B2')
  OR c.name = (SELECT code FROM public.levels l WHERE l.id = c.level_id);
