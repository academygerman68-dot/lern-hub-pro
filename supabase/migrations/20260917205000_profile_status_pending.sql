-- Add pending profile status (must commit before use in later migration).
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'profile_status' and e.enumlabel = 'pending'
  ) then
    alter type public.profile_status add value 'pending';
  end if;
end $$;
