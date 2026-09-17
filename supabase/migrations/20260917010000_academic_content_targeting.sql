-- Academic targeting: level/class for courses, library, assignments, mock exams.
-- Reuses levels, classes, enrollments. Tightens student RLS beyond UI filters.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'media_content_kind') then
    create type public.media_content_kind as enum (
      'pdf',
      'document',
      'link',
      'image',
      'audio',
      'poster'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Assignments: level-wide OR specific class
-- ---------------------------------------------------------------------------
alter table public.assignments
  add column if not exists level_id uuid references public.levels (id) on delete restrict,
  add column if not exists content_kind public.media_content_kind not null default 'pdf',
  add column if not exists content_url text,
  add column if not exists mime_type text;

update public.assignments a
set level_id = c.level_id
from public.classes c
where a.level_id is null
  and a.class_id = c.id;

-- Any leftover rows (should not exist) inherit A1 to satisfy NOT NULL.
update public.assignments
set level_id = (select id from public.levels order by sort_order limit 1)
where level_id is null;

alter table public.assignments
  alter column level_id set not null;

alter table public.assignments
  alter column class_id drop not null;

create index if not exists assignments_level_id_idx on public.assignments (level_id);

create or replace function public.assignments_align_class_level()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  class_level uuid;
begin
  if new.class_id is not null then
    select c.level_id into class_level from public.classes c where c.id = new.class_id;
    if class_level is null then
      raise exception 'CLASS_NOT_FOUND';
    end if;
    if class_level is distinct from new.level_id then
      raise exception 'CLASS_LEVEL_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists assignments_align_class_level on public.assignments;
create trigger assignments_align_class_level
  before insert or update of class_id, level_id
  on public.assignments
  for each row execute function public.assignments_align_class_level();

-- ---------------------------------------------------------------------------
-- Exams: optional class + attachment metadata
-- ---------------------------------------------------------------------------
alter table public.exams
  add column if not exists class_id uuid references public.classes (id) on delete set null,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists instructions text,
  add column if not exists content_kind public.media_content_kind not null default 'pdf',
  add column if not exists content_url text,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text;

create index if not exists exams_class_id_idx on public.exams (class_id);

create or replace function public.exams_align_class_level()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  class_level uuid;
begin
  if new.class_id is not null then
    select c.level_id into class_level from public.classes c where c.id = new.class_id;
    if class_level is null then
      raise exception 'CLASS_NOT_FOUND';
    end if;
    if class_level is distinct from new.level_id then
      raise exception 'CLASS_LEVEL_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists exams_align_class_level on public.exams;
create trigger exams_align_class_level
  before insert or update of class_id, level_id
  on public.exams
  for each row execute function public.exams_align_class_level();

-- ---------------------------------------------------------------------------
-- Library: explicit content kind
-- ---------------------------------------------------------------------------
alter table public.library_items
  add column if not exists content_kind public.media_content_kind not null default 'document';

update public.library_items
set content_kind = case
  when external_url is not null and length(trim(external_url)) > 0 then 'link'::public.media_content_kind
  when coalesce(mime_type, '') like 'image/%' then 'image'::public.media_content_kind
  when coalesce(mime_type, '') like 'audio/%' then 'audio'::public.media_content_kind
  when coalesce(mime_type, '') like 'application/pdf%' then 'pdf'::public.media_content_kind
  else 'document'::public.media_content_kind
end
where content_kind = 'document';

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create or replace function public.student_can_access_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.courses c
    join public.levels l on l.id = c.level_id
    join public.students s on s.profile_id = auth.uid()
    where c.id = p_course_id
      and c.status = 'published'
      and public.is_active_user()
      and s.level_code is not null
      and s.level_code = l.code
  );
$$;

create or replace function public.student_can_access_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.assignments a
    join public.levels l on l.id = a.level_id
    join public.students s on s.profile_id = auth.uid()
    where a.id = p_assignment_id
      and a.status = 'published'
      and a.archived_at is null
      and public.is_active_user()
      and (
        (
          a.class_id is not null
          and public.is_enrolled_in_class(a.class_id)
        )
        or (
          a.class_id is null
          and s.level_code is not null
          and s.level_code = l.code
        )
      )
  );
$$;

create or replace function public.teacher_can_manage_assignment(p_class_id uuid, p_level_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    public.is_admin()
    or (
      p_class_id is not null
      and public.is_teacher_of_class(p_class_id)
    )
    or (
      p_class_id is null
      and exists (
        select 1
        from public.classes c
        where c.teacher_id = public.current_teacher_id()
          and c.level_id = p_level_id
          and c.status <> 'archived'
      )
    );
$$;

create or replace function public.student_can_access_exam(p_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.exams e
    join public.levels l on l.id = e.level_id
    join public.students s on s.profile_id = auth.uid()
    where e.id = p_exam_id
      and e.status = 'published'
      and public.is_active_user()
      and public.has_active_academic_access()
      and s.level_code is not null
      and s.level_code = l.code
      and (
        e.class_id is null
        or public.is_enrolled_in_class(e.class_id)
      )
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
        or (li.domain = 'academic' and public.is_active_user())
      )
      and (
        li.audience = 'everyone'
        or (li.audience = 'level' and li.level_code is not null and li.level_code = me.level_code)
        or (li.audience = 'class' and li.class_id is not null and li.class_id in (select class_id from enroll))
      )
  );
$$;

revoke all on function public.student_can_access_course(uuid) from public;
revoke all on function public.student_can_access_assignment(uuid) from public;
revoke all on function public.teacher_can_manage_assignment(uuid, uuid) from public;
grant execute on function public.student_can_access_course(uuid) to authenticated;
grant execute on function public.student_can_access_assignment(uuid) to authenticated;
grant execute on function public.teacher_can_manage_assignment(uuid, uuid) to authenticated;
grant execute on function public.student_can_access_exam(uuid) to authenticated;
grant execute on function public.student_can_see_library_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Table RLS
-- ---------------------------------------------------------------------------
drop policy if exists courses_select on public.courses;
create policy courses_select
  on public.courses for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or public.student_can_access_course(id)
  );

drop policy if exists modules_select on public.modules;
create policy modules_select
  on public.modules for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or (
      status = 'published'
      and exists (
        select 1 from public.courses c
        where c.id = course_id
          and public.student_can_access_course(c.id)
      )
    )
  );

drop policy if exists units_select on public.units;
create policy units_select
  on public.units for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or (
      status = 'published'
      and exists (
        select 1
        from public.modules m
        join public.courses c on c.id = m.course_id
        where m.id = module_id
          and m.status = 'published'
          and public.student_can_access_course(c.id)
      )
    )
  );

drop policy if exists lessons_select on public.lessons;
create policy lessons_select
  on public.lessons for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or (
      status = 'published'
      and exists (
        select 1
        from public.units u
        join public.modules m on m.id = u.module_id
        join public.courses c on c.id = m.course_id
        where u.id = unit_id
          and u.status = 'published'
          and m.status = 'published'
          and public.student_can_access_course(c.id)
      )
    )
  );

drop policy if exists assignments_select on public.assignments;
create policy assignments_select
  on public.assignments for select to authenticated
  using (
    public.teacher_can_manage_assignment(class_id, level_id)
    or public.student_can_access_assignment(id)
  );

drop policy if exists assignments_write_staff on public.assignments;
create policy assignments_write_staff
  on public.assignments for all to authenticated
  using (public.teacher_can_manage_assignment(class_id, level_id))
  with check (public.teacher_can_manage_assignment(class_id, level_id));

drop policy if exists library_items_select_student_targeted on public.library_items;
create policy library_items_select_student_targeted
  on public.library_items
  for select
  to authenticated
  using (
    public.current_student_id() is not null
    and public.student_can_see_library_item(id)
  );

-- ---------------------------------------------------------------------------
-- Storage: mime types + object-level access (no public buckets)
-- ---------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'video/mp4'
]
where id in ('course-materials', 'library');

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/wav'
]
where id = 'documents';

drop policy if exists library_select_active on storage.objects;
create policy library_select_targeted
on storage.objects for select to authenticated
using (
  bucket_id = 'library'
  and (
    public.is_admin()
    or public.is_teacher()
    or exists (
      select 1
      from public.library_items li
      where li.storage_bucket = 'library'
        and li.storage_path = name
        and public.student_can_see_library_item(li.id)
    )
  )
);

drop policy if exists course_materials_select_active on storage.objects;
create policy course_materials_select_targeted
on storage.objects for select to authenticated
using (
  bucket_id = 'course-materials'
  and (
    public.is_admin()
    or public.is_teacher()
    or exists (
      select 1 from public.courses c
      where c.storage_bucket = 'course-materials'
        and c.storage_path = name
        and public.student_can_access_course(c.id)
    )
    or exists (
      select 1 from public.assignments a
      where a.attachment_bucket = 'course-materials'
        and a.attachment_path = name
        and public.student_can_access_assignment(a.id)
    )
    or exists (
      select 1 from public.exams e
      where e.storage_bucket = 'course-materials'
        and e.storage_path = name
        and public.student_can_access_exam(e.id)
    )
  )
);

drop policy if exists documents_select on storage.objects;
create policy documents_select
on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and (
    public.is_admin()
    or public.is_teacher()
    or (
      (storage.foldername(name))[1] = 'students'
      and (storage.foldername(name))[2] = public.current_student_id()::text
    )
    or exists (
      select 1 from public.assignments a
      where a.attachment_bucket = 'documents'
        and a.attachment_path = name
        and public.student_can_access_assignment(a.id)
    )
  )
);
