-- Mission 2/3 foundations after library_audience.classes exists.
-- Multi-group library targeting, subtypes, group curriculum progress, assignment attachments.

create table if not exists public.library_item_classes (
  library_item_id uuid not null references public.library_items(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (library_item_id, class_id)
);

create index if not exists library_item_classes_class_id_idx
  on public.library_item_classes (class_id);

alter table public.library_item_classes enable row level security;

drop policy if exists library_item_classes_select on public.library_item_classes;
create policy library_item_classes_select
  on public.library_item_classes for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or public.student_can_see_library_item(library_item_id)
  );

drop policy if exists library_item_classes_write on public.library_item_classes;
create policy library_item_classes_write
  on public.library_item_classes for all to authenticated
  using (
    public.is_admin()
    or (
      public.is_teacher()
      and public.is_teacher_of_class(class_id)
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_teacher()
      and public.is_teacher_of_class(class_id)
    )
  );

insert into public.library_item_classes (library_item_id, class_id)
select li.id, li.class_id
from public.library_items li
where li.class_id is not null
on conflict do nothing;

alter table public.library_items
  add column if not exists subtype text;

comment on column public.library_items.subtype is
  'Optional adminable subtype within domain/category (e.g. visa, logement).';

create table if not exists public.library_subtypes (
  id uuid primary key default gen_random_uuid(),
  domain public.library_domain not null,
  code text not null,
  label_fr text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (domain, code)
);

alter table public.library_subtypes enable row level security;

drop policy if exists library_subtypes_select on public.library_subtypes;
create policy library_subtypes_select
  on public.library_subtypes for select to authenticated
  using (active or public.is_admin() or public.is_teacher());

drop policy if exists library_subtypes_write_admin on public.library_subtypes;
create policy library_subtypes_write_admin
  on public.library_subtypes for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.library_subtypes (domain, code, label_fr, sort_order) values
  ('academic', 'cours', 'Cours', 10),
  ('academic', 'exercices', 'Exercices', 20),
  ('academic', 'annonce', 'Annonces', 30),
  ('professional', 'visa', 'Visa', 10),
  ('professional', 'demarches', 'Démarches administratives', 20),
  ('professional', 'documents', 'Documents requis', 30),
  ('professional', 'rendez_vous', 'Rendez-vous', 40),
  ('professional', 'logement', 'Logement', 50),
  ('professional', 'autre', 'Autres', 90)
on conflict (domain, code) do nothing;

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

create table if not exists public.class_curriculum_progress (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  status text not null default 'locked'
    check (status in ('locked', 'unlocked', 'completed')),
  unlocked_at timestamptz,
  completed_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, unit_id)
);

create index if not exists class_curriculum_progress_class_id_idx
  on public.class_curriculum_progress (class_id);

drop trigger if exists class_curriculum_progress_set_updated_at on public.class_curriculum_progress;
create trigger class_curriculum_progress_set_updated_at
before update on public.class_curriculum_progress
for each row execute function public.set_updated_at();

alter table public.class_curriculum_progress enable row level security;

drop policy if exists class_curriculum_progress_select on public.class_curriculum_progress;
create policy class_curriculum_progress_select
  on public.class_curriculum_progress for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
    or public.is_enrolled_in_class(class_id)
  );

drop policy if exists class_curriculum_progress_write on public.class_curriculum_progress;
create policy class_curriculum_progress_write
  on public.class_curriculum_progress for all to authenticated
  using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
  )
  with check (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
  );

create table if not exists public.assignment_attachments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  sort_order integer not null default 0,
  content_kind public.media_content_kind not null default 'document',
  title text,
  content_text text,
  content_url text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assignment_attachments_assignment_id_idx
  on public.assignment_attachments (assignment_id, sort_order);

drop trigger if exists assignment_attachments_set_updated_at on public.assignment_attachments;
create trigger assignment_attachments_set_updated_at
before update on public.assignment_attachments
for each row execute function public.set_updated_at();

alter table public.assignment_attachments enable row level security;

drop policy if exists assignment_attachments_select on public.assignment_attachments;
create policy assignment_attachments_select
  on public.assignment_attachments for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or public.student_can_access_assignment(assignment_id)
  );

drop policy if exists assignment_attachments_write on public.assignment_attachments;
create policy assignment_attachments_write
  on public.assignment_attachments for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_id
        and public.teacher_can_manage_assignment(a.class_id, a.level_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_id
        and public.teacher_can_manage_assignment(a.class_id, a.level_id)
    )
  );

insert into public.assignment_attachments (
  assignment_id, sort_order, content_kind, content_url, storage_bucket, storage_path, mime_type
)
select
  a.id,
  0,
  coalesce(a.content_kind, 'document'),
  a.content_url,
  a.attachment_bucket,
  a.attachment_path,
  a.mime_type
from public.assignments a
where (a.attachment_path is not null or a.content_url is not null)
  and not exists (
    select 1 from public.assignment_attachments aa where aa.assignment_id = a.id
  );

alter table public.assignments
  add column if not exists score_scale_label text;

alter table public.assignment_submissions
  add column if not exists graded_max_score numeric;

comment on column public.assignment_submissions.graded_max_score is
  'Max score at the time of grading — never silently reinterpret when assignment.max_score changes.';

update public.assignment_submissions s
set graded_max_score = a.max_score
from public.assignments a
where s.assignment_id = a.id
  and s.score is not null
  and s.graded_max_score is null;
