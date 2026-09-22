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