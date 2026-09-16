-- Must commit before other statements use the new enum label.
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'profile_status'
      and e.enumlabel = 'restricted'
  ) then
    alter type public.profile_status add value 'restricted';
  end if;
end $$;
