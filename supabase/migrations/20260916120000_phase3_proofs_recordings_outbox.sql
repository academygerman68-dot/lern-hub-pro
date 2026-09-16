-- Phase 3: payment proofs, recordings metadata, notification outbox, library expiry
-- Additive only. Do not apply to production without explicit approval.

CREATE TYPE public.payment_proof_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.recording_status AS ENUM ('pending', 'ready', 'failed', 'unavailable');
CREATE TYPE public.outbox_status AS ENUM ('queued', 'sent', 'failed', 'skipped');

CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.student_payments (id) ON DELETE RESTRICT,
  storage_bucket text NOT NULL DEFAULT 'documents',
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint,
  declared_amount numeric(12, 2) NOT NULL CHECK (declared_amount > 0),
  operation_date date NOT NULL,
  operation_reference text,
  status public.payment_proof_status NOT NULL DEFAULT 'pending',
  student_note text,
  admin_note text,
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_proofs_student_id_idx ON public.payment_proofs (student_id);
CREATE INDEX IF NOT EXISTS payment_proofs_status_idx ON public.payment_proofs (status);
CREATE INDEX IF NOT EXISTS payment_proofs_created_at_idx ON public.payment_proofs (created_at DESC);
CREATE UNIQUE INDEX payment_proofs_one_open_review_per_payment_idx
  ON public.payment_proofs (payment_id)
  WHERE status IN ('pending', 'approved');

CREATE TABLE IF NOT EXISTS public.meeting_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid REFERENCES public.live_sessions (id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES public.teachers (id) ON DELETE SET NULL,
  title text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'recordings',
  storage_path text,
  duration_seconds integer,
  file_size bigint,
  mime_type text,
  status public.recording_status NOT NULL DEFAULT 'unavailable',
  expires_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_recordings_class_id_idx ON public.meeting_recordings (class_id);
CREATE INDEX IF NOT EXISTS meeting_recordings_session_id_idx ON public.meeting_recordings (live_session_id);
CREATE INDEX IF NOT EXISTS meeting_recordings_status_idx ON public.meeting_recordings (status);

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel public.notification_channel NOT NULL,
  template_key text NOT NULL,
  recipient_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  recipient_address text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.outbox_status NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  idempotency_key text NOT NULL UNIQUE,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_outbox_status_idx ON public.notification_outbox (status);
CREATE INDEX IF NOT EXISTS notification_outbox_scheduled_at_idx ON public.notification_outbox (scheduled_at);

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz DEFAULT now();

CREATE TRIGGER payment_proofs_set_updated_at
BEFORE UPDATE ON public.payment_proofs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER meeting_recordings_set_updated_at
BEFORE UPDATE ON public.meeting_recordings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER notification_outbox_set_updated_at
BEFORE UPDATE ON public.notification_outbox
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_proofs_select ON public.payment_proofs
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR student_id = public.current_student_id()
);

CREATE POLICY payment_proofs_insert_own ON public.payment_proofs
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR (
    student_id = public.current_student_id()
    AND EXISTS (
      SELECT 1
      FROM public.student_payments p
      WHERE p.id = payment_id
        AND p.student_id = student_id
        AND p.status IN ('pending', 'partial', 'overdue')
    )
  )
);

CREATE POLICY payment_proofs_update_admin ON public.payment_proofs
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Teachers never see payment proofs (no teacher policy).

CREATE POLICY meeting_recordings_select ON public.meeting_recordings
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR (
    class_id IS NOT NULL
    AND (
      public.is_teacher_of_class(class_id)
      OR public.is_enrolled_in_class(class_id)
    )
    AND status = 'ready'
    AND (expires_at IS NULL OR expires_at > now())
  )
);

CREATE POLICY meeting_recordings_write_admin ON public.meeting_recordings
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY notification_outbox_admin ON public.notification_outbox
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.enqueue_notification_outbox(
  p_channel public.notification_channel,
  p_template_key text,
  p_recipient_profile_id uuid,
  p_recipient_address text,
  p_payload jsonb,
  p_idempotency_key text
)
RETURNS public.notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notification_outbox;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notification_outbox (
    channel, template_key, recipient_profile_id, recipient_address, payload, idempotency_key, status
  ) VALUES (
    p_channel, p_template_key, p_recipient_profile_id, p_recipient_address,
    coalesce(p_payload, '{}'::jsonb), p_idempotency_key, 'queued'
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET updated_at = now()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.notification_outbox WHERE idempotency_key = p_idempotency_key;
  END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification_outbox(public.notification_channel, text, uuid, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_notification_outbox(public.notification_channel, text, uuid, text, jsonb, text) FROM anon, authenticated;

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

  IF v_proof.status <> 'pending' THEN
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
  IF v_payment.status NOT IN ('pending', 'partial', 'overdue') THEN
    RAISE EXCEPTION 'payment_not_reviewable' USING ERRCODE = 'P0001';
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
        'Justificatif approuvé',
        'Votre avis d''opération a été validé. L''accès académique est rétabli.',
        'payment',
        'payments',
        v_proof.id::text,
        jsonb_build_object('proof_id', v_proof.id)
      );
      PERFORM public.enqueue_notification_outbox(
        'email',
        'payment_proof_approved',
        v_profile_id,
        NULL,
        jsonb_build_object('proof_id', v_proof.id),
        'proof-approved-' || v_proof.id::text
      );
    END IF;
    PERFORM public.write_audit_log(
      'payment_proof.approved', 'payment_proof', v_proof.id, NULL,
      to_jsonb(v_proof), jsonb_build_object('payment_id', v_proof.payment_id)
    );
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
        'Justificatif refusé',
        coalesce(p_admin_note, 'Votre justificatif a été refusé. Vous pouvez en déposer un nouveau.'),
        'payment',
        'payments',
        v_proof.id::text,
        jsonb_build_object('proof_id', v_proof.id)
      );
    END IF;
    PERFORM public.write_audit_log(
      'payment_proof.rejected', 'payment_proof', v_proof.id, NULL,
      to_jsonb(v_proof), jsonb_build_object('payment_id', v_proof.payment_id)
    );
  END IF;

  RETURN v_proof;
END;
$$;

REVOKE ALL ON FUNCTION public.review_payment_proof(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_payment_proof(uuid, boolean, text) TO authenticated;

-- Hide expired library items from students (staff still see them)
DROP POLICY IF EXISTS library_items_select ON public.library_items;
CREATE POLICY library_items_select ON public.library_items
FOR SELECT TO authenticated
USING (
  public.is_admin() OR public.is_teacher()
  OR (
    archived_at IS NULL
    AND visibility IN ('academy', 'published')
    AND (expires_at IS NULL OR expires_at > now())
    AND (published_at IS NULL OR published_at <= now())
  )
  OR created_by = auth.uid()
);

-- Students may upload payment proofs under students/{student_id}/payment-proofs/*
-- Teachers must not read payment-proof paths (bank justificatifs).
DROP POLICY IF EXISTS documents_write_admin ON storage.objects;
CREATE POLICY documents_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    public.is_admin()
    OR (
      public.is_teacher()
      AND (storage.foldername(name))[3] IS DISTINCT FROM 'payment-proofs'
    )
    OR (
      (storage.foldername(name))[1] = 'students'
      AND (storage.foldername(name))[2] = public.current_student_id()::text
      AND (storage.foldername(name))[3] = 'payment-proofs'
    )
  )
);

DROP POLICY IF EXISTS documents_select ON storage.objects;
CREATE POLICY documents_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    public.is_admin()
    OR (
      (storage.foldername(name))[1] = 'students'
      AND (storage.foldername(name))[2] = public.current_student_id()::text
    )
    OR (
      public.is_teacher()
      AND (storage.foldername(name))[3] IS DISTINCT FROM 'payment-proofs'
      AND (storage.foldername(name))[1] <> 'students'
    )
  )
);

-- Branding / language defaults (FR + AR). Additive upserts only.
INSERT INTO public.app_settings (key, value, is_public, description) VALUES
  ('academy_name', '"German Language Academy"'::jsonb, true, 'Public academy display name'),
  ('academy_tagline', '"Apprendre l’allemand. Construire l’avenir."'::jsonb, true, 'Public tagline'),
  ('logo_url', 'null'::jsonb, true, 'Public logo URL or storage path'),
  ('logo_storage_path', 'null'::jsonb, true, 'Private branding path in avatars bucket'),
  ('default_language', '"fr"'::jsonb, true, 'Default UI language'),
  ('available_languages', '["fr","ar"]'::jsonb, true, 'Enabled UI languages'),
  ('recording_provider', '"none"'::jsonb, false, 'Recording provider: none|jaas|external'),
  ('email_provider', '"none"'::jsonb, false, 'Email provider: none|resend|smtp'),
  ('whatsapp_provider', '"none"'::jsonb, false, 'WhatsApp provider: none|meta|twilio')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  is_public = EXCLUDED.is_public,
  description = EXCLUDED.description,
  updated_at = now();
