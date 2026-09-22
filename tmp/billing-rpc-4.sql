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