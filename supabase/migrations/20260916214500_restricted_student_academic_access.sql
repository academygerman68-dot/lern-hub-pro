-- Restricted students may stay signed in (is_account_usable),
-- but they must not read/write academic content.
-- Reuses is_active_user() (status = active only).

create or replace function public.is_enrolled_in_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.class_id = p_class_id
      and e.student_id = public.current_student_id()
      and e.status = 'active'
      and public.is_active_user()
  );
$$;

drop policy if exists courses_select on public.courses;
create policy courses_select
  on public.courses for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or (status = 'published' and public.is_active_user())
  );

drop policy if exists modules_select on public.modules;
create policy modules_select
  on public.modules for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or (status = 'published' and public.is_active_user())
  );

drop policy if exists units_select on public.units;
create policy units_select
  on public.units for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or (status = 'published' and public.is_active_user())
  );

drop policy if exists lessons_select on public.lessons;
create policy lessons_select
  on public.lessons for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or (status = 'published' and public.is_active_user())
  );

drop policy if exists lesson_materials_select on public.lesson_materials;
create policy lesson_materials_select
  on public.lesson_materials for select to authenticated
  using (
    exists (
      select 1
      from public.lessons l
      where l.id = lesson_id
        and (
          public.is_admin()
          or public.is_teacher()
          or (l.status = 'published' and public.is_active_user())
        )
    )
  );

drop policy if exists lesson_progress_write_own on public.lesson_progress;
create policy lesson_progress_write_own
  on public.lesson_progress for all to authenticated
  using (
    public.is_admin()
    or (student_id = public.current_student_id() and public.is_active_user())
  )
  with check (
    public.is_admin()
    or (student_id = public.current_student_id() and public.is_active_user())
  );

drop policy if exists assignments_select on public.assignments;
create policy assignments_select
  on public.assignments for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
    or (
      status = 'published'
      and public.is_enrolled_in_class(class_id)
    )
  );

drop policy if exists submissions_insert_own on public.assignment_submissions;
create policy submissions_insert_own
  on public.assignment_submissions for insert to authenticated
  with check (
    public.is_admin()
    or (student_id = public.current_student_id() and public.is_active_user())
  );

drop policy if exists exam_attempts_select on public.exam_attempts;
create policy exam_attempts_select
  on public.exam_attempts for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher()
    or (student_id = public.current_student_id() and public.is_active_user())
  );

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
  on public.profiles for update to authenticated
  using (
    (id = auth.uid() and public.is_account_usable())
    or public.is_admin()
  )
  with check (
    (id = auth.uid() and public.is_account_usable())
    or public.is_admin()
  );
