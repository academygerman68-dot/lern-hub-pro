-- Part 1: announcements domain + multi-attachments + teacher classes RLS + student visibility.

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'library_domain' and e.enumlabel = 'announcements'
  ) then
    alter type public.library_domain add value 'announcements';
  end if;
end $$;

create table if not exists public.library_item_attachments (
  id uuid primary key default gen_random_uuid(),
  library_item_id uuid not null references public.library_items(id) on delete cascade,
  sort_order integer not null default 0,
  content_kind public.media_content_kind not null default 'document',
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size bigint,
  external_url text,
  text_body text,
  label text,
  created_at timestamptz not null default now()
);

create index if not exists library_item_attachments_item_idx
  on public.library_item_attachments (library_item_id, sort_order);

alter table public.library_item_attachments enable row level security;

drop policy if exists library_item_attachments_select on public.library_item_attachments;
create policy library_item_attachments_select
  on public.library_item_attachments for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or public.student_can_see_library_item(library_item_id)
  );

drop policy if exists library_item_attachments_write on public.library_item_attachments;
create policy library_item_attachments_write
  on public.library_item_attachments for all to authenticated
  using (
    public.is_admin()
    or (
      public.is_teacher()
      and exists (
        select 1 from public.library_items li
        where li.id = library_item_id
          and public.teacher_can_manage_library_item(li.audience::text, li.class_id, li.level_code)
      )
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_teacher()
      and exists (
        select 1 from public.library_items li
        where li.id = library_item_id
          and public.teacher_can_manage_library_item(li.audience::text, li.class_id, li.level_code)
      )
    )
  );

create or replace function public.teacher_can_manage_library_item(
  p_audience text,
  p_class_id uuid,
  p_level_code text
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    public.is_admin()
    or (
      p_audience in ('class', 'classes')
      and p_class_id is not null
      and public.is_teacher_of_class(p_class_id)
    );
$$;

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
        (li.domain = 'professional' and public.is_account_usable())
        or (li.domain::text = 'announcements' and public.is_account_usable())
        or (li.domain = 'academic' and public.is_active_user())
      )
      and (
        li.audience = 'everyone'
        or (li.audience = 'level' and li.level_code is not null and li.level_code = me.level_code)
        or (li.audience = 'class' and li.class_id is not null and li.class_id in (select class_id from enroll))
        or (
          li.audience = 'classes'
          and exists (
            select 1
            from public.library_item_classes lic
            where lic.library_item_id = li.id
              and lic.class_id in (select class_id from enroll)
          )
        )
      )
  );
$$;

-- Backfill primary attachment rows for existing items
insert into public.library_item_attachments (
  library_item_id, sort_order, content_kind, storage_bucket, storage_path, mime_type, file_size, external_url
)
select
  li.id,
  0,
  coalesce(li.content_kind, 'document'::public.media_content_kind),
  li.storage_bucket,
  li.storage_path,
  li.mime_type,
  li.file_size,
  li.external_url
from public.library_items li
where li.archived_at is null
  and (li.storage_path is not null or li.external_url is not null)
  and not exists (
    select 1 from public.library_item_attachments a where a.library_item_id = li.id
  );
