-- Allow teachers to publish text-only pedagogical content (e.g. expression écrite)
DO $$ BEGIN
  ALTER TYPE public.media_content_kind ADD VALUE IF NOT EXISTS 'text';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.course_content_kind ADD VALUE IF NOT EXISTS 'text';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
