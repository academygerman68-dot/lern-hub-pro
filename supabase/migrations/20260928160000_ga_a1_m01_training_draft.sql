-- Draft-only curriculum shell for training module GA-A1-M01.
-- Does NOT publish. Does NOT touch A1-SIM-01 or exam attempts.
-- Interactive activities live in data/exams/a1-b1-series/modules/GA-A1-M01.json
-- (format_profile ga_training_module_v1 — never Goethe scoring).

DO $$
DECLARE
  v_level_id uuid;
  v_course_id uuid := 'a1b10001-0001-4000-8000-000000000001'::uuid;
  v_module_id uuid := 'a1b10001-0001-4000-8000-000000000011'::uuid;
  v_unit_id uuid := 'a1b10001-0001-4000-8000-000000000021'::uuid;
  v_lesson_id uuid := 'a1b10001-0001-4000-8000-000000000031'::uuid;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE code = 'A1' LIMIT 1;
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Level A1 missing';
  END IF;

  INSERT INTO public.courses (
    id, level_id, title, description, status, sort_order
  ) VALUES (
    v_course_id,
    v_level_id,
    'German Academy — Entraînement A1',
    'Modules d’entraînement progressifs A1 (hors examens blancs). Contenu original German Academy.',
    'draft',
    90
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = CASE
      WHEN public.courses.status = 'published' THEN public.courses.status
      ELSE EXCLUDED.status
    END,
    updated_at = now();

  INSERT INTO public.modules (
    id, course_id, title, description, sort_order, status
  ) VALUES (
    v_module_id,
    v_course_id,
    'GA-A1-M01 — Ankommen & Vorstellen',
    'Module pilote d’entraînement (draft). Pas un examen blanc. Pas de scoring Goethe. Code: GA-A1-M01.',
    1,
    'draft'
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = CASE
      WHEN public.modules.status = 'published' THEN public.modules.status
      ELSE EXCLUDED.status
    END,
    updated_at = now();

  INSERT INTO public.units (
    id, module_id, title, description, sort_order, status
  ) VALUES (
    v_unit_id,
    v_module_id,
    'Présentation personnelle',
    'Vocabulaire, grammaire, Lesen, Hören, Schreiben, Sprechen, révision.',
    1,
    'draft'
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = CASE
      WHEN public.units.status = 'published' THEN public.units.status
      ELSE EXCLUDED.status
    END,
    updated_at = now();

  INSERT INTO public.lessons (
    id, unit_id, title, description, content_markdown, duration_minutes, sort_order, status
  ) VALUES (
    v_lesson_id,
    v_unit_id,
    'GA-A1-M01 activités',
    'Paquet d’activités interactives — source de vérité JSON côté dépôt (non publié aux étudiants).',
    $md$
# GA-A1-M01 — Ankommen & Vorstellen

**Type :** module d’entraînement (`ga_training_module_v1`)  
**Statut :** draft  
**Pas** un examen blanc (`A1-SIM-*`) · **Pas** de scoring Goethe · **Pas** de certificat

Fichier source (staff / build) : `data/exams/a1-b1-series/modules/GA-A1-M01.json`

Audio original academy : `/exam-media/ga-a1-m01/hoeren-vorstellen.mp3`
$md$,
    30,
    1,
    'draft'
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content_markdown = EXCLUDED.content_markdown,
    duration_minutes = EXCLUDED.duration_minutes,
    status = CASE
      WHEN public.lessons.status = 'published' THEN public.lessons.status
      ELSE EXCLUDED.status
    END,
    updated_at = now();
END $$;
