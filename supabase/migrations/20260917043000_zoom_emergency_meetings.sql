-- Automatic Zoom emergency meetings on existing live_sessions.
-- Jitsi remains the default. Sensitive Zoom host fields stay off PostgREST SELECT.

alter table public.live_sessions
  add column if not exists zoom_meeting_id text,
  add column if not exists zoom_join_url text,
  add column if not exists zoom_start_url text,
  add column if not exists zoom_password text,
  add column if not exists zoom_created_at timestamptz,
  add column if not exists zoom_creating_at timestamptz;

comment on column public.live_sessions.zoom_meeting_id is
  'Zoom meeting id returned by the Zoom API.';
comment on column public.live_sessions.zoom_join_url is
  'Participant join URL. Served to enrolled students via RPC only.';
comment on column public.live_sessions.zoom_start_url is
  'Host start URL. Staff only, never students.';
comment on column public.live_sessions.zoom_password is
  'Zoom meeting password from the API. Never selected via PostgREST.';
comment on column public.live_sessions.zoom_created_at is
  'When the Zoom meeting was created by the emergency Edge Function.';
comment on column public.live_sessions.zoom_creating_at is
  'Row lock timestamp to prevent duplicate Zoom meeting creation.';

update public.live_sessions
set zoom_join_url = zoom_url
where zoom_join_url is null
  and zoom_url is not null;

alter table public.live_sessions
  drop constraint if exists live_sessions_zoom_join_url_https_chk;

alter table public.live_sessions
  add constraint live_sessions_zoom_join_url_https_chk
  check (
    zoom_join_url is null
    or zoom_join_url ~* '^https://([a-z0-9-]+\.)*(zoom\.us|zoom\.com\.cn)/'
  );

revoke all (zoom_join_url, zoom_start_url, zoom_password, zoom_meeting_id, zoom_creating_at)
  on table public.live_sessions from anon, authenticated, public;

grant update (zoom_creating_at) on table public.live_sessions to authenticated;

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
  join_url text;
begin
  if not public.can_access_live_session(p_session_id) then
    raise exception 'SESSION_ACCESS_DENIED';
  end if;

  select * into s from public.live_sessions where id = p_session_id;
  if not found then
    raise exception 'SESSION_ACCESS_DENIED';
  end if;

  staff := public.is_admin() or public.is_teacher_of_class(s.class_id);
  join_url := nullif(trim(coalesce(s.zoom_join_url, s.zoom_url, '')), '');

  if s.video_provider = 'zoom' then
    if join_url is null then
      raise exception 'ZOOM_URL_MISSING';
    end if;
    return jsonb_build_object(
      'provider', 'zoom',
      'url', join_url,
      'room', s.meeting_room,
      'start_url', case when staff then s.zoom_start_url else null end
    );
  end if;

  return jsonb_build_object(
    'provider', 'jitsi',
    'url', s.meeting_url,
    'room', s.meeting_room,
    'start_url', null
  );
end;
$$;

create or replace function public.claim_emergency_zoom(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  s public.live_sessions%rowtype;
  join_url text;
  lock_stale interval := interval '45 seconds';
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select * into s from public.live_sessions where id = p_session_id for update;
  if not found then
    raise exception 'SESSION_ACCESS_DENIED';
  end if;

  if not (public.is_admin() or public.is_teacher_of_class(s.class_id)) then
    raise exception 'SESSION_ACCESS_DENIED';
  end if;

  if s.status in ('completed', 'cancelled') then
    raise exception 'SESSION_CLOSED';
  end if;

  join_url := nullif(trim(coalesce(s.zoom_join_url, s.zoom_url, '')), '');

  if s.zoom_meeting_id is not null and join_url is not null then
    update public.live_sessions
    set video_provider = 'zoom',
        zoom_creating_at = null
    where id = p_session_id;
    return jsonb_build_object('status', 'ready', 'reused', true);
  end if;

  if s.zoom_creating_at is not null and s.zoom_creating_at > now() - lock_stale then
    return jsonb_build_object('status', 'creating', 'reused', false);
  end if;

  update public.live_sessions
  set zoom_creating_at = now()
  where id = p_session_id;

  return jsonb_build_object(
    'status', 'create',
    'reused', false,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'title', s.title,
    'class_id', s.class_id
  );
end;
$$;

create or replace function public.release_emergency_zoom_lock(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  update public.live_sessions
  set zoom_creating_at = null
  where id = p_session_id
    and zoom_meeting_id is null
    and (public.is_admin() or public.is_teacher_of_class(class_id));
end;
$$;

revoke all on function public.claim_emergency_zoom(uuid) from public;
revoke all on function public.release_emergency_zoom_lock(uuid) from public;
grant execute on function public.claim_emergency_zoom(uuid) to authenticated;
grant execute on function public.release_emergency_zoom_lock(uuid) to authenticated;
grant execute on function public.live_session_join_target(uuid) to authenticated;
