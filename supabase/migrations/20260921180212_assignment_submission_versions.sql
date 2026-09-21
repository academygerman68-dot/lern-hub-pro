-- Assignment submissions: versioning + post-deadline edit visibility.
-- Never silent overwrite: previous content is appended to response_versions.

ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS edited_after_due boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS response_versions jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.assignment_submissions
SET
  last_edited_at = coalesce(last_edited_at, updated_at, submitted_at, created_at),
  version = greatest(coalesce(version, 1), 1)
WHERE last_edited_at IS NULL OR version IS NULL;

COMMENT ON COLUMN public.assignment_submissions.last_edited_at IS
  'Last student edit timestamp (distinct from first submitted_at).';
COMMENT ON COLUMN public.assignment_submissions.version IS
  'Monotonic version of the student response (increments on each edit after first submit).';
COMMENT ON COLUMN public.assignment_submissions.edited_after_due IS
  'True when the student modified the response after the assignment due_at.';
COMMENT ON COLUMN public.assignment_submissions.response_versions IS
  'Append-only history of prior response snapshots (text/file/timestamps).';
