-- Restricted students keep account identity for profile/payments/messages.
-- Academic content remains gated by has_academic_access (status = active).
create or replace function public.is_student()
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
      and role = 'student'
      and status in ('active', 'restricted')
  );
$$;

revoke all on function public.is_student() from public;
grant execute on function public.is_student() to authenticated;

revoke all on function public.is_student() from public;
grant execute on function public.is_student() to authenticated;
