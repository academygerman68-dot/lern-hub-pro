-- UNPUBLISH / ROLLBACK PILOT — GA-A1-M01 ONLY.
-- Sets status back to draft. Keeps published_at history cleared for draft UX.
-- Does NOT delete attempts, answers, or media.
-- Does NOT touch GA-A1-M02, GA-A1-M03, or A1-SIM-01.

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

  UPDATE public.training_modules
  SET
    status = 'draft',
    published_at = NULL,
    updated_at = now()
  WHERE id = v_id
    AND code = 'GA-A1-M01';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Unpublish updated % rows (expected 1)', v_updated;
  END IF;

  RAISE NOTICE 'GA-A1-M01 set to draft (was %). Attempts/answers preserved.', v_status;
END $$;

COMMIT;

-- Verify:
-- SELECT code, status, published_at FROM public.training_modules WHERE code LIKE 'GA-A1-M0%';
-- SELECT COUNT(*) FROM public.training_module_attempts a
--   JOIN public.training_modules m ON m.id = a.module_id WHERE m.code = 'GA-A1-M01';
