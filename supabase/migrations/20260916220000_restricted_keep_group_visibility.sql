-- Restricted students may still see their group membership on profile/dashboard.
-- Academic tables keep the is_active_user() gate.

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
  );
$$;

drop policy if exists assignments_select on public.assignments;
create policy assignments_select
  on public.assignments for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
    or (
      status = 'published'
      and public.is_enrolled_in_class(class_id)
      and public.is_active_user()
    )
  );

drop policy if exists live_sessions_select on public.live_sessions;
create policy live_sessions_select
  on public.live_sessions for select to authenticated
  using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
    or (
      public.is_enrolled_in_class(class_id)
      and public.is_active_user()
    )
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
        or (
          public.is_enrolled_in_class(class_id)
          and public.is_active_user()
        )
      )
      and status = 'ready'
      and (expires_at is null or expires_at > now())
    )
  );
