-- Keep leftover Zoom URLs off Realtime payloads and reject non-Zoom links.

alter table public.live_sessions
  drop constraint if exists live_sessions_zoom_url_https_chk;

alter table public.live_sessions
  add constraint live_sessions_zoom_url_https_chk
  check (
    zoom_url is null
    or zoom_url ~* '^https://([a-z0-9-]+\.)*(zoom\.us|zoom\.com\.cn)/'
  );

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_sessions'
  ) then
    alter publication supabase_realtime drop table public.live_sessions;
  end if;
end $$;

alter publication supabase_realtime add table public.live_sessions (
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
);
