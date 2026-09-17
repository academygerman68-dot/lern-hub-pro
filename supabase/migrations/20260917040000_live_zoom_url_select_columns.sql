-- Table-level SELECT implies every column; a column REVOKE cannot hide zoom_url.
-- Re-grant SELECT on every column except zoom_url.

revoke select on table public.live_sessions from anon, authenticated;

grant select (
  id,
  title,
  class_id,
  teacher_id,
  starts_at,
  ends_at,
  status,
  meeting_provider,
  meeting_room,
  meeting_url,
  video_provider,
  created_by,
  created_at,
  updated_at
) on table public.live_sessions to anon, authenticated;

grant insert (zoom_url), update (zoom_url) on table public.live_sessions to authenticated;

notify pgrst, 'reload schema';
