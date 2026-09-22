-- Part 2: subtype catalogue (after announcements enum is committed).

insert into public.library_subtypes (domain, code, label_fr, sort_order, active) values
  ('academic', 'cours', 'Cours', 10, true),
  ('academic', 'exercices', 'Exercices', 20, true),
  ('academic', 'fiches', 'Fiches', 30, true),
  ('academic', 'vocabulaire', 'Vocabulaire', 40, true),
  ('academic', 'prep_examens', 'Préparation aux examens', 50, true)
on conflict (domain, code) do update
  set label_fr = excluded.label_fr,
      sort_order = excluded.sort_order,
      active = true;

-- Legacy academic annonce kept for historical resources; deactivated in favour of announcements domain
update public.library_subtypes
set active = false
where domain = 'academic' and code = 'annonce';

insert into public.library_subtypes (domain, code, label_fr, sort_order, active) values
  ('professional', 'visa', 'Visa', 10, true),
  ('professional', 'rendez_vous', 'Rendez-vous', 20, true),
  ('professional', 'demarches', 'Procédures administratives', 30, true),
  ('professional', 'documents', 'Documents requis', 40, true),
  ('professional', 'logement', 'Logement', 50, true),
  ('professional', 'autre', 'Autres démarches', 90, true)
on conflict (domain, code) do update
  set label_fr = excluded.label_fr,
      sort_order = excluded.sort_order,
      active = true;

insert into public.library_subtypes (domain, code, label_fr, sort_order, active) values
  ('announcements', 'annonces', 'Annonces', 10, true),
  ('announcements', 'evenements', 'Événements', 20, true),
  ('announcements', 'infos', 'Informations importantes', 30, true)
on conflict (domain, code) do update
  set label_fr = excluded.label_fr,
      sort_order = excluded.sort_order,
      active = true;
