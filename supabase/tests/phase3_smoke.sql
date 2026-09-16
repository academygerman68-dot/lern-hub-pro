-- Phase 3 smoke checks (run after migration apply)
-- psql / supabase db execute

SELECT to_regclass('public.payment_proofs') IS NOT NULL AS payment_proofs_exists;
SELECT to_regclass('public.meeting_recordings') IS NOT NULL AS meeting_recordings_exists;
SELECT to_regclass('public.notification_outbox') IS NOT NULL AS notification_outbox_exists;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'library_items'
  AND column_name IN ('expires_at', 'published_at')
ORDER BY column_name;

-- Teachers must not have a SELECT policy granting payment_proofs
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.payment_proofs'::regclass
ORDER BY polname;

SELECT is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payment_proofs' AND column_name = 'payment_id';

SELECT has_function_privilege(
  'authenticated',
  'public.enqueue_notification_outbox(public.notification_channel, text, uuid, text, jsonb, text)',
  'EXECUTE'
) AS authenticated_can_enqueue_external_message;
