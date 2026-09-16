-- Admin platform hardening (after profile_status.restricted exists):
-- usable-account helpers, course content, library targeting, messaging.

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
      and status in ('active', 'restricted')
  );
$$;

create or replace function public.is_active_user()
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
      and status = 'active'
  );
$$;

create or replace function public.has_academic_access(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.students s
    join public.profiles p on p.id = s.profile_id
    join public.student_subscriptions sub on sub.student_id = s.id
    where s.id = p_student_id
      and s.status = 'active'
      and p.status = 'active'
      and sub.status in ('active', 'grace_period', 'manually_extended')
      and (
        sub.expires_at is null
        or sub.expires_at > now()
        or (sub.grace_until is not null and sub.grace_until > now())
      )
  );
$$;

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

  if p_profile_id = auth.uid() and p_status in ('suspended', 'archived') then
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

revoke all on function public.admin_set_profile_status(uuid, public.profile_status) from public;
grant execute on function public.admin_set_profile_status(uuid, public.profile_status) to authenticated;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'course_content_kind') then
    create type public.course_content_kind as enum ('none', 'pdf', 'link', 'image', 'audio');
  end if;
end $$;

alter table public.courses
  add column if not exists description text,
  add column if not exists content_kind public.course_content_kind not null default 'none',
  add column if not exists content_url text,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'library_domain') then
    create type public.library_domain as enum ('academic', 'professional');
  end if;
  if not exists (select 1 from pg_type where typname = 'library_audience') then
    create type public.library_audience as enum ('everyone', 'level', 'class');
  end if;
end $$;

alter table public.library_items
  add column if not exists domain public.library_domain not null default 'academic',
  add column if not exists audience public.library_audience not null default 'everyone',
  add column if not exists class_id uuid references public.classes(id) on delete set null,
  add column if not exists external_url text;

create index if not exists library_items_domain_idx on public.library_items (domain);
create index if not exists library_items_audience_idx on public.library_items (audience);
create index if not exists library_items_class_id_idx on public.library_items (class_id);

create or replace function public.student_can_see_library_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  with me as (
    select s.id as student_id, s.level_code
    from public.students s
    where s.profile_id = auth.uid()
    limit 1
  ),
  enroll as (
    select e.class_id
    from public.enrollments e
    join me on me.student_id = e.student_id
    where e.status = 'active'
  )
  select exists (
    select 1
    from public.library_items li
    cross join me
    where li.id = p_item_id
      and li.archived_at is null
      and li.visibility in ('academy', 'published')
      and (
        li.audience = 'everyone'
        or (li.audience = 'level' and li.level_code is not null and li.level_code = me.level_code)
        or (li.audience = 'class' and li.class_id is not null and li.class_id in (select class_id from enroll))
      )
  );
$$;

drop policy if exists library_items_select on public.library_items;
drop policy if exists library_items_select_staff on public.library_items;
drop policy if exists library_items_select_student_targeted on public.library_items;

create policy library_items_select_staff
  on public.library_items
  for select
  to authenticated
  using (public.is_admin() or public.is_teacher());

create policy library_items_select_student_targeted
  on public.library_items
  for select
  to authenticated
  using (
    public.is_student()
    and public.student_can_see_library_item(id)
  );

alter table public.assignments
  add column if not exists published_at timestamptz default now();

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_id uuid references public.classes(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists conversations_class_id_idx on public.conversations (class_id);
create index if not exists conversation_members_profile_idx on public.conversation_members (profile_id);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = p_conversation_id
      and profile_id = auth.uid()
  );
$$;

drop policy if exists conversations_select on public.conversations;
create policy conversations_select
  on public.conversations for select to authenticated
  using (public.is_admin() or public.is_conversation_member(id));

drop policy if exists conversations_insert_admin on public.conversations;
create policy conversations_insert_admin
  on public.conversations for insert to authenticated
  with check (public.is_admin());

drop policy if exists conversations_update_admin on public.conversations;
create policy conversations_update_admin
  on public.conversations for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select
  on public.conversation_members for select to authenticated
  using (public.is_admin() or profile_id = auth.uid() or public.is_conversation_member(conversation_id));

drop policy if exists conversation_members_insert_admin on public.conversation_members;
create policy conversation_members_insert_admin
  on public.conversation_members for insert to authenticated
  with check (public.is_admin());

drop policy if exists conversation_members_delete_admin on public.conversation_members;
create policy conversation_members_delete_admin
  on public.conversation_members for delete to authenticated
  using (public.is_admin());

drop policy if exists messages_select on public.messages;
create policy messages_select
  on public.messages for select to authenticated
  using (public.is_admin() or public.is_conversation_member(conversation_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
    and public.is_account_usable()
  );

create or replace function public.admin_create_class_conversation(
  p_class_id uuid,
  p_name text,
  p_include_teacher boolean default true
)
returns public.conversations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_conv public.conversations;
  v_teacher_profile uuid;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'NAME_REQUIRED';
  end if;

  insert into public.conversations (name, class_id, created_by)
  values (trim(p_name), p_class_id, auth.uid())
  returning * into v_conv;

  insert into public.conversation_members (conversation_id, profile_id, role)
  values (v_conv.id, auth.uid(), 'moderator')
  on conflict do nothing;

  insert into public.conversation_members (conversation_id, profile_id, role)
  select v_conv.id, s.profile_id, 'member'
  from public.enrollments e
  join public.students s on s.id = e.student_id
  where e.class_id = p_class_id
    and e.status = 'active'
  on conflict do nothing;

  if p_include_teacher then
    select t.profile_id into v_teacher_profile
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where c.id = p_class_id;

    if v_teacher_profile is not null then
      insert into public.conversation_members (conversation_id, profile_id, role)
      values (v_conv.id, v_teacher_profile, 'moderator')
      on conflict do nothing;
    end if;
  end if;

  return v_conv;
end;
$$;

revoke all on function public.admin_create_class_conversation(uuid, text, boolean) from public;
grant execute on function public.admin_create_class_conversation(uuid, text, boolean) to authenticated;
grant execute on function public.is_account_usable() to authenticated;
grant execute on function public.student_can_see_library_item(uuid) to authenticated;
grant execute on function public.is_conversation_member(uuid) to authenticated;
