-- Independent monthly OR quarterly declaration (not cumulative pack).
-- Catalogue: monthly 1000 MAD / 100 EUR, quarterly 2400 MAD / 240 EUR.
-- Preserve historical paid amounts; only update catalogue settings + fallbacks.

insert into public.app_settings (key, value, is_public, description)
values
  ('billing_tariff_monthly_MAD', '1000'::jsonb, true, 'Tarif mensuel MAD (catalogue)'),
  ('billing_tariff_quarterly_MAD', '2400'::jsonb, true, 'Tarif trimestriel MAD (catalogue)'),
  ('billing_tariff_monthly_EUR', '100'::jsonb, true, 'Tarif mensuel EUR (catalogue)'),
  ('billing_tariff_quarterly_EUR', '240'::jsonb, true, 'Tarif trimestriel EUR (catalogue)'),
  ('billing_fx_eur_to_mad', '10'::jsonb, true, 'Taux reporting CA: 1 EUR = 10 MAD')
on conflict (key) do update
set
  value = excluded.value,
  is_public = true,
  description = excluded.description,
  updated_at = now();

-- Keep default_payment_amount aligned if present (admin settings UI).
insert into public.app_settings (key, value, is_public, description)
values ('default_payment_amount', '1000'::jsonb, true, 'Montant paiement par défaut (MAD)')
on conflict (key) do update
set value = '1000'::jsonb, updated_at = now();

create or replace function public.billing_catalog_amount(p_plan text, p_currency text)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
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

-- Expand a billing_period label into occupied calendar months (YYYY-MM).
create or replace function public.billing_period_months(p_period text)
returns text[]
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  v_start text;
  v_end text;
  v_y int;
  v_m int;
  v_ey int;
  v_em int;
  v_months text[] := array[]::text[];
  d date;
  q int;
begin
  if p_period is null or length(trim(p_period)) = 0 then
    return v_months;
  end if;

  if p_period ~ '^\d{4}-\d{2}$' then
    return array[p_period];
  end if;

  -- Rolling quarter pack: 2026-10/2026-12
  if p_period ~ '^\d{4}-\d{2}/\d{4}-\d{2}$' then
    v_start := split_part(p_period, '/', 1);
    v_end := split_part(p_period, '/', 2);
    v_y := split_part(v_start, '-', 1)::int;
    v_m := split_part(v_start, '-', 2)::int;
    v_ey := split_part(v_end, '-', 1)::int;
    v_em := split_part(v_end, '-', 2)::int;
    d := make_date(v_y, v_m, 1);
    while d <= make_date(v_ey, v_em, 1) loop
      v_months := array_append(v_months, to_char(d, 'YYYY-MM'));
      d := (d + interval '1 month')::date;
    end loop;
    return v_months;
  end if;

  -- Legacy civil quarter: 2026-Q4
  if p_period ~ '^\d{4}-Q[1-4]$' then
    v_y := split_part(p_period, '-', 1)::int;
    q := right(p_period, 1)::int;
    for i in 0..2 loop
      v_m := (q - 1) * 3 + 1 + i;
      v_months := array_append(v_months, to_char(make_date(v_y, v_m, 1), 'YYYY-MM'));
    end loop;
    return v_months;
  end if;

  return v_months;
end;
$$;

create or replace function public.billing_plan_covered_months(p_plan text, p_start_month text)
returns text[]
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  v_y int;
  v_m int;
  v_months text[] := array[]::text[];
  i int;
  d date;
begin
  if p_plan not in ('monthly', 'quarterly') then
    raise exception 'INVALID_BILLING_PLAN';
  end if;
  if p_start_month !~ '^\d{4}-\d{2}$' then
    raise exception 'INVALID_MONTH';
  end if;
  v_y := split_part(p_start_month, '-', 1)::int;
  v_m := split_part(p_start_month, '-', 2)::int;
  if p_plan = 'monthly' then
    return array[p_start_month];
  end if;
  for i in 0..2 loop
    d := (make_date(v_y, v_m, 1) + (i || ' month')::interval)::date;
    v_months := array_append(v_months, to_char(d, 'YYYY-MM'));
  end loop;
  return v_months;
end;
$$;

-- Occupied months: paid, pending, partial, overdue (reserved / submitted).
create or replace function public.student_occupied_billing_months(p_student_id uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (
      select array_agg(distinct m order by m)
      from public.student_payments p
      cross join lateral unnest(public.billing_period_months(p.billing_period)) as m
      where p.student_id = p_student_id
        and p.status in ('pending', 'partial', 'overdue', 'paid')
        and p.billing_period is not null
    ),
    array[]::text[]
  );
$$;

create or replace function public.quote_billing_declaration(
  p_plan text,
  p_currency text,
  p_start_month text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'MAD'));
  v_amount numeric;
  v_months text[];
  v_period text;
  v_student_id uuid := public.current_student_id();
  v_occupied text[];
  v_conflict text[];
  v_first_eligible text;
  v_probe text;
  v_y int;
  v_m int;
  i int;
  d date;
  v_ok boolean;
begin
  if p_plan not in ('monthly', 'quarterly') then
    raise exception 'INVALID_BILLING_PLAN';
  end if;
  if v_currency not in ('MAD', 'EUR') then
    raise exception 'INVALID_CURRENCY';
  end if;
  if p_start_month !~ '^\d{4}-\d{2}$' then
    raise exception 'INVALID_MONTH';
  end if;

  v_amount := public.billing_catalog_amount(p_plan, v_currency);
  v_months := public.billing_plan_covered_months(p_plan, p_start_month);
  if p_plan = 'monthly' then
    v_period := p_start_month;
  else
    v_period := v_months[1] || '/' || v_months[3];
  end if;

  v_occupied := case
    when v_student_id is null then array[]::text[]
    else public.student_occupied_billing_months(v_student_id)
  end;

  select coalesce(array_agg(x order by x), array[]::text[])
  into v_conflict
  from unnest(v_months) as x
  where x = any (v_occupied);

  -- First eligible start from requested month onward (up to 18 months).
  v_first_eligible := null;
  v_y := split_part(p_start_month, '-', 1)::int;
  v_m := split_part(p_start_month, '-', 2)::int;
  for i in 0..17 loop
    d := (make_date(v_y, v_m, 1) + (i || ' month')::interval)::date;
    v_probe := to_char(d, 'YYYY-MM');
    select not exists (
      select 1
      from unnest(public.billing_plan_covered_months(p_plan, v_probe)) cm
      where cm = any (v_occupied)
    ) into v_ok;
    if v_ok then
      v_first_eligible := v_probe;
      exit;
    end if;
  end loop;

  return jsonb_build_object(
    'plan', p_plan,
    'currency', v_currency,
    'start_month', p_start_month,
    'covered_months', to_jsonb(v_months),
    'billing_period', v_period,
    'expected_amount', v_amount,
    'monthly_tariff', public.billing_catalog_amount('monthly', v_currency),
    'quarterly_tariff', public.billing_catalog_amount('quarterly', v_currency),
    'available', coalesce(array_length(v_conflict, 1), 0) = 0,
    'conflict_months', to_jsonb(v_conflict),
    'first_eligible_start', v_first_eligible,
    'occupied_months', to_jsonb(v_occupied)
  );
end;
$$;

create or replace function public.ensure_billing_declaration(
  p_plan text,
  p_start_month text,
  p_currency text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_student_id uuid := public.current_student_id();
  v_currency text;
  v_quote jsonb;
  v_payment_id uuid;
  v_amount numeric;
  v_period text;
  v_due date;
  v_months text[];
  v_end text;
begin
  if v_student_id is null then raise exception 'NOT_A_STUDENT'; end if;
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if p_plan not in ('monthly', 'quarterly') then raise exception 'INVALID_BILLING_PLAN'; end if;

  select upper(currency) into v_currency
  from public.student_payments
  where student_id = v_student_id
  order by created_at desc nulls last
  limit 1;

  v_currency := upper(coalesce(nullif(trim(p_currency), ''), v_currency, 'MAD'));
  if v_currency not in ('MAD', 'EUR') then v_currency := 'MAD'; end if;

  v_quote := public.quote_billing_declaration(p_plan, v_currency, p_start_month);
  if not coalesce((v_quote ->> 'available')::boolean, false) then
    raise exception 'PERIOD_OVERLAP: mois indisponibles % — premier éligible %',
      v_quote -> 'conflict_months',
      v_quote ->> 'first_eligible_start';
  end if;

  v_amount := (v_quote ->> 'expected_amount')::numeric;
  v_period := v_quote ->> 'billing_period';
  select coalesce(array_agg(x), array[]::text[]) into v_months
  from jsonb_array_elements_text(v_quote -> 'covered_months') as t(x);
  v_end := v_months[array_length(v_months, 1)];
  v_due := public.billing_period_due_date(v_end, 'monthly');

  -- Reuse open payment for exact same period+plan if already pending.
  select p.id into v_payment_id
  from public.student_payments p
  where p.student_id = v_student_id
    and p.billing_plan = p_plan
    and p.billing_period = v_period
    and p.status in ('pending', 'partial', 'overdue')
  order by p.created_at desc
  limit 1;

  if v_payment_id is null then
    insert into public.student_payments (
      student_id, amount, initial_amount, amount_paid, currency, due_date, status,
      billing_plan, billing_period, notes
    ) values (
      v_student_id, v_amount, v_amount, 0, v_currency, v_due, 'pending',
      p_plan, v_period,
      case
        when p_plan = 'quarterly' then
          'Trimestriel: ' || array_to_string(v_months, ', ')
        else
          'Mensuel: ' || p_start_month
      end
    )
    returning id into v_payment_id;
  else
    update public.student_payments
    set
      amount = v_amount,
      initial_amount = coalesce(initial_amount, v_amount),
      currency = v_currency,
      due_date = v_due,
      notes = case
        when p_plan = 'quarterly' then 'Trimestriel: ' || array_to_string(v_months, ', ')
        else 'Mensuel: ' || p_start_month
      end,
      updated_at = now()
    where id = v_payment_id
      and status in ('pending', 'partial', 'overdue');
  end if;

  return jsonb_build_object(
    'quote', v_quote,
    'payment_id', v_payment_id
  );
end;
$$;

-- Keep legacy flexible RPC but redirect to monthly-only (no cumulative pack).
create or replace function public.ensure_flexible_billing_payments(
  p_include_future_pack boolean default false,
  p_currency text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_current text := to_char(date_trunc('month', now())::date, 'YYYY-MM');
  v_result jsonb;
begin
  -- Cumulative pack is retired; always create a single monthly declaration for current month.
  -- Callers must migrate to ensure_billing_declaration(plan, start_month).
  if p_include_future_pack then
    raise exception 'PACK_DEPRECATED: utilisez ensure_billing_declaration avec plan quarterly';
  end if;
  v_result := public.ensure_billing_declaration('monthly', v_current, p_currency);
  return jsonb_build_object(
    'quote', v_result -> 'quote',
    'current_payment_id', v_result -> 'payment_id',
    'pack_payment_id', null
  );
end;
$$;

create or replace function public.quote_flexible_billing_pack(
  p_currency text,
  p_current_month text,
  p_include_future_pack boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_quote jsonb;
begin
  -- Compatibility shim: map old API to monthly-only quote (ignore pack flag for amount).
  v_quote := public.quote_billing_declaration(
    'monthly',
    p_currency,
    p_current_month
  );
  return jsonb_build_object(
    'currency', v_quote ->> 'currency',
    'current_month', p_current_month,
    'current_amount', (v_quote ->> 'expected_amount')::numeric,
    'future_months', '[]'::jsonb,
    'future_pack_amount', 0,
    'total_amount', (v_quote ->> 'expected_amount')::numeric,
    'monthly_tariff', (v_quote ->> 'monthly_tariff')::numeric,
    'quarterly_tariff', (v_quote ->> 'quarterly_tariff')::numeric,
    'current_is_acquired', false,
    'deprecated', true
  );
end;
$$;

revoke all on function public.billing_period_months(text) from public;
grant execute on function public.billing_period_months(text) to authenticated;

revoke all on function public.billing_plan_covered_months(text, text) from public;
grant execute on function public.billing_plan_covered_months(text, text) to authenticated;

revoke all on function public.student_occupied_billing_months(uuid) from public;
grant execute on function public.student_occupied_billing_months(uuid) to authenticated;

revoke all on function public.quote_billing_declaration(text, text, text) from public;
grant execute on function public.quote_billing_declaration(text, text, text) to authenticated;

revoke all on function public.ensure_billing_declaration(text, text, text) from public;
grant execute on function public.ensure_billing_declaration(text, text, text) to authenticated;
