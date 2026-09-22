-- Add library_audience.classes (must commit before use in later statements).
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'library_audience' and e.enumlabel = 'classes'
  ) then
    alter type public.library_audience add value 'classes';
  end if;
end $$;
