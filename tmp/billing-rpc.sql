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
create or replace function public.ensure_student_billing_payment(
  p_billing_plan text,
  p_currency text,
  p_period text,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_payment_id uuid;
  v_due date;
  v_sub public.student_subscriptions;
  v_plan text;
  v_currency text;
  v_amount numeric;
  v_existing_amount numeric;
  v_existing_paid numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  v_student_id := public.current_student_id();
  if v_student_id is null then
    if public.is_admin() then
      raise exception 'Utilisez le formulaire admin pour créer une échéance.';
    end if;
    raise exception 'Profil étudiant introuvable. Contactez l’administration.';
  end if;

  v_sub := public.apply_pending_subscription_plan(v_student_id, p_period);

  v_plan := coalesce(nullif(p_billing_plan, ''), v_sub.billing_plan, 'monthly');
  v_currency := upper(coalesce(nullif(p_currency, ''), v_sub.billing_currency, 'MAD'));
  v_amount := coalesce(
    nullif(p_amount, 0),
    public.billing_catalog_amount(v_plan, v_currency)
  );

  if v_plan not in ('monthly', 'quarterly') then
    raise exception 'Formule invalide';
  end if;

  if v_currency not in ('MAD', 'EUR') then
    raise exception 'Devise invalide';
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'Montant attendu invalide';
  end if;

  -- Students may only create échéances for their subscription formula/currency.
  -- Amount for NEW rows always comes from catalogue (ignore browser-supplied amount).
  if not public.is_admin() then
    if v_plan is distinct from v_sub.billing_plan or v_currency is distinct from upper(v_sub.billing_currency) then
      raise exception 'La formule et la devise sont définies par votre abonnement.';
    end if;
    v_amount := public.billing_catalog_amount(v_plan, v_currency);
  end if;

  v_due := public.billing_period_due_date(p_period, v_plan);

  select id, amount, coalesce(amount_paid, 0)
  into v_payment_id, v_existing_amount, v_existing_paid
  from public.student_payments
  where student_id = v_student_id
    and billing_period = p_period
    and status in ('pending', 'partial', 'overdue')
  order by created_at desc
  limit 1;

  if v_payment_id is not null then
    -- Preserve contractual / acquired amount on open rows (do not overwrite with new catalogue).
    update public.student_payments
    set
      currency = v_currency,
      due_date = v_due,
      billing_plan = v_plan,
      billing_period = p_period,
      updated_at = now()
    where id = v_payment_id;
    return v_payment_id;
  end if;

  insert into public.student_payments (
    student_id,
    amount,
    initial_amount,
    amount_paid,
    currency,
    due_date,
    status,
    billing_plan,
    billing_period
  ) values (
    v_student_id,
    v_amount,
    v_amount,
    0,
    v_currency,
    v_due,
    'pending',
    v_plan,
    p_period
  )
  returning id into v_payment_id;

  return v_payment_id;
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
set search_path = public
as $$
declare
  v_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'MAD'));
  v_monthly numeric;
  v_quarterly numeric;
  v_current_amount numeric;
  v_y int;
  v_m int;
  v_months text[] := array[]::text[];
  i int;
  d date;
  v_student_id uuid := public.current_student_id();
  v_acquired numeric;
begin
  if p_current_month !~ '^\d{4}-\d{2}$' then
    raise exception 'INVALID_MONTH';
  end if;
  v_monthly := public.billing_catalog_amount('monthly', v_currency);
  v_quarterly := public.billing_catalog_amount('quarterly', v_currency);

  v_current_amount := v_monthly;
  if v_student_id is not null then
    select p.amount into v_acquired
    from public.student_payments p
    where p.student_id = v_student_id
      and p.billing_period = p_current_month
      and p.status in ('pending', 'partial', 'overdue', 'paid')
    order by
      case when p.status = 'paid' then 1 else 0 end,
      p.created_at desc
    limit 1;
    if v_acquired is not null and v_acquired > 0 then
      v_current_amount := v_acquired;
    end if;
  end if;

  v_y := split_part(p_current_month, '-', 1)::int;
  v_m := split_part(p_current_month, '-', 2)::int;

  if p_include_future_pack then
    for i in 1..3 loop
      d := (make_date(v_y, v_m, 1) + (i || ' month')::interval)::date;
      v_months := array_append(v_months, to_char(d, 'YYYY-MM'));
    end loop;
  end if;

  return jsonb_build_object(
    'currency', v_currency,
    'current_month', p_current_month,
    'current_amount', v_current_amount,
    'future_months', to_jsonb(v_months),
    'future_pack_amount', case when p_include_future_pack then v_quarterly else 0 end,
    'total_amount', v_current_amount + case when p_include_future_pack then v_quarterly else 0 end,
    'monthly_tariff', v_monthly,
    'quarterly_tariff', v_quarterly,
    'current_is_acquired', (v_acquired is not null and v_acquired > 0 and v_acquired is distinct from v_monthly)
  );
end;
$$;

create or replace function public.ensure_flexible_billing_payments(
  p_include_future_pack boolean default false,
  p_currency text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := public.current_student_id();
  v_currency text;
  v_current text;
  v_quote jsonb;
  v_payment_id uuid;
  v_pack_id uuid;
  v_future text[];
  v_overlap int;
  v_due date;
  v_pack_period text;
  v_amount numeric;
begin
  if v_student_id is null then
    raise exception 'NOT_A_STUDENT';
  end if;
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select upper(currency) into v_currency
  from public.student_payments
  where student_id = v_student_id
  order by created_at desc nulls last
  limit 1;

  v_currency := upper(coalesce(nullif(trim(p_currency), ''), v_currency, 'MAD'));
  if v_currency not in ('MAD', 'EUR') then
    v_currency := 'MAD';
  end if;

  v_current := to_char(date_trunc('month', now())::date, 'YYYY-MM');
  v_quote := public.quote_flexible_billing_pack(v_currency, v_current, p_include_future_pack);
  select coalesce(array_agg(x), array[]::text[])
  into v_future
  from jsonb_array_elements_text(v_quote -> 'future_months') as t(x);

  select count(*) into v_overlap
  from public.student_payments p
  where p.student_id = v_student_id
    and p.status = 'paid'
    and (
      p.billing_period = v_current
      or (p_include_future_pack and (
        p.billing_period = any (v_future)
        or (
          p.billing_period is not null
          and exists (
            select 1 from unnest(v_future) m
            where position(m in p.billing_period) > 0
          )
        )
      ))
    );

  if v_overlap > 0 then
    raise exception 'PERIOD_OVERLAP';
  end if;

  -- Server-side amount only (never trust browser total).
  v_amount := (v_quote ->> 'current_amount')::numeric;
  v_due := public.billing_period_due_date(v_current, 'monthly');
  v_payment_id := public.ensure_student_billing_payment(
    'monthly', v_currency, v_current, v_amount
  );

  if p_include_future_pack then
    v_pack_period := v_future[1] || '/' || v_future[3];
    select count(*) into v_overlap
    from public.student_payments p
    where p.student_id = v_student_id
      and p.status in ('pending', 'partial', 'overdue', 'paid')
      and (
        p.billing_period = any (v_future)
        or p.billing_period = v_pack_period
      );
    if v_overlap > 0 then
      raise exception 'PERIOD_OVERLAP';
    end if;

    v_amount := public.billing_catalog_amount('quarterly', v_currency);
    v_due := public.billing_period_due_date(v_future[3], 'monthly');
    insert into public.student_payments (
      student_id, amount, initial_amount, amount_paid, currency, due_date, status,
      billing_plan, billing_period, notes
    )
    values (
      v_student_id, v_amount, v_amount, 0, v_currency, v_due, 'pending',
      'quarterly', v_pack_period,
      'Pack 3 mois futurs au tarif trimestriel: ' || array_to_string(v_future, ', ')
    )
    returning id into v_pack_id;

    -- Refresh quote after insert so response reflects server truth.
    v_quote := public.quote_flexible_billing_pack(v_currency, v_current, true);
    -- Force pack amount in quote to catalogue (current may still be acquired).
    v_quote := v_quote || jsonb_build_object(
      'future_pack_amount', v_amount,
      'total_amount', (v_quote ->> 'current_amount')::numeric + v_amount
    );
  end if;

  return jsonb_build_object(
    'quote', v_quote,
    'current_payment_id', v_payment_id,
    'pack_payment_id', v_pack_id
  );
end;
$$;

