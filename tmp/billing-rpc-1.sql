create or replace function public.billing_catalog_amount(p_plan text, p_currency text)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text;
  v_raw jsonb;
  v_amount numeric;
begin
  if p_plan not in ('monthly', 'quarterly') then
    raise exception 'INVALID_BILLING_PLAN';
  end if;
  if upper(p_currency) not in ('MAD', 'EUR') then
    raise exception 'INVALID_CURRENCY';
  end if;

  v_key := 'billing_tariff_' || p_plan || '_' || upper(p_currency);
  select s.value into v_raw from public.app_settings s where s.key = v_key;

  if v_raw is not null then
    if jsonb_typeof(v_raw) = 'number' then
      v_amount := (v_raw #>> '{}')::numeric;
    elsif jsonb_typeof(v_raw) = 'string' then
      begin
        v_amount := trim(both '"' from v_raw::text)::numeric;
      exception when others then
        v_amount := null;
      end;
    end if;
  end if;

  if v_amount is null or v_amount <= 0 then
    v_amount := case
      when p_plan = 'monthly' and upper(p_currency) = 'MAD' then 1200::numeric
      when p_plan = 'monthly' and upper(p_currency) = 'EUR' then 100::numeric
      when p_plan = 'quarterly' and upper(p_currency) = 'MAD' then 2400::numeric
      when p_plan = 'quarterly' and upper(p_currency) = 'EUR' then 240::numeric
      else null
    end;
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'INVALID_TARIFF_SETTING';
  end if;
  return v_amount;
end;
$$;

-- Do not rewrite an acquired open échéance amount when student re-ensures the period.