-- Idempotent German Academy demo seed (schema-aligned).
-- Accounts password: Gla-2c35a11966de95

create extension if not exists pgcrypto with schema extensions;

create or replace function public._seed_auth_user(
  p_id uuid,
  p_email text,
  p_password text,
  p_first_name text,
  p_last_name text,
  p_role public.app_role,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is not null then
    update public.profiles
    set role = p_role,
        status = 'active',
        first_name = p_first_name,
        last_name = p_last_name,
        phone = coalesce(p_phone, phone),
        updated_at = now()
    where id = v_id;
  else
    v_id := coalesce(p_id, gen_random_uuid());
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id,
      'authenticated',
      'authenticated',
      lower(p_email),
      crypt(p_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'seed', 'true',
        'role', p_role::text,
        'first_name', p_first_name,
        'last_name', p_last_name,
        'language', 'fr',
        'phone', coalesce(p_phone, '')
      ),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_id,
      jsonb_build_object('sub', v_id::text, 'email', lower(p_email)),
      'email',
      v_id::text,
      now(), now(), now()
    )
    on conflict do nothing;

    update public.profiles
    set role = p_role,
        status = 'active',
        first_name = p_first_name,
        last_name = p_last_name,
        phone = coalesce(nullif(p_phone, ''), phone),
        updated_at = now()
    where id = v_id;
  end if;

  if p_role = 'teacher' then
    insert into public.teachers (profile_id, status)
    values (v_id, 'active')
    on conflict (profile_id) do update set status = 'active', archived_at = null;
  elsif p_role = 'student' then
    insert into public.students (profile_id, status)
    values (v_id, 'active')
    on conflict (profile_id) do update set status = 'active', archived_at = null;
  end if;

  return v_id;
end;
$$;

create or replace function public.seed_german_academy_prototype()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $$
declare
  v_pwd text := 'Gla-2c35a11966de95';
  v_walid uuid;
  v_nadia uuid;
  v_admin uuid;
  v_level_a1 uuid;
  v_level_b1 uuid;
  v_class_a1 uuid := 'c1000000-0000-4000-8000-0000000000a1';
  v_class_b1 uuid := 'c1000000-0000-4000-8000-0000000000b1';
  v_teacher_a1 uuid;
  v_teacher_b1 uuid;
  v_student_id uuid;
  v_profile_id uuid;
  v_conv_id uuid;
  v_session_id uuid;
  v_year int := extract(year from (now() at time zone 'Africa/Casablanca'))::int;
  v_month int := extract(month from (now() at time zone 'Africa/Casablanca'))::int;
  v_inserted_a1 int := 0;
  v_inserted_b1 int := 0;
  v_names text[][] := array[
    array['Youssef', 'Amrani'], array['Sara', 'Benali'], array['Omar', 'El Fassi'],
    array['Imane', 'Tazi'], array['Mehdi', 'Chraibi'], array['Salma', 'Alaoui'],
    array['Anas', 'Bennani'], array['Nour', 'Kadiri'], array['Hamza', 'Idrissi'],
    array['Aya', 'Mansouri'],
    array['Rania', 'Ouazzani'], array['Adam', 'Bouzid'], array['Lina', 'Slaoui'],
    array['Zakaria', 'Naciri'], array['Hiba', 'El Amrani'], array['Amine', 'Kettani'],
    array['Maryam', 'Berrada'], array['Reda', 'Lahlou'], array['Salma', 'Ziani'],
    array['Yassine', 'Fakir']
  ];
  i int;
  v_email text;
  v_phone text;
  v_day date;
  v_starts timestamptz;
  v_ends timestamptz;
  v_tz text := 'Africa/Casablanca';
  v_sched record;
  v_title text;
  v_room text;
  v_id uuid;
  v_month_end date;
begin
  v_walid := public._seed_auth_user(
    'a1000000-0000-4000-8000-0000000000a1',
    'walid@gla.academy', v_pwd, 'Walid', 'Benkirane', 'teacher', '+212612000001'
  );
  v_nadia := public._seed_auth_user(
    'b1000000-0000-4000-8000-0000000000b1',
    'nadia.seed@gla.academy', v_pwd, 'Nadia', 'El Fassi', 'teacher', '+212612000002'
  );
  -- Keep existing admin@gla.academy if present; otherwise create seed admin.
  select id into v_admin from public.profiles where email = 'admin@gla.academy' limit 1;
  if v_admin is null then
    v_admin := public._seed_auth_user(
      'd1000000-0000-4000-8000-0000000000d1',
      'admin@gla.academy', v_pwd, 'Samira', 'El Mansouri', 'admin', '+212612000000'
    );
  end if;

  select id into v_teacher_a1 from public.teachers where profile_id = v_walid;
  select id into v_teacher_b1 from public.teachers where profile_id = v_nadia;

  select id into v_level_a1 from public.levels where code = 'A1' limit 1;
  select id into v_level_b1 from public.levels where code = 'B1' limit 1;
  if v_level_a1 is null then
    insert into public.levels (code, name, sort_order) values ('A1', 'A1 — Débutant', 1)
    returning id into v_level_a1;
  end if;
  if v_level_b1 is null then
    insert into public.levels (code, name, sort_order) values ('B1', 'B1 — Intermédiaire', 3)
    returning id into v_level_b1;
  end if;

  insert into public.classes (
    id, name, level_id, teacher_id, capacity, status, schedule_label, start_date
  ) values (
    v_class_a1, 'A1', v_level_a1, v_teacher_a1, 15, 'active',
    'Lun–Ven 21:00–23:00', current_date - 30
  )
  on conflict (id) do update
  set name = excluded.name,
      level_id = excluded.level_id,
      teacher_id = excluded.teacher_id,
      schedule_label = excluded.schedule_label,
      status = 'active',
      updated_at = now();

  insert into public.classes (
    id, name, level_id, teacher_id, capacity, status, schedule_label, start_date
  ) values (
    v_class_b1, 'B1', v_level_b1, v_teacher_b1, 15, 'active',
    'Lun–Ven 21:00–23:00', current_date - 30
  )
  on conflict (id) do update
  set name = excluded.name,
      level_id = excluded.level_id,
      teacher_id = excluded.teacher_id,
      schedule_label = excluded.schedule_label,
      status = 'active',
      updated_at = now();

  for i in 1..5 loop
    insert into public.class_schedules (class_id, weekday, start_time, end_time, title_template, timezone)
    values (v_class_a1, i, '21:00', '23:00', 'Cours allemand', v_tz)
    on conflict (class_id, weekday, start_time) do update
    set end_time = excluded.end_time, title_template = excluded.title_template, timezone = excluded.timezone;

    insert into public.class_schedules (class_id, weekday, start_time, end_time, title_template, timezone)
    values (v_class_b1, i, '21:00', '23:00', 'Cours allemand', v_tz)
    on conflict (class_id, weekday, start_time) do update
    set end_time = excluded.end_time, title_template = excluded.title_template, timezone = excluded.timezone;
  end loop;

  for i in 1..20 loop
    v_email := format('etudiant%02s@gla.academy', lpad(i::text, 2, '0'));
    v_phone := '+2126' || lpad(i::text, 8, '0');
    v_profile_id := public._seed_auth_user(
      ('e1000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
      v_email, v_pwd, v_names[i][1], v_names[i][2], 'student', v_phone
    );
    update public.students set level_code = case when i <= 10 then 'A1' else 'B1' end
    where profile_id = v_profile_id;
    select id into v_student_id from public.students where profile_id = v_profile_id;

    insert into public.enrollments (student_id, class_id, status, start_date)
    values (
      v_student_id,
      case when i <= 10 then v_class_a1 else v_class_b1 end,
      'active',
      current_date - 14
    )
    on conflict do nothing;

    if not exists (
      select 1 from public.enrollments
      where student_id = v_student_id
        and class_id = case when i <= 10 then v_class_a1 else v_class_b1 end
        and status = 'active'
    ) then
      insert into public.enrollments (student_id, class_id, status, start_date)
      values (
        v_student_id,
        case when i <= 10 then v_class_a1 else v_class_b1 end,
        'active',
        current_date - 14
      );
    end if;

    if not exists (
      select 1 from public.student_subscriptions ss
      where ss.student_id = v_student_id and ss.status = 'active'
    ) then
      insert into public.student_subscriptions (student_id, status, starts_at, expires_at, notes)
      values (v_student_id, 'active', now() - interval '30 days', now() + interval '60 days', 'Seed mensuel');
    end if;
  end loop;

  v_month_end := (make_date(v_year, v_month, 1) + interval '1 month' - interval '1 day')::date;
  for v_sched in
    select * from public.class_schedules where class_id in (v_class_a1, v_class_b1)
  loop
    v_day := make_date(v_year, v_month, 1);
    while v_day <= v_month_end loop
      if extract(isodow from v_day)::int = v_sched.weekday then
        v_starts := (v_day::text || ' ' || v_sched.start_time::text)::timestamp at time zone v_tz;
        v_ends := (v_day::text || ' ' || v_sched.end_time::text)::timestamp at time zone v_tz;
        v_title := v_sched.title_template || ' · ' || (select name from public.classes where id = v_sched.class_id);
        if not exists (
          select 1 from public.live_sessions ls
          where ls.class_id = v_sched.class_id
            and ls.status <> 'cancelled'
            and ls.starts_at = v_starts
        ) then
          v_id := gen_random_uuid();
          v_room := 'german-academy-' || replace(v_id::text, '-', '');
          insert into public.live_sessions (
            id, title, class_id, teacher_id, starts_at, ends_at, status,
            meeting_provider, meeting_room, meeting_url, video_provider, created_by
          ) values (
            v_id, v_title, v_sched.class_id,
            (select teacher_id from public.classes where id = v_sched.class_id),
            v_starts, v_ends, 'scheduled', 'jitsi', v_room,
            'https://meet.jit.si/' || v_room, 'jitsi', v_admin
          );
          if v_sched.class_id = v_class_a1 then
            v_inserted_a1 := v_inserted_a1 + 1;
          else
            v_inserted_b1 := v_inserted_b1 + 1;
          end if;
        end if;
      end if;
      v_day := v_day + 1;
    end loop;
  end loop;

  update public.live_sessions
  set status = 'completed'
  where class_id in (v_class_a1, v_class_b1)
    and starts_at < now() - interval '3 hours'
    and status = 'scheduled';

  select id into v_session_id
  from public.live_sessions
  where class_id = v_class_a1 and starts_at > now()
  order by starts_at
  limit 1;

  if v_session_id is not null then
    update public.live_sessions
    set video_provider = 'zoom',
        zoom_join_url = 'https://zoom.us/j/999000111',
        zoom_start_url = 'https://zoom.us/s/999000111?zak=seed',
        zoom_url = 'https://zoom.us/j/999000111',
        zoom_meeting_id = '999000111'
    where id = v_session_id;
  end if;

  select id into v_session_id
  from public.live_sessions
  where class_id = v_class_a1 and status = 'completed'
  order by starts_at desc
  limit 1;

  if v_session_id is not null and not exists (
    select 1 from public.meeting_recordings mr where mr.live_session_id = v_session_id
  ) then
    insert into public.meeting_recordings (
      live_session_id, class_id, teacher_id, title, status, external_url, created_by
    )
    select v_session_id, v_class_a1, v_teacher_a1,
           'Rediffusion · ' || ls.title, 'ready',
           'https://www.youtube.com/watch?v=dQw4w9WgXcQ', v_walid
    from public.live_sessions ls where ls.id = v_session_id;
  end if;

  if not exists (select 1 from public.courses where level_id = v_level_a1 and title = 'Allemand A1 — Bases') then
    insert into public.courses (title, level_id, description, status)
    values ('Allemand A1 — Bases', v_level_a1, 'Alphabet, salutations, grammaire de base', 'active');
  end if;
  if not exists (select 1 from public.courses where level_id = v_level_b1 and title = 'Allemand B1 — Communication') then
    insert into public.courses (title, level_id, description, status)
    values ('Allemand B1 — Communication', v_level_b1, 'Conversation, grammaire intermédiaire', 'active');
  end if;

  if not exists (select 1 from public.library_items where title = 'Fiche vocabulaire A1') then
    insert into public.library_items (
      title, category, level_code, language, storage_bucket, storage_path,
      visibility, domain, audience, class_id, external_url, content_kind, published_at, created_by
    ) values (
      'Fiche vocabulaire A1', 'pdf', 'A1', 'de', 'library', 'seed/a1-vocab.pdf',
      'published', 'academic', 'class', v_class_a1, 'https://example.com/a1-vocab.pdf', 'link', now(), v_walid
    );
  end if;
  if not exists (select 1 from public.library_items where title = 'Audio dialogue B1') then
    insert into public.library_items (
      title, category, level_code, language, storage_bucket, storage_path,
      visibility, domain, audience, class_id, external_url, content_kind, published_at, created_by
    ) values (
      'Audio dialogue B1', 'audio', 'B1', 'de', 'library', 'seed/b1-audio.mp3',
      'published', 'academic', 'class', v_class_b1, 'https://example.com/b1-audio.mp3', 'link', now(), v_nadia
    );
  end if;

  insert into public.assignments (
    id, title, class_id, level_id, due_at, status, description, created_by, content_kind, published_at
  ) values (
    'aa000000-0000-4000-8000-0000000000a1',
    'Devoir A1 — Présentation',
    v_class_a1, v_level_a1,
    now() + interval '5 days',
    'published',
    'Écrivez un paragraphe de présentation (80–100 mots).',
    v_walid, 'document', now()
  )
  on conflict (id) do update
  set title = excluded.title, due_at = excluded.due_at, status = 'published', class_id = excluded.class_id;

  insert into public.assignments (
    id, title, class_id, level_id, due_at, status, description, created_by, content_kind, published_at
  ) values (
    'bb000000-0000-4000-8000-0000000000b1',
    'Devoir B1 — Opinion',
    v_class_b1, v_level_b1,
    now() + interval '7 days',
    'published',
    'Rédigez un texte d’opinion sur les études à l’étranger.',
    v_nadia, 'document', now()
  )
  on conflict (id) do update
  set title = excluded.title, due_at = excluded.due_at, status = 'published', class_id = excluded.class_id;

  select s.id into v_student_id
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where p.email = 'etudiant01@gla.academy';

  if v_student_id is not null then
    insert into public.assignment_submissions (assignment_id, student_id, status, submitted_at, content_text)
    values (
      'aa000000-0000-4000-8000-0000000000a1',
      v_student_id,
      'submitted',
      now() - interval '1 day',
      'Hallo, ich heiße Youssef und ich lerne Deutsch.'
    )
    on conflict (assignment_id, student_id) do nothing;
  end if;

  insert into public.attendance_sessions (id, class_id, teacher_id, session_date, created_by)
  values (
    'a5000000-0000-4000-8000-0000000000a1',
    v_class_a1, v_teacher_a1,
    (now() at time zone v_tz)::date - 1,
    v_walid
  )
  on conflict (id) do nothing;

  insert into public.attendance_records (session_id, student_id, mark)
  select 'a5000000-0000-4000-8000-0000000000a1', e.student_id, 'present'
  from public.enrollments e
  where e.class_id = v_class_a1 and e.status = 'active'
  on conflict (session_id, student_id) do nothing;

  select id into v_conv_id from public.conversations where class_id = v_class_a1 limit 1;
  if v_conv_id is null then
    insert into public.conversations (name, class_id, created_by)
    values ('Groupe A1', v_class_a1, v_admin)
    returning id into v_conv_id;
  end if;
  insert into public.conversation_members (conversation_id, profile_id, role)
  values (v_conv_id, v_walid, 'moderator'), (v_conv_id, v_admin, 'moderator')
  on conflict do nothing;
  insert into public.conversation_members (conversation_id, profile_id, role)
  select v_conv_id, s.profile_id, 'member'
  from public.enrollments e
  join public.students s on s.id = e.student_id
  where e.class_id = v_class_a1 and e.status = 'active'
  on conflict do nothing;
  if not exists (select 1 from public.messages where conversation_id = v_conv_id) then
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv_id, v_walid, 'Bienvenue dans le groupe A1 ! Le cours commence à 21h.');
  end if;

  select id into v_conv_id from public.conversations where class_id = v_class_b1 limit 1;
  if v_conv_id is null then
    insert into public.conversations (name, class_id, created_by)
    values ('Groupe B1', v_class_b1, v_admin)
    returning id into v_conv_id;
  end if;
  insert into public.conversation_members (conversation_id, profile_id, role)
  values (v_conv_id, v_nadia, 'moderator'), (v_conv_id, v_admin, 'moderator')
  on conflict do nothing;
  insert into public.conversation_members (conversation_id, profile_id, role)
  select v_conv_id, s.profile_id, 'member'
  from public.enrollments e
  join public.students s on s.id = e.student_id
  where e.class_id = v_class_b1 and e.status = 'active'
  on conflict do nothing;

  return jsonb_build_object(
    'ok', true,
    'walid', v_walid,
    'class_a1', v_class_a1,
    'class_b1', v_class_b1,
    'sessions_inserted_a1', v_inserted_a1,
    'sessions_inserted_b1', v_inserted_b1
  );
end;
$$;

revoke all on function public._seed_auth_user(uuid, text, text, text, text, public.app_role, text) from public;
revoke all on function public.seed_german_academy_prototype() from public;
