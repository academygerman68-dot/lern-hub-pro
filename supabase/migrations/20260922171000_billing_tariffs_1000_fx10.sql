-- Correct catalogue tariffs per direction:
-- monthly 1000 MAD / 100 EUR ; quarterly 2400 MAD / 240 EUR.
-- Reporting FX: 1 EUR = 10 MAD (fixed).

insert into public.app_settings (key, value, is_public, description)
values
  ('billing_tariff_monthly_MAD', '1000'::jsonb, true, 'Tarif mensuel MAD (catalogue)'),
  ('billing_tariff_quarterly_MAD', '2400'::jsonb, true, 'Tarif trimestriel MAD (catalogue)'),
  ('billing_tariff_monthly_EUR', '100'::jsonb, true, 'Tarif mensuel EUR (catalogue)'),
  ('billing_tariff_quarterly_EUR', '240'::jsonb, true, 'Tarif trimestriel EUR (catalogue)'),
  ('billing_fx_eur_to_mad', '10'::jsonb, true, 'Taux fixe reporting CA : 1 EUR = 10 MAD')
on conflict (key) do update
set
  value = excluded.value,
  is_public = true,
  description = excluded.description,
  updated_at = now();

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
      when p_plan = 'monthly' and upper(p_currency) = 'MAD' then 1000::numeric
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

create or replace function public.billing_amount_to_mad(p_amount numeric, p_currency text)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fx numeric;
  v_raw jsonb;
begin
  if p_amount is null then
    return 0;
  end if;
  if upper(coalesce(p_currency, 'MAD')) = 'MAD' then
    return p_amount;
  end if;
  if upper(p_currency) <> 'EUR' then
    return p_amount;
  end if;

  select s.value into v_raw from public.app_settings s where s.key = 'billing_fx_eur_to_mad';
  if v_raw is not null and jsonb_typeof(v_raw) = 'number' then
    v_fx := (v_raw #>> '{}')::numeric;
  elsif v_raw is not null and jsonb_typeof(v_raw) = 'string' then
    begin
      v_fx := trim(both '"' from v_raw::text)::numeric;
    exception when others then
      v_fx := 10;
    end;
  else
    v_fx := 10;
  end if;

  if v_fx is null or v_fx <= 0 then
    v_fx := 10;
  end if;
  return round(p_amount * v_fx, 2);
end;
$$;

revoke all on function public.billing_amount_to_mad(numeric, text) from public;
grant execute on function public.billing_amount_to_mad(numeric, text) to authenticated;
