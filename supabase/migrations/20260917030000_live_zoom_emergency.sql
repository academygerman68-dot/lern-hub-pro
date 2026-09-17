-- Emergency Zoom fallback on existing live_sessions.
-- Jitsi remains the default provider. Zoom is per-session only.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'video_provider') then
    create type public.video_provider as enum ('jitsi', 'zoom');
  end if;
end $$;

alter table public.live_sessions
  add column if not exists video_provider public.video_provider not null default 'jitsi',
  add column if not exists zoom_url text;

comment on column public.live_sessions.video_provider is
  'Active conference for this session: jitsi (default) or zoom (emergency).';
comment on column public.live_sessions.zoom_url is
  'Emergency Zoom join URL. Kept for traceability after returning to Jitsi.';
comment on column public.live_sessions.meeting_room is
  'Jitsi / JaaS room name bound to the session.';

create index if not exists live_sessions_video_provider_idx
  on public.live_sessions (video_provider);

-- Students must not read leftover Zoom URLs via PostgREST when Jitsi is active.
revoke select (zoom_url) on table public.live_sessions from anon, authenticated;

create or replace function public.can_access_live_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.live_sessions s
    where s.id = p_session_id
      and (
        public.is_admin()
        or public.is_teacher_of_class(s.class_id)
        or (
          public.is_enrolled_in_class(s.class_id)
          and public.is_active_user()
        )
      )
  );
$$;

revoke all on function public.can_access_live_session(uuid) from public;
grant execute on function public.can_access_live_session(uuid) to authenticated;

create or replace function public.live_session_join_target(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  s public.live_sessions%rowtype;
  staff boolean;
begin
  if not public.can_access_live_session(p_session_id) then
    raise exception 'SESSION_ACCESS_DENIED';
  end if;

  select * into s from public.live_sessions where id = p_session_id;
  if not found then
    raise exception 'SESSION_ACCESS_DENIED';
  end if;

  staff := public.is_admin() or public.is_teacher_of_class(s.class_id);

  if s.video_provider = 'zoom' then
    if s.zoom_url is null or length(trim(s.zoom_url)) = 0 then
      raise exception 'ZOOM_URL_MISSING';
    end if;
    return jsonb_build_object(
      'provider', 'zoom',
      'url', s.zoom_url,
      'room', s.meeting_room,
      'zoom_url', case when staff then s.zoom_url else null end
    );
  end if;

  return jsonb_build_object(
    'provider', 'jitsi',
    'url', s.meeting_url,
    'room', s.meeting_room,
    'zoom_url', case when staff then s.zoom_url else null end
  );
end;
$$;

revoke all on function public.live_session_join_target(uuid) from public;
grant execute on function public.live_session_join_target(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_sessions'
  ) then
    alter publication supabase_realtime add table public.live_sessions;
  end if;
end $$;
