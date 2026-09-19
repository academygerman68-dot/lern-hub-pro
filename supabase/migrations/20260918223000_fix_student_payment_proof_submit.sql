-- Fix student payment-proof submit:
-- 1. Insert RLS used an ambiguous `p.student_id = student_id` (resolved as tautology).
-- 2. Students could not delete their own failed uploads (rollback after insert error).

CREATE OR REPLACE FUNCTION public.payment_is_submittable_by_student(
  p_payment_id uuid,
  p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_payments p
    WHERE p.id = p_payment_id
      AND p.student_id = p_student_id
      AND p.status IN ('pending', 'partial', 'overdue')
  );
$$;

REVOKE ALL ON FUNCTION public.payment_is_submittable_by_student(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payment_is_submittable_by_student(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.payment_is_submittable_by_student(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS payment_proofs_insert_own ON public.payment_proofs;
CREATE POLICY payment_proofs_insert_own ON public.payment_proofs
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR (
    student_id = public.current_student_id()
    AND public.payment_is_submittable_by_student(payment_id, student_id)
  )
);

DROP POLICY IF EXISTS documents_delete_own_payment_proofs ON storage.objects;
CREATE POLICY documents_delete_own_payment_proofs
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'students'
  AND (storage.foldername(name))[2] = public.current_student_id()::text
  AND (storage.foldername(name))[3] = 'payment-proofs'
);
