-- German Academy prototype: pending accounts, class schedules, session participants,
-- message attachments, recording external links, Zoom join hardening helpers.
-- Requires 20260917205000_profile_status_pending (enum value committed).

-- Usable accounts can log in (pending/restricted see limited UI).
create or replace function public.is_account_usable()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status in ('active', 'restricted', 'pending')
  );
$$;

create or replace function public.is_pending_or_restricted()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status in ('pending', 'restricted')
  );
$$;

revoke all on function public.is_pending_or_restricted() from public;
grant execute on function public.is_pending_or_restricted() to authenticated;

-- Public signup: student only, pending until admin activates.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  first_name text := coalesce(NEW.raw_user_meta_data ->> 'first_name', '');
  last_name text := coalesce(NEW.raw_user_meta_data ->> 'last_name', '');
  full_name text := coalesce(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '');
  requested_role text := lower(coalesce(NEW.raw_user_meta_data ->> 'role', 'student'));
  seed_flag text := coalesce(NEW.raw_user_meta_data ->> 'seed', '');
  safe_role public.app_role := 'student';
  initial_status public.profile_status := 'pending';
begin
  if first_name = '' and full_name <> '' then
    first_name := split_part(full_name, ' ', 1);
    last_name := nullif(trim(substr(full_name, length(first_name) + 1)), '');
  end if;

  -- Only service-role / seed metadata may create non-student roles as active.
  if seed_flag = 'true' and requested_role in ('student', 'teacher', 'admin') then
    safe_role := requested_role::public.app_role;
    initial_status := 'active';
  else
    safe_role := 'student';
    initial_status := 'pending';
  end if;

  insert into public.profiles (id, role, email, first_name, last_name, language, status, phone)
  values (
    NEW.id,
    safe_role,
    NEW.email,
    coalesce(first_name, ''),
    coalesce(last_name, ''),
    case
      when NEW.raw_user_meta_data ->> 'language' in ('en', 'fr', 'de')
        then (NEW.raw_user_meta_data ->> 'language')::public.app_locale
      else 'fr'::public.app_locale
    end,
    initial_status,
    nullif(trim(coalesce(NEW.raw_user_meta_data ->> 'phone', '')), '')
  );
  return NEW;
end;
$function$;

create or replace function public.admin_set_profile_status(
  p_profile_id uuid,
  p_status public.profile_status
)
returns public.profiles
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.profiles;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if p_profile_id = auth.uid() and p_status in ('suspended', 'archived', 'pending') then
    raise exception 'CANNOT_SELF_LOCK';
  end if;

  update public.profiles
  set status = p_status,
      updated_at = now()
  where id = p_profile_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_row.role = 'student' then
    update public.students
    set status = case
      when p_status = 'active' then 'active'::public.record_status
      when p_status = 'archived' then 'archived'::public.record_status
      else 'inactive'::public.record_status
    end,
    updated_at = now()
    where profile_id = p_profile_id;
  end if;

  if v_row.role = 'teacher' then
    update public.teachers
    set status = case
      when p_status = 'active' then 'active'::public.record_status
      when p_status = 'archived' then 'archived'::public.record_status
      else 'inactive'::public.record_status
    end,
    updated_at = now()
    where profile_id = p_profile_id;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Class weekly schedules + monthly session generation (no duplicates)
-- ---------------------------------------------------------------------------
create table if not exists public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- ISO: 1=Mon … 7=Sun
  start_time time not null,
  end_time time not null,
  title_template text not null default 'Cours en direct',
  timezone text not null default 'Africa/Casablanca',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_schedules_time_chk check (end_time > start_time),
  constraint class_schedules_unique unique (class_id, weekday, start_time)
);

create index if not exists class_schedules_class_id_idx on public.class_schedules (class_id);

drop trigger if exists class_schedules_set_updated_at on public.class_schedules;
create trigger class_schedules_set_updated_at
before update on public.class_schedules
for each row execute function public.set_updated_at();

alter table public.class_schedules enable row level security;

drop policy if exists class_schedules_select on public.class_schedules;
create policy class_schedules_select
  on public.class_schedules for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
    or public.is_enrolled_in_class(class_id)
  );

drop policy if exists class_schedules_write_staff on public.class_schedules;
create policy class_schedules_write_staff
  on public.class_schedules for all to authenticated
  using (public.is_admin() or public.is_teacher_of_class(class_id))
  with check (public.is_admin() or public.is_teacher_of_class(class_id));

create or replace function public.generate_class_month_sessions(
  p_class_id uuid,
  p_year integer,
  p_month integer
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_class public.classes%rowtype;
  v_sched record;
  v_day date;
  v_month_start date;
  v_month_end date;
  v_starts timestamptz;
  v_ends timestamptz;
  v_title text;
  v_room text;
  v_id uuid;
  v_inserted integer := 0;
  v_tz text;
begin
  if not (public.is_admin() or public.is_teacher_of_class(p_class_id)) then
    raise exception 'FORBIDDEN';
  end if;

  if p_month < 1 or p_month > 12 then
    raise exception 'INVALID_MONTH';
  end if;

  select * into v_class from public.classes where id = p_class_id;
  if not found then
    raise exception 'CLASS_NOT_FOUND';
  end if;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;

  for v_sched in
    select * from public.class_schedules where class_id = p_class_id
  loop
    v_tz := coalesce(nullif(v_sched.timezone, ''), 'Africa/Casablanca');
    v_day := v_month_start;
    while v_day <= v_month_end loop
      if extract(isodow from v_day)::int = v_sched.weekday then
        v_starts := (v_day::text || ' ' || v_sched.start_time::text)::timestamp
          at time zone v_tz;
        v_ends := (v_day::text || ' ' || v_sched.end_time::text)::timestamp
          at time zone v_tz;
        v_title := coalesce(nullif(trim(v_sched.title_template), ''), 'Cours en direct')
          || ' · ' || v_class.name;

        -- Idempotent: skip if a non-cancelled session already exists for this slot.
        if not exists (
          select 1
          from public.live_sessions ls
          where ls.class_id = p_class_id
            and ls.status <> 'cancelled'
            and ls.starts_at = v_starts
        ) then
          v_id := gen_random_uuid();
          v_room := 'german-academy-' || replace(v_id::text, '-', '');
          insert into public.live_sessions (
            id, title, class_id, teacher_id, starts_at, ends_at, status,
            meeting_provider, meeting_room, meeting_url, video_provider, created_by
          ) values (
            v_id,
            v_title,
            p_class_id,
            v_class.teacher_id,
            v_starts,
            v_ends,
            'scheduled',
            'jitsi',
            v_room,
            'https://meet.jit.si/' || v_room,
            'jitsi',
            auth.uid()
          );
          v_inserted := v_inserted + 1;
        end if;
      end if;
      v_day := v_day + 1;
    end loop;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.generate_class_month_sessions(uuid, integer, integer) from public;
grant execute on function public.generate_class_month_sessions(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Optional session participant allow-list
-- ---------------------------------------------------------------------------
create table if not exists public.live_session_participants (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (session_id, profile_id)
);

create index if not exists live_session_participants_profile_idx
  on public.live_session_participants (profile_id);

alter table public.live_session_participants enable row level security;

drop policy if exists live_session_participants_select on public.live_session_participants;
create policy live_session_participants_select
  on public.live_session_participants for select to authenticated
  using (
    public.is_admin()
    or profile_id = auth.uid()
    or exists (
      select 1 from public.live_sessions s
      where s.id = session_id
        and public.is_teacher_of_class(s.class_id)
    )
  );

drop policy if exists live_session_participants_write_staff on public.live_session_participants;
create policy live_session_participants_write_staff
  on public.live_session_participants for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.live_sessions s
      where s.id = session_id and public.is_teacher_of_class(s.class_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.live_sessions s
      where s.id = session_id and public.is_teacher_of_class(s.class_id)
    )
  );

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
          public.is_active_user()
          and (
            -- Explicit allow-list overrides enrollment when present
            (
              exists (
                select 1 from public.live_session_participants p
                where p.session_id = s.id
              )
              and exists (
                select 1 from public.live_session_participants p
                where p.session_id = s.id and p.profile_id = auth.uid()
              )
            )
            or (
              not exists (
                select 1 from public.live_session_participants p
                where p.session_id = s.id
              )
              and public.is_enrolled_in_class(s.class_id)
            )
          )
        )
      )
  );
$$;

-- Hardened join target: Zoom always returns join_url for students / start_url for staff.
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
      'room', null,
      'start_url', case when staff then nullif(trim(coalesce(s.zoom_start_url, '')), '') else null end
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

-- ---------------------------------------------------------------------------
-- 4) Messaging attachments
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists attachment_bucket text,
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime text,
  add column if not exists attachment_size bigint;

alter table public.messages drop constraint if exists messages_body_or_attachment_chk;
alter table public.messages
  add constraint messages_body_or_attachment_chk
  check (
    length(trim(coalesce(body, ''))) > 0
    or (attachment_path is not null and length(trim(attachment_path)) > 0)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists message_attachments_select on storage.objects;
create policy message_attachments_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.messages m
        join public.conversation_members cm
          on cm.conversation_id = m.conversation_id
         and cm.profile_id = auth.uid()
        where m.attachment_path = name
          and coalesce(m.attachment_bucket, 'message-attachments') = 'message-attachments'
      )
    )
  );

drop policy if exists message_attachments_insert on storage.objects;
create policy message_attachments_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists message_attachments_update on storage.objects;
create policy message_attachments_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists message_attachments_delete on storage.objects;
create policy message_attachments_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Recordings: external URL + teacher write
-- ---------------------------------------------------------------------------
alter table public.meeting_recordings
  add column if not exists external_url text;

alter table public.meeting_recordings drop constraint if exists meeting_recordings_external_url_chk;
alter table public.meeting_recordings
  add constraint meeting_recordings_external_url_chk
  check (
    external_url is null
    or external_url ~* '^https?://'
  );

drop policy if exists meeting_recordings_write_admin on public.meeting_recordings;
drop policy if exists meeting_recordings_write_staff on public.meeting_recordings;
create policy meeting_recordings_write_staff
  on public.meeting_recordings for all to authenticated
  using (
    public.is_admin()
    or (class_id is not null and public.is_teacher_of_class(class_id))
  )
  with check (
    public.is_admin()
    or (class_id is not null and public.is_teacher_of_class(class_id))
  );

drop policy if exists meeting_recordings_select on public.meeting_recordings;
create policy meeting_recordings_select
  on public.meeting_recordings for select to authenticated
  using (
    public.is_admin()
    or (
      class_id is not null
      and (
        public.is_teacher_of_class(class_id)
        or public.is_enrolled_in_class(class_id)
      )
      and status = 'ready'
      and (expires_at is null or expires_at > now())
    )
  );
