-- Raise A1-SIM-01 retake allowance for student practice.
UPDATE public.exams
SET max_attempts = 5,
    updated_at = now()
WHERE id = '811f4e04-864d-46b4-8c61-c2d319003efc'::uuid
  AND code = 'A1-SIM-01';
