-- Students must not SELECT leftover Zoom URLs via PostgREST.
-- Staff can still write zoom_url when activating the emergency meeting.

revoke all (zoom_url) on table public.live_sessions from anon, authenticated, public;
grant insert (zoom_url) on table public.live_sessions to authenticated;
grant update (zoom_url) on table public.live_sessions to authenticated;
notify pgrst, 'reload schema';
