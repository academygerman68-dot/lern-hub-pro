-- Scalable academy workflows: payment SLA 48h, group reference, assignment notify, indexes.

-- ---------------------------------------------------------------------------
-- Classes / groups: unique reference + keep start/end dates first-class
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS reference text;

CREATE UNIQUE INDEX IF NOT EXISTS classes_reference_unique
  ON public.classes (reference)
  WHERE reference IS NOT NULL;

COMMENT ON COLUMN public.classes.reference IS
  'Stable group code e.g. A1-SEP-2026 (distinct from CEFR level).';

-- Backfill references for existing groups
UPDATE public.classes c
SET reference = upper(replace(coalesce(l.code, 'GRP'), ' ', '')) || '-' ||
  to_char(coalesce(c.start_date, c.created_at::date), 'MON-YYYY') || '-' ||
  substr(replace(c.id::text, '-', ''), 1, 4)
FROM public.levels l
WHERE l.id = c.level_id
  AND c.reference IS NULL;

-- ---------------------------------------------------------------------------
-- Payment proofs: SLA fields + admin receipt + not_approved status
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_proof_status' AND e.enumlabel = 'not_approved'
  ) THEN
    ALTER TYPE public.payment_proof_status ADD VALUE 'not_approved';
  END IF;
END $$;

ALTER TABLE public.payment_proofs
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS admin_receipt_bucket text,
  ADD COLUMN IF NOT EXISTS admin_receipt_path text,
  ADD COLUMN IF NOT EXISTS admin_receipt_mime text;

UPDATE public.payment_proofs
SET
  submitted_at = coalesce(submitted_at, created_at),
  validation_deadline = coalesce(validation_deadline, created_at + interval '48 hours')
WHERE submitted_at IS NULL OR validation_deadline IS NULL;

ALTER TABLE public.payment_proofs
  ALTER COLUMN submitted_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS payment_proofs_status_deadline_idx
  ON public.payment_proofs (status, validation_deadline);

CREATE INDEX IF NOT EXISTS student_payments_student_status_idx
  ON public.student_payments (student_id, status);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS classes_level_id_idx ON public.classes (level_id);
CREATE INDEX IF NOT EXISTS classes_teacher_id_idx ON public.classes (teacher_id);
CREATE INDEX IF NOT EXISTS assignments_class_id_idx ON public.assignments (class_id);
CREATE INDEX IF NOT EXISTS assignments_level_id_idx ON public.assignments (level_id);
CREATE INDEX IF NOT EXISTS exams_class_id_idx ON public.exams (class_id);
CREATE INDEX IF NOT EXISTS exams_level_id_idx ON public.exams (level_id);

-- Notify admin when a proof is submitted
CREATE OR REPLACE FUNCTION public.notify_admins_payment_proof_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles
    WHERE role = 'admin' AND status = 'active'
  LOOP
    PERFORM public.create_in_app_notification(
      r.id,
      'Justificatif de paiement à vérifier',
      'Un étudiant a déposé un justificatif en attente de validation.',
      'payment',
      'payments',
      NEW.id::text,
      jsonb_build_object('proof_id', NEW.id, 'payment_id', NEW.payment_id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_proofs_notify_admins ON public.payment_proofs;
CREATE TRIGGER payment_proofs_notify_admins
  AFTER INSERT ON public.payment_proofs
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_admins_payment_proof_submitted();

-- Mark stale pending proofs as not_approved after deadline; notify student
CREATE OR REPLACE FUNCTION public.expire_stale_payment_proofs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
  v_profile_id uuid;
BEGIN
  FOR r IN
    SELECT *
    FROM public.payment_proofs
    WHERE status = 'pending'
      AND validation_deadline IS NOT NULL
      AND validation_deadline < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.payment_proofs
    SET status = 'not_approved',
        admin_note = coalesce(admin_note, 'Non validé dans le délai de 48 heures.'),
        updated_at = now()
    WHERE id = r.id;

    SELECT profile_id INTO v_profile_id FROM public.students WHERE id = r.student_id;
    IF v_profile_id IS NOT NULL THEN
      PERFORM public.create_in_app_notification(
        v_profile_id,
        'Paiement non approuvé',
        'Votre justificatif n’a pas été validé dans les 48 heures. Déposez un nouveau justificatif ou contactez le support. L’accès aux cours peut être restreint.',
        'payment',
        'payments',
        r.id::text,
        jsonb_build_object('proof_id', r.id, 'status', 'not_approved')
      );
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_payment_proofs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_payment_proofs() TO authenticated;

-- Tighten academic access: unpaid after first month AND expired/not_approved proof blocks
CREATE OR REPLACE FUNCTION public.student_has_blocking_payment_issue(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payment_proofs pp
    WHERE pp.student_id = p_student_id
      AND pp.status = 'not_approved'
  )
  OR EXISTS (
    SELECT 1
    FROM public.student_payments sp
    WHERE sp.student_id = p_student_id
      AND sp.status IN ('overdue', 'suspended')
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_proofs p2
        WHERE p2.payment_id = sp.id AND p2.status = 'approved'
      )
  );
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
      AND NOT public.student_has_blocking_payment_issue(s.id)
      AND (
        s.first_login_at IS NULL
        OR now() < s.first_login_at + interval '1 month'
        OR (
          sub.status IN ('active', 'grace_period', 'manually_extended')
          AND (
            sub.expires_at IS NULL
            OR sub.expires_at > now()
            OR (sub.grace_until IS NOT NULL AND sub.grace_until > now())
          )
        )
        OR (
          s.first_login_at IS NOT NULL
          AND now() >= s.first_login_at + interval '1 month'
          AND public.post_first_month_live_sessions_count(s.id) < 2
        )
      )
  );
$$;

-- Update insert path to set deadline + notify; keep review_payment_proof compatible with not_approved
CREATE OR REPLACE FUNCTION public.review_payment_proof(
  p_proof_id uuid,
  p_approve boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS public.payment_proofs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proof public.payment_proofs;
  v_payment public.student_payments;
  v_profile_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_proof FROM public.payment_proofs WHERE id = p_proof_id FOR UPDATE;
  IF v_proof.id IS NULL THEN
    RAISE EXCEPTION 'proof_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_proof.status NOT IN ('pending', 'not_approved') THEN
    RAISE EXCEPTION 'proof_already_reviewed' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_payment
  FROM public.student_payments
  WHERE id = v_proof.payment_id
    AND student_id = v_proof.student_id
  FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'payment_mismatch' USING ERRCODE = '23503';
  END IF;

  IF p_approve THEN
    UPDATE public.payment_proofs
    SET
      status = 'approved',
      admin_note = p_admin_note,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    WHERE id = p_proof_id
    RETURNING * INTO v_proof;

    PERFORM public.mark_student_payment_paid(v_proof.payment_id);

    SELECT profile_id INTO v_profile_id FROM public.students WHERE id = v_proof.student_id;
    IF v_profile_id IS NOT NULL THEN
      PERFORM public.create_in_app_notification(
        v_profile_id,
        'Paiement approuvé',
        'Votre justificatif a été validé. L’accès académique est maintenu.',
        'payment',
        'payments',
        v_proof.id::text,
        jsonb_build_object('proof_id', v_proof.id)
      );
    END IF;
  ELSE
    IF nullif(btrim(p_admin_note), '') IS NULL THEN
      RAISE EXCEPTION 'rejection_reason_required' USING ERRCODE = '22023';
    END IF;
    UPDATE public.payment_proofs
    SET
      status = 'rejected',
      admin_note = p_admin_note,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    WHERE id = p_proof_id
    RETURNING * INTO v_proof;

    SELECT profile_id INTO v_profile_id FROM public.students WHERE id = v_proof.student_id;
    IF v_profile_id IS NOT NULL THEN
      PERFORM public.create_in_app_notification(
        v_profile_id,
        'Paiement refusé',
        coalesce(p_admin_note, 'Votre justificatif a été refusé. Vous pouvez en déposer un nouveau.'),
        'payment',
        'payments',
        v_proof.id::text,
        jsonb_build_object('proof_id', v_proof.id)
      );
    END IF;
  END IF;

  RETURN v_proof;
END;
$$;

-- Assignment submission notifications
CREATE OR REPLACE FUNCTION public.notify_assignment_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment public.assignments;
  v_teacher_profile uuid;
  v_student_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' AND NEW.status = 'submitted' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_assignment FROM public.assignments WHERE id = NEW.assignment_id;
  IF v_assignment.class_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.profile_id INTO v_teacher_profile
  FROM public.classes c
  JOIN public.teachers t ON t.id = c.teacher_id
  WHERE c.id = v_assignment.class_id;

  SELECT trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
  INTO v_student_name
  FROM public.students s
  JOIN public.profiles p ON p.id = s.profile_id
  WHERE s.id = NEW.student_id;

  IF v_teacher_profile IS NOT NULL THEN
    PERFORM public.create_in_app_notification(
      v_teacher_profile,
      'Devoir remis',
      coalesce(nullif(v_student_name, ''), 'Un étudiant') || ' a remis « ' || v_assignment.title || ' ».',
      'assignment',
      'assignments',
      NEW.assignment_id::text,
      jsonb_build_object('submission_id', NEW.id, 'assignment_id', NEW.assignment_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assignment_submissions_notify_teacher ON public.assignment_submissions;
CREATE TRIGGER assignment_submissions_notify_teacher
  AFTER INSERT OR UPDATE OF status ON public.assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_assignment_submitted();

CREATE OR REPLACE FUNCTION public.notify_assignment_graded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_title text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'graded' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'graded' THEN
    RETURN NEW;
  END IF;

  SELECT s.profile_id, a.title INTO v_profile_id, v_title
  FROM public.students s
  JOIN public.assignments a ON a.id = NEW.assignment_id
  WHERE s.id = NEW.student_id;

  IF v_profile_id IS NOT NULL THEN
    PERFORM public.create_in_app_notification(
      v_profile_id,
      'Devoir corrigé',
      'Votre devoir « ' || coalesce(v_title, '') || ' » a été corrigé.',
      'assignment',
      'assignments',
      NEW.assignment_id::text,
      jsonb_build_object('submission_id', NEW.id, 'score', NEW.score)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assignment_submissions_notify_student ON public.assignment_submissions;
CREATE TRIGGER assignment_submissions_notify_student
  AFTER UPDATE OF status ON public.assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_assignment_graded();
