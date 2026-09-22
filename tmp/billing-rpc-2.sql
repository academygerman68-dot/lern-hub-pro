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