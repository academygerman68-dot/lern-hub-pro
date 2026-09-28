-- PUBLISH GA-A1-M01 ONLY — run after explicit operator confirmation.
-- Do NOT bundle into an auto-applied migration without approval.
-- Prerequisites:
--   1) Front live ships training runner (>= commit 05d9b53) + /exam-media/ga-a1-m01 audio HTTPS 200
--   2) GA-A1-M02 / GA-A1-M03 remain draft (this script never touches them)
--   3) No RLS/RPC changes
--
-- Stable id: a1b10001-0001-4000-8000-000000000101
-- Code: GA-A1-M01

BEGIN;

DO $$
DECLARE
  v_id uuid := 'a1b10001-0001-4000-8000-000000000101'::uuid;
  v_code text;
  v_status public.training_module_status;
  v_count integer;
  v_updated integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.training_modules
  WHERE code = 'GA-A1-M01';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 row for GA-A1-M01, found %', v_count;
  END IF;

  SELECT id, code, status INTO v_id, v_code, v_status
  FROM public.training_modules
  WHERE code = 'GA-A1-M01'
  FOR UPDATE;

  IF v_id IS DISTINCT FROM 'a1b10001-0001-4000-8000-000000000101'::uuid THEN
    RAISE EXCEPTION 'GA-A1-M01 id mismatch: %', v_id;
  END IF;

  IF v_code <> 'GA-A1-M01' THEN
    RAISE EXCEPTION 'Unexpected code %', v_code;
  END IF;

  -- Refuse if sibling drafts somehow share this id (paranoia).
  IF EXISTS (
    SELECT 1 FROM public.training_modules
    WHERE id = v_id AND code <> 'GA-A1-M01'
  ) THEN
    RAISE EXCEPTION 'Id collision for GA-A1-M01';
  END IF;

  UPDATE public.training_modules
  SET
    status = 'published',
    published_at = coalesce(published_at, now()),
    updated_at = now()
  WHERE id = v_id
    AND code = 'GA-A1-M01';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Publish updated % rows (expected 1)', v_updated;
  END IF;

  -- Post-condition: siblings untouched.
  IF EXISTS (
    SELECT 1 FROM public.training_modules
    WHERE code IN ('GA-A1-M02', 'GA-A1-M03') AND status <> 'draft'
  ) THEN
    RAISE EXCEPTION 'Abort: M02/M03 must remain draft';
  END IF;

  RAISE NOTICE 'Published GA-A1-M01 only. Previous status was %.', v_status;
END $$;

COMMIT;

-- Verify:
-- SELECT code, status, published_at, version FROM public.training_modules ORDER BY code;
