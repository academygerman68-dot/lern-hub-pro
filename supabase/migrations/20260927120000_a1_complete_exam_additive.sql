-- A1 additive seed only (no global RPC / RLS changes).
-- Generated from data/exams/a1-complete/a1-sim-01.json
-- Requires companion migration for Goethe scoring + teacher-scope RLS.

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS format_profile text,
  ADD COLUMN IF NOT EXISTS written_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS speaking_duration_minutes integer;

COMMENT ON COLUMN public.exams.format_profile IS
  'Scoring/UX profile, e.g. goethe_a1_adult_v1 for A1-SIM complete exams.';
COMMENT ON COLUMN public.exams.written_duration_minutes IS
  'Written clock (Hören+Lesen+Schreiben). Oral is separate/async.';
COMMENT ON COLUMN public.exams.speaking_duration_minutes IS
  'Indicative oral duration for solo recorded Sprechen.';

DO $$
DECLARE
  v_level_id uuid;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE code = 'A1' LIMIT 1;
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Level A1 missing';
  END IF;
  -- A1-SIM-01
  INSERT INTO public.exams (
    id, code, title, description, instructions, level_id, duration_minutes, pass_percentage, status, published_at, max_attempts, is_mock, format_profile, written_duration_minutes, speaking_duration_minutes
  ) VALUES (
    '811f4e04-864d-46b4-8c61-c2d319003efc'::uuid,
    'A1-SIM-01',
    'Examen blanc A1 complet — Alltag',
    'Simulation indépendante A1 adultes — non affiliée au Goethe-Institut',
    'Simulation indépendante A1 adultes — non affiliée au Goethe-Institut · Écrit 65 min · Oral enregistré 15 min · 60 points bruts (/100 via ×1,66)',
    v_level_id,
    65,
    60,
    'published',
    now(),
    3,
    true,
    'goethe_a1_adult_v1',
    65,
    15
  )
  ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    instructions = EXCLUDED.instructions,
    level_id = EXCLUDED.level_id,
    duration_minutes = EXCLUDED.duration_minutes,
    format_profile = EXCLUDED.format_profile,
    written_duration_minutes = EXCLUDED.written_duration_minutes,
    speaking_duration_minutes = EXCLUDED.speaking_duration_minutes,
    status = 'published',
    published_at = coalesce(public.exams.published_at, now()),
    is_mock = true,
    updated_at = now();
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, '811f4e04-864d-46b4-8c61-c2d319003efc'::uuid, 'hoeren', 'Hören', 1, 15)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('f12e31cc-cdfd-4124-879a-92758c065454'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Was kostet der Pullover?', 1, 1, '{"bank_question_id":"A1-SIM-01-H01","part":1,"instruction":"Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-1.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":2}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('b9861669-730c-4b71-8eed-45c0cfde1cfd'::uuid, 'f12e31cc-cdfd-4124-879a-92758c065454'::uuid, '25 Euro', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('28907a38-03a5-4d4f-8668-cb140fc87174'::uuid, 'f12e31cc-cdfd-4124-879a-92758c065454'::uuid, '35 Euro', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('469fc386-29cf-4bd6-8418-338a98ef441c'::uuid, 'f12e31cc-cdfd-4124-879a-92758c065454'::uuid, '45 Euro', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('f12e31cc-cdfd-4124-879a-92758c065454'::uuid, ARRAY['B']::text[], 'Der Pullover kostet 35 Euro.', '{"audio_script":"Frau: Entschuldigung, was kostet dieser Pullover?; Mann: Er kostet fünfunddreißig Euro. Heute ist er zehn Euro billiger."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('42cfa8cd-05c3-4354-8b81-96160a9feb2c'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Wann fährt der Zug?', 1, 2, '{"bank_question_id":"A1-SIM-01-H02","part":1,"instruction":"Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-1.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":2}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('9234527e-822b-4138-8834-2839483d5a6e'::uuid, '42cfa8cd-05c3-4354-8b81-96160a9feb2c'::uuid, 'um 9.10 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('b1ceb2b7-2622-4c95-800d-0acd9b6d213b'::uuid, '42cfa8cd-05c3-4354-8b81-96160a9feb2c'::uuid, 'um 9.20 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6f34cc9c-49b7-4706-8ed3-74347d975921'::uuid, '42cfa8cd-05c3-4354-8b81-96160a9feb2c'::uuid, 'um 9.30 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('42cfa8cd-05c3-4354-8b81-96160a9feb2c'::uuid, ARRAY['C']::text[], 'Der Zug fährt um 9.30 Uhr.', '{"audio_script":"Mann: Fährt der Zug nach Köln um neun Uhr zehn?; Frau: Nein, heute hat er zwanzig Minuten Verspätung. Er fährt um neun Uhr dreißig."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('86954b44-00a7-4a07-8671-5dc19d8bece2'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Was bestellt die Frau?', 1, 3, '{"bank_question_id":"A1-SIM-01-H03","part":1,"instruction":"Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-1.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":2}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('265f5819-ac08-40c6-8e6e-c634d33431a3'::uuid, '86954b44-00a7-4a07-8671-5dc19d8bece2'::uuid, 'Suppe', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('530cb42f-76cb-4db7-8e83-b51b16419b5d'::uuid, '86954b44-00a7-4a07-8671-5dc19d8bece2'::uuid, 'Salat', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('72a76fb7-511d-4e9c-8252-1abffcd06a9a'::uuid, '86954b44-00a7-4a07-8671-5dc19d8bece2'::uuid, 'Fisch', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('86954b44-00a7-4a07-8671-5dc19d8bece2'::uuid, ARRAY['B']::text[], 'Die Frau bestellt einen Salat.', '{"audio_script":"Mann: Möchten Sie die Suppe oder den Fisch?; Frau: Nein danke. Ich nehme nur einen Salat."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('7f25be8c-110b-4ab0-85a9-d2443b586718'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Wo treffen sie sich?', 1, 4, '{"bank_question_id":"A1-SIM-01-H04","part":1,"instruction":"Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-1.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":2}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('fba1e8c3-53a5-43b6-883a-5c63fb89f5ad'::uuid, '7f25be8c-110b-4ab0-85a9-d2443b586718'::uuid, 'vor dem Kino', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('86dea50f-c7dd-4edd-80f5-ab06c328db45'::uuid, '7f25be8c-110b-4ab0-85a9-d2443b586718'::uuid, 'im Café', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('8346b42d-5ab4-4f28-8c49-1944807caf51'::uuid, '7f25be8c-110b-4ab0-85a9-d2443b586718'::uuid, 'am Bahnhof', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('7f25be8c-110b-4ab0-85a9-d2443b586718'::uuid, ARRAY['A']::text[], 'Sie treffen sich vor dem Kino.', '{"audio_script":"Frau: Treffen wir uns im Café?; Mann: Das ist heute geschlossen. Warte bitte um Viertel vor acht vor dem Kino."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('246e48eb-0100-4b39-81ff-131ecee5df0f'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Wie kommt die Frau zur Arbeit?', 1, 5, '{"bank_question_id":"A1-SIM-01-H05","part":1,"instruction":"Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-1.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":2}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7060bea6-fd6f-4c1b-8123-9e7cdefd6315'::uuid, '246e48eb-0100-4b39-81ff-131ecee5df0f'::uuid, 'mit dem Bus', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('425976ee-fec6-4564-869a-c21c4d0e4714'::uuid, '246e48eb-0100-4b39-81ff-131ecee5df0f'::uuid, 'mit dem Fahrrad', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('555639e7-996d-4f26-87c4-ce82f87bf1e1'::uuid, '246e48eb-0100-4b39-81ff-131ecee5df0f'::uuid, 'mit dem Auto', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('246e48eb-0100-4b39-81ff-131ecee5df0f'::uuid, ARRAY['B']::text[], 'Meistens fährt sie mit dem Fahrrad.', '{"audio_script":"Mann: Fährst du morgens mit dem Bus zur Arbeit?; Frau: Nein, meistens fahre ich mit dem Fahrrad. Nur bei Regen nehme ich das Auto."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('076fb1e4-9189-4263-8748-d53e8e6c6b35'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Welche Zimmernummer hat Herr Yilmaz?', 1, 6, '{"bank_question_id":"A1-SIM-01-H06","part":1,"instruction":"Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-1.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":2}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('00fdddee-f387-4dd6-8a31-42695319dfc2'::uuid, '076fb1e4-9189-4263-8748-d53e8e6c6b35'::uuid, '214', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7e18c0fd-5e4c-4ac1-85ad-5322a32c32e4'::uuid, '076fb1e4-9189-4263-8748-d53e8e6c6b35'::uuid, '240', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0a74bb50-9508-486d-818d-4a4fe512e8f5'::uuid, '076fb1e4-9189-4263-8748-d53e8e6c6b35'::uuid, '241', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('076fb1e4-9189-4263-8748-d53e8e6c6b35'::uuid, ARRAY['C']::text[], 'Herr Yilmaz ist in Zimmer 241.', '{"audio_script":"Frau: Herr Yilmaz liegt in Zimmer zweihunderteinundvierzig. Das ist im zweiten Stock.; Mann: Danke, Zimmer zweihunderteinundvierzig."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('e78bd318-b02e-4c32-8cd4-0d0f48552b5f'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Der Bus nach Zentrum fährt heute von Haltestelle C.', 1, 7, '{"bank_question_id":"A1-SIM-01-H07","part":2,"instruction":"Kreuzen Sie an: Richtig oder Falsch. Sie hören jeden Text einmal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-2.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":1}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('e727b5fa-792a-476a-8cd7-c7f31c5a6381'::uuid, 'e78bd318-b02e-4c32-8cd4-0d0f48552b5f'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('755af223-5c58-41b8-8f97-af1a1330c2aa'::uuid, 'e78bd318-b02e-4c32-8cd4-0d0f48552b5f'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('e78bd318-b02e-4c32-8cd4-0d0f48552b5f'::uuid, ARRAY['Richtig']::text[], 'Die Ansage nennt Haltestelle C.', '{"audio_script":"Ansage: Achtung, Fahrgäste der Linie zwölf Richtung Zentrum. Ihr Bus fährt heute nicht von Haltestelle A, sondern von Haltestelle C."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('2a103fc5-ba34-4ea4-8aef-2158e961831e'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Das Kaufhaus schließt heute um 20 Uhr.', 1, 8, '{"bank_question_id":"A1-SIM-01-H08","part":2,"instruction":"Kreuzen Sie an: Richtig oder Falsch. Sie hören jeden Text einmal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-2.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":1}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('992c8ee5-3b40-441e-8403-8d671b0e3ab5'::uuid, '2a103fc5-ba34-4ea4-8aef-2158e961831e'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6defbc1c-41f5-400b-8959-6ac20efc6ef7'::uuid, '2a103fc5-ba34-4ea4-8aef-2158e961831e'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('2a103fc5-ba34-4ea4-8aef-2158e961831e'::uuid, ARRAY['Falsch']::text[], 'Das Kaufhaus schließt um 19 Uhr.', '{"audio_script":"Ansage: Liebe Kundinnen und Kunden. Unser Kaufhaus schließt heute ausnahmsweise schon um neunzehn Uhr. Bitte gehen Sie jetzt zur Kasse."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('5551b341-a7fc-4827-8c13-0f4052c53ff4'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Frau Sommer soll zur Information kommen.', 1, 9, '{"bank_question_id":"A1-SIM-01-H09","part":2,"instruction":"Kreuzen Sie an: Richtig oder Falsch. Sie hören jeden Text einmal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-2.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":1}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3945bf4b-098c-4022-8a0e-fbbf8ebedd5b'::uuid, '5551b341-a7fc-4827-8c13-0f4052c53ff4'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('cf5820ea-20be-4f1f-8068-c45e9b5b1dc6'::uuid, '5551b341-a7fc-4827-8c13-0f4052c53ff4'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('5551b341-a7fc-4827-8c13-0f4052c53ff4'::uuid, ARRAY['Richtig']::text[], 'Frau Sommer wird zur Information gerufen.', '{"audio_script":"Ansage: Frau Eva Sommer wird an der Information im Erdgeschoss erwartet. Frau Sommer, bitte kommen Sie zur Information."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('cdb142af-f8f9-49ef-86a1-15fc068475a7'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Der Flug nach Wien startet pünktlich.', 1, 10, '{"bank_question_id":"A1-SIM-01-H10","part":2,"instruction":"Kreuzen Sie an: Richtig oder Falsch. Sie hören jeden Text einmal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-2.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":1}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('99729d36-4d4e-4de6-8206-84b8e5c92b3d'::uuid, 'cdb142af-f8f9-49ef-86a1-15fc068475a7'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('e818aa1a-e415-431b-8357-3ef0207fae9e'::uuid, 'cdb142af-f8f9-49ef-86a1-15fc068475a7'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('cdb142af-f8f9-49ef-86a1-15fc068475a7'::uuid, ARRAY['Falsch']::text[], 'Der Flug startet später.', '{"audio_script":"Ansage: Der Flug fünfhundertachtzehn nach Wien startet heute vierzig Minuten später. Neuer Abflug ist um sechzehn Uhr zehn."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('faa65faa-8d82-4106-8336-ff1c82edb428'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Wann soll Lara anrufen?', 1, 11, '{"bank_question_id":"A1-SIM-01-H11","part":3,"instruction":"Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-3.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":2}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('902bf46e-d10a-4e69-8834-8d43f3620c74'::uuid, 'faa65faa-8d82-4106-8336-ff1c82edb428'::uuid, 'vor 12 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('774483ab-76ea-485f-8390-d65f81faccf7'::uuid, 'faa65faa-8d82-4106-8336-ff1c82edb428'::uuid, 'zwischen 12 und 14 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('f20b58de-82d7-4bd2-8661-b3e16d899245'::uuid, 'faa65faa-8d82-4106-8336-ff1c82edb428'::uuid, 'nach 18 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('faa65faa-8d82-4106-8336-ff1c82edb428'::uuid, ARRAY['B']::text[], 'Lara soll zwischen 12 und 14 Uhr anrufen.', '{"audio_script":"Ansage: Hallo Lara, hier ist Nina. Ruf mich bitte in der Mittagspause an, am besten zwischen zwölf und zwei. Am Abend bin ich nicht zu Hause."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('f8656710-da5e-493f-8928-5929077a0e9d'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Was soll Tom mitbringen?', 1, 12, '{"bank_question_id":"A1-SIM-01-H12","part":3,"instruction":"Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-3.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":2}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('8a8fef0d-f014-4ee8-8c54-94ecf24837c4'::uuid, 'f8656710-da5e-493f-8928-5929077a0e9d'::uuid, 'Brot', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('07911eb5-777a-43fc-8031-0e32340c2812'::uuid, 'f8656710-da5e-493f-8928-5929077a0e9d'::uuid, 'Saft', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a2e25af5-9226-4b7a-8e57-6a68c8028e4a'::uuid, 'f8656710-da5e-493f-8928-5929077a0e9d'::uuid, 'Kuchen', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('f8656710-da5e-493f-8928-5929077a0e9d'::uuid, ARRAY['A']::text[], 'Tom soll Brot mitbringen.', '{"audio_script":"Ansage: Hallo Tom. Für das Picknick haben wir schon Saft und Kuchen. Kannst du bitte Brot mitbringen? Danke."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('ba5e5923-5f3e-4710-87dd-ab2cd07d3615'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Warum kommt Frau Berg später?', 1, 13, '{"bank_question_id":"A1-SIM-01-H13","part":3,"instruction":"Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-3.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":2}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('130a02bb-1430-43b6-81c8-a92f5762eb0c'::uuid, 'ba5e5923-5f3e-4710-87dd-ab2cd07d3615'::uuid, 'Sie arbeitet länger.', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c1fb9234-7bef-4f5c-8e11-beb5ca8acf81'::uuid, 'ba5e5923-5f3e-4710-87dd-ab2cd07d3615'::uuid, 'Ihr Bus kommt nicht.', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0a7cde21-409c-4bb6-8818-03dba95203b3'::uuid, 'ba5e5923-5f3e-4710-87dd-ab2cd07d3615'::uuid, 'Sie ist beim Arzt.', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('ba5e5923-5f3e-4710-87dd-ab2cd07d3615'::uuid, ARRAY['C']::text[], 'Frau Berg hat einen Arzttermin.', '{"audio_script":"Ansage: Guten Tag, hier Berg. Ich komme heute eine halbe Stunde später ins Büro. Ich habe um acht Uhr noch einen Termin beim Arzt."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('72413e08-7514-4b2d-8ce3-9b1a87d76b22'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Wo liegt das Paket?', 1, 14, '{"bank_question_id":"A1-SIM-01-H14","part":3,"instruction":"Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-3.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":2}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a694ea22-c95e-4f62-88b1-d58b796174ab'::uuid, '72413e08-7514-4b2d-8ce3-9b1a87d76b22'::uuid, 'bei der Nachbarin', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('54aa87a5-977b-4313-8661-11709c6e2d5c'::uuid, '72413e08-7514-4b2d-8ce3-9b1a87d76b22'::uuid, 'vor der Tür', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('74ee775a-eea6-4df5-8c91-0c9af5a547a7'::uuid, '72413e08-7514-4b2d-8ce3-9b1a87d76b22'::uuid, 'in der Postfiliale', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('72413e08-7514-4b2d-8ce3-9b1a87d76b22'::uuid, ARRAY['A']::text[], 'Das Paket ist bei Frau Winter.', '{"audio_script":"Ansage: Guten Tag, Paketdienst. Sie waren nicht zu Hause. Ihr Paket ist bei Ihrer Nachbarin Frau Winter, Wohnung zwölf."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('87869687-a6b8-43e5-8833-2f282a20886d'::uuid, '1a267aca-cb9a-49eb-8fa5-55816d779c0c'::uuid, 'listening', 'Wann beginnt der Deutschkurs?', 1, 15, '{"bank_question_id":"A1-SIM-01-H15","part":3,"instruction":"Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.","passage":null,"audio_url":"/exam-media/a1-sim-01/hoeren-teil-3.mp3","recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":2}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('d3281db1-bee3-4e11-8d37-4a8786d2bc00'::uuid, '87869687-a6b8-43e5-8833-2f282a20886d'::uuid, 'am Montag', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('9686ff23-d36d-4247-85bb-3eadd5ac534b'::uuid, '87869687-a6b8-43e5-8833-2f282a20886d'::uuid, 'am Mittwoch', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0945da1a-e7a0-4ca4-8118-6cf8f5e4da4a'::uuid, '87869687-a6b8-43e5-8833-2f282a20886d'::uuid, 'am Freitag', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('87869687-a6b8-43e5-8833-2f282a20886d'::uuid, ARRAY['B']::text[], 'Der Kurs beginnt am Mittwoch.', '{"audio_script":"Ansage: Guten Tag, Sprachschule Aktiv. Ihr Deutschkurs beginnt nicht am Montag, sondern am Mittwoch, dem dritten September, um neun Uhr."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, '811f4e04-864d-46b4-8c61-c2d319003efc'::uuid, 'lesen', 'Lesen', 2, 15)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('61d2a5f7-cda1-4017-8138-e52fc80dd8e1'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'true_false', 'Mila bleibt drei Tage in Bonn.', 1, 1, '{"bank_question_id":"A1-SIM-01-L01","part":1,"instruction":"Lesen Sie die Texte und die Aufgaben 1 bis 5. Kreuzen Sie an: Richtig oder Falsch.","passage":"Liebe Sofia,\nich bin von Freitag bis Sonntag in Bonn. Am Freitag muss ich bis 17 Uhr arbeiten. Hast du am Samstag Zeit? Wir können uns um 11 Uhr vor dem Stadtmuseum treffen und danach zusammen essen.\nViele Grüße\nMila","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7445ee37-eb6f-42e5-83d3-e9280f1d1a55'::uuid, '61d2a5f7-cda1-4017-8138-e52fc80dd8e1'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0dbc27bc-a3ec-4618-8916-61908e64485d'::uuid, '61d2a5f7-cda1-4017-8138-e52fc80dd8e1'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('61d2a5f7-cda1-4017-8138-e52fc80dd8e1'::uuid, ARRAY['Richtig']::text[], 'Mila ist von Freitag bis Sonntag in Bonn.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('681ff56e-de07-47c3-849e-a24e87999745'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'true_false', 'Mila und Sofia treffen sich am Freitagabend.', 1, 2, '{"bank_question_id":"A1-SIM-01-L02","part":1,"instruction":null,"passage":"Liebe Sofia,\nich bin von Freitag bis Sonntag in Bonn. Am Freitag muss ich bis 17 Uhr arbeiten. Hast du am Samstag Zeit? Wir können uns um 11 Uhr vor dem Stadtmuseum treffen und danach zusammen essen.\nViele Grüße\nMila","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('cb627d09-2888-4a88-8d45-8fd62f8b303e'::uuid, '681ff56e-de07-47c3-849e-a24e87999745'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('8938a335-2996-4a47-8a9a-dc88aafd9b72'::uuid, '681ff56e-de07-47c3-849e-a24e87999745'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('681ff56e-de07-47c3-849e-a24e87999745'::uuid, ARRAY['Falsch']::text[], 'Das Treffen ist für Samstag um 11 Uhr geplant.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('fcdf8436-f403-453c-8085-014d84fdb86e'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'true_false', 'Der Bus wartet vor der Sporthalle.', 1, 3, '{"bank_question_id":"A1-SIM-01-L03","part":1,"instruction":null,"passage":"Hallo zusammen,\nunser Ausflug ist am 14. Juni. Der Bus fährt um 8.30 Uhr vor der Sporthalle ab. Bitte bringt etwas zu trinken mit. Das Mittagessen im Restaurant kostet 12 Euro. Kinder bezahlen 7 Euro.\nEuer Sportverein","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0d4ab13c-8a7c-4420-8438-006ce3f93895'::uuid, 'fcdf8436-f403-453c-8085-014d84fdb86e'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('4e9b5a0e-7e67-4391-8e53-bcd80e5ea186'::uuid, 'fcdf8436-f403-453c-8085-014d84fdb86e'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('fcdf8436-f403-453c-8085-014d84fdb86e'::uuid, ARRAY['Richtig']::text[], 'Der Bus fährt vor der Sporthalle ab.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('a8cd0bfe-183e-4f00-8332-f2a6cb50c54a'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'true_false', 'Die Teilnehmer sollen Getränke mitbringen.', 1, 4, '{"bank_question_id":"A1-SIM-01-L04","part":1,"instruction":null,"passage":"Hallo zusammen,\nunser Ausflug ist am 14. Juni. Der Bus fährt um 8.30 Uhr vor der Sporthalle ab. Bitte bringt etwas zu trinken mit. Das Mittagessen im Restaurant kostet 12 Euro. Kinder bezahlen 7 Euro.\nEuer Sportverein","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('dc5cb262-74cb-4f66-8fef-495ae861f815'::uuid, 'a8cd0bfe-183e-4f00-8332-f2a6cb50c54a'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('30db160b-915b-4243-89bf-ecb1045d4e4f'::uuid, 'a8cd0bfe-183e-4f00-8332-f2a6cb50c54a'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('a8cd0bfe-183e-4f00-8332-f2a6cb50c54a'::uuid, ARRAY['Richtig']::text[], 'Im Text steht: Bitte bringt etwas zu trinken mit.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('ceef5676-836c-48d7-81d6-21ab26bc2608'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'true_false', 'Alle bezahlen 12 Euro für das Mittagessen.', 1, 5, '{"bank_question_id":"A1-SIM-01-L05","part":1,"instruction":null,"passage":"Hallo zusammen,\nunser Ausflug ist am 14. Juni. Der Bus fährt um 8.30 Uhr vor der Sporthalle ab. Bitte bringt etwas zu trinken mit. Das Mittagessen im Restaurant kostet 12 Euro. Kinder bezahlen 7 Euro.\nEuer Sportverein","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5156ac62-2795-4542-858a-3d540ed98ade'::uuid, 'ceef5676-836c-48d7-81d6-21ab26bc2608'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('d8972a20-1516-409b-8f3f-931fb25d2f4e'::uuid, 'ceef5676-836c-48d7-81d6-21ab26bc2608'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('ceef5676-836c-48d7-81d6-21ab26bc2608'::uuid, ARRAY['Falsch']::text[], 'Kinder bezahlen nur 7 Euro.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('36541f50-bd41-4029-88d3-989851d648c1'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'single_choice', 'Sie möchten wissen, ob die Bibliothek am Samstag geöffnet ist.', 1, 6, '{"bank_question_id":"A1-SIM-01-L06","part":2,"instruction":"Wo finden Sie die Information? Wählen Sie A oder B.","passage":"A — www.stadtbibliothek.de: Öffnungszeiten, Ausweis, Bücher verlängern.\n\nB — www.buchladen-kern.de: Romane und Reiseführer online kaufen.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0e4c8908-8be2-4ac6-82e8-c75377b4a638'::uuid, '36541f50-bd41-4029-88d3-989851d648c1'::uuid, 'www.stadtbibliothek.de', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('e82e0a8e-2b0f-4238-8917-452468a98537'::uuid, '36541f50-bd41-4029-88d3-989851d648c1'::uuid, 'www.buchladen-kern.de', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('36541f50-bd41-4029-88d3-989851d648c1'::uuid, ARRAY['A']::text[], 'Öffnungszeiten der Bibliothek finden Sie auf Seite A.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('fcde3171-8798-4785-8b88-d1323267d3c9'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'single_choice', 'Sie suchen eine Busverbindung zum Bahnhof.', 1, 7, '{"bank_question_id":"A1-SIM-01-L07","part":2,"instruction":null,"passage":"A — www.mobil-bonn.de: Busse und Bahnen, Fahrpläne, Tickets.\n\nB — www.rad-bonn.de: Fahrräder kaufen und reparieren.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5654132d-b78e-497e-8bc3-4cdd5cbcf4bf'::uuid, 'fcde3171-8798-4785-8b88-d1323267d3c9'::uuid, 'www.mobil-bonn.de', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0c6c96c1-5d0e-466e-8092-66fc7171993d'::uuid, 'fcde3171-8798-4785-8b88-d1323267d3c9'::uuid, 'www.rad-bonn.de', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('fcde3171-8798-4785-8b88-d1323267d3c9'::uuid, ARRAY['A']::text[], 'Fahrpläne für Busse stehen auf Seite A.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('f9135e76-2b44-40b4-8146-fc6e1491b73e'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'single_choice', 'Sie brauchen für zwei Nächte ein Zimmer in Leipzig.', 1, 8, '{"bank_question_id":"A1-SIM-01-L08","part":2,"instruction":null,"passage":"A — www.hotel-am-park.de: Zimmer und Frühstück in Leipzig.\n\nB — www.wohnung-leipzig.de: Wohnungen langfristig mieten.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('53e98bb0-da6f-436f-83bc-6c8b18d514ed'::uuid, 'f9135e76-2b44-40b4-8146-fc6e1491b73e'::uuid, 'www.hotel-am-park.de', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('90b1118e-512e-4d4d-8195-3da88e5440b7'::uuid, 'f9135e76-2b44-40b4-8146-fc6e1491b73e'::uuid, 'www.wohnung-leipzig.de', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('f9135e76-2b44-40b4-8146-fc6e1491b73e'::uuid, ARRAY['A']::text[], 'Für zwei Nächte ist die Hotelseite richtig.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('48086544-239e-460b-8180-9f1e6cb5aaae'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'single_choice', 'Sie arbeiten bis 17 Uhr und möchten Deutsch lernen.', 1, 9, '{"bank_question_id":"A1-SIM-01-L09","part":2,"instruction":null,"passage":"A — www.deutsch-abends.de: Deutschkurse Montag und Mittwoch, 18–20 Uhr.\n\nB — www.deutsch-morgens.de: Deutschkurse täglich, 9–12 Uhr.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('b44baf7b-77b8-4b2d-81b8-713999ac6155'::uuid, '48086544-239e-460b-8180-9f1e6cb5aaae'::uuid, 'www.deutsch-abends.de', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3700ae11-6b23-4212-8edd-f568a1c4b9c0'::uuid, '48086544-239e-460b-8180-9f1e6cb5aaae'::uuid, 'www.deutsch-morgens.de', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('48086544-239e-460b-8180-9f1e6cb5aaae'::uuid, ARRAY['A']::text[], 'Der Abendkurs beginnt nach der Arbeit.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('8dfbde00-bdf4-4a6b-8410-253ebd20033e'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'single_choice', 'Ihre Katze ist krank.', 1, 10, '{"bank_question_id":"A1-SIM-01-L10","part":2,"instruction":null,"passage":"A — www.tierarzt-west.de: Praxis für Hunde, Katzen und kleine Tiere.\n\nB — www.arztzentrum-west.de: Hausärzte und Kinderärzte.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('02ace758-6a64-4308-8593-871070ae14bf'::uuid, '8dfbde00-bdf4-4a6b-8410-253ebd20033e'::uuid, 'www.tierarzt-west.de', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5d7ce650-ebc6-42cf-8ea1-c24513c93af9'::uuid, '8dfbde00-bdf4-4a6b-8410-253ebd20033e'::uuid, 'www.arztzentrum-west.de', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('8dfbde00-bdf4-4a6b-8410-253ebd20033e'::uuid, ARRAY['A']::text[], 'Eine kranke Katze muss zum Tierarzt.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('7f381456-6d87-4aae-8c12-fe402577803b'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'true_false', 'Heute Nachmittag kann man Dr. Klein besuchen.', 1, 11, '{"bank_question_id":"A1-SIM-01-L11","part":3,"instruction":"Lesen Sie die Informationen und die Aufgaben 11 bis 15. Kreuzen Sie an: Richtig oder Falsch.","passage":"Arztpraxis Dr. Klein\nHeute Nachmittag geschlossen.\nIn dringenden Fällen: 030 445 82 11","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('1362a2d5-a64b-4a9a-8538-bb47cb5d0fe1'::uuid, '7f381456-6d87-4aae-8c12-fe402577803b'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3aaa8b70-1e07-4bfe-81c5-044ba5f1fc34'::uuid, '7f381456-6d87-4aae-8c12-fe402577803b'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('7f381456-6d87-4aae-8c12-fe402577803b'::uuid, ARRAY['Falsch']::text[], 'Die Praxis ist heute Nachmittag geschlossen.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('cb0d27c1-6b05-40ad-8c14-a17450277a36'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'true_false', 'Am Sonntag gibt es bis 12 Uhr Frühstück.', 1, 12, '{"bank_question_id":"A1-SIM-01-L12","part":3,"instruction":null,"passage":"Café Morgen\nFrühstück Montag bis Samstag 7–11 Uhr\nSonntag 8–12 Uhr","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('30e31f07-bde3-45c4-88b5-51cb057aab27'::uuid, 'cb0d27c1-6b05-40ad-8c14-a17450277a36'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('23834a6f-3391-48e6-8b9d-b6d132b78956'::uuid, 'cb0d27c1-6b05-40ad-8c14-a17450277a36'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('cb0d27c1-6b05-40ad-8c14-a17450277a36'::uuid, ARRAY['Richtig']::text[], 'Sonntags wird Frühstück von 8 bis 12 Uhr angeboten.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('00ee375f-424e-4809-89f5-8d90022c0a18'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'true_false', 'Man kann heute mit dem Aufzug fahren.', 1, 13, '{"bank_question_id":"A1-SIM-01-L13","part":3,"instruction":null,"passage":"Aufzug außer Betrieb.\nBitte benutzen Sie die Treppe.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('59feda64-f767-4e2e-8418-d03a01fbd383'::uuid, '00ee375f-424e-4809-89f5-8d90022c0a18'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0551310e-0590-437b-8923-a3faa4e8f084'::uuid, '00ee375f-424e-4809-89f5-8d90022c0a18'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('00ee375f-424e-4809-89f5-8d90022c0a18'::uuid, ARRAY['Falsch']::text[], 'Der Aufzug ist außer Betrieb.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('768699a3-68ee-4d06-869c-0341f24c97a1'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'true_false', 'Zwischen 16 und 18 Uhr sind alle Becken geschlossen.', 1, 14, '{"bank_question_id":"A1-SIM-01-L14","part":3,"instruction":null,"passage":"Schwimmbad Nord\nWegen eines Kurses ist das große Becken von 16 bis 18 Uhr geschlossen. Das kleine Becken ist geöffnet.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('cd29d2ec-9a10-4146-8e91-cd71d858e7da'::uuid, '768699a3-68ee-4d06-869c-0341f24c97a1'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6798e443-dc12-458d-8215-1d280ce55804'::uuid, '768699a3-68ee-4d06-869c-0341f24c97a1'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('768699a3-68ee-4d06-869c-0341f24c97a1'::uuid, ARRAY['Falsch']::text[], 'Das kleine Becken bleibt geöffnet.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('02415a01-f1c4-4d07-83c8-a9fa1da89a88'::uuid, 'c287378c-3f6d-4146-81f5-835a18e30ce7'::uuid, 'true_false', 'Man kann das Fahrrad am Wochenende ansehen.', 1, 15, '{"bank_question_id":"A1-SIM-01-L15","part":3,"instruction":null,"passage":"Fahrrad zu verkaufen\nCitybike, drei Jahre alt, 90 Euro. Besichtigung am Wochenende möglich.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('4db3d0a2-cb60-40e0-82d2-36dff5e1e344'::uuid, '02415a01-f1c4-4d07-83c8-a9fa1da89a88'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7d8e6582-53a6-4a98-8158-ff0b60ee33ab'::uuid, '02415a01-f1c4-4d07-83c8-a9fa1da89a88'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('02415a01-f1c4-4d07-83c8-a9fa1da89a88'::uuid, ARRAY['Richtig']::text[], 'Eine Besichtigung ist am Wochenende möglich.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('a0b08a36-aee6-484d-8ccd-01ba98c5f497'::uuid, '811f4e04-864d-46b4-8c61-c2d319003efc'::uuid, 'schreiben', 'Schreiben', 3, 15)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('17ae7ed8-211d-4005-83ff-c63fdff4bb4d'::uuid, 'a0b08a36-aee6-484d-8ccd-01ba98c5f497'::uuid, 'form_fill', 'Ihr Freund Amir Rahmani möchte einen Deutschkurs besuchen. Er ist am 8. Februar 1998 in Rabat geboren. Seine Muttersprache ist Arabisch. Er möchte den Abendkurs ab 5. Oktober besuchen. Helfen Sie Amir und ergänzen Sie die fünf fehlenden Informationen.', 5, 1, '{"bank_question_id":"A1-SIM-01-W01","part":1,"instruction":"Ihr Freund Amir Rahmani möchte einen Deutschkurs besuchen. Er ist am 8. Februar 1998 in Rabat geboren. Seine Muttersprache ist Arabisch. Er möchte den Abendkurs ab 5. Oktober besuchen. Helfen Sie Amir und ergänzen Sie die fünf fehlenden Informationen.","passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":[{"key":"Familienname","points":1},{"key":"Geburtsdatum","points":1},{"key":"Geburtsort","points":1},{"key":"Muttersprache","points":1},{"key":"Kursbeginn","points":1}],"rubric":null,"allowed_scores":null,"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('17ae7ed8-211d-4005-83ff-c63fdff4bb4d'::uuid, ARRAY['form_fill']::text[], NULL, '{"source_data":{"Familienname":"Rahmani","Geburtsdatum":"08.02.1998","Geburtsort":"Rabat","Muttersprache":"Arabisch","Kursbeginn":"05.10."},"fields":[{"key":"Familienname","points":1},{"key":"Geburtsdatum","points":1},{"key":"Geburtsort","points":1},{"key":"Muttersprache","points":1},{"key":"Kursbeginn","points":1}]}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('206484b5-f511-4a94-83d8-2aedc87c70db'::uuid, 'a0b08a36-aee6-484d-8ccd-01ba98c5f497'::uuid, 'writing', 'Sie möchten am Samstag mit Ihrer Freundin Anna einen Ausflug machen. Schreiben Sie an Anna.', 10, 2, '{"bank_question_id":"A1-SIM-01-W02","part":2,"instruction":"Sie möchten am Samstag mit Ihrer Freundin Anna einen Ausflug machen. Schreiben Sie an Anna.","passage":null,"audio_url":null,"recommended_words":"environ 30","requirements":["Warum schreiben Sie?","Wohin möchten Sie fahren?","Wann und wo treffen Sie sich?"],"fields":null,"rubric":{"content_point_1":3,"content_point_2":3,"content_point_3":3,"communicative_design":1},"allowed_scores":{"content_point_1":[0,1.5,3],"content_point_2":[0,1.5,3],"content_point_3":[0,1.5,3],"communicative_design":[0,0.5,1]},"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('206484b5-f511-4a94-83d8-2aedc87c70db'::uuid, ARRAY[]::text[], NULL, '{"sample_answer":"Liebe Anna, hast du am Samstag Zeit? Ich möchte mit dir nach Potsdam fahren. Wir können den Park besuchen. Treffen wir uns um 9 Uhr am Bahnhof? Bitte antworte mir. Liebe Grüße, Samir","rubric":{"content_point_1":3,"content_point_2":3,"content_point_3":3,"communicative_design":1},"allowed_scores":{"content_point_1":[0,1.5,3],"content_point_2":[0,1.5,3],"content_point_3":[0,1.5,3],"communicative_design":[0,0.5,1]}}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('294c5435-aa2d-4a95-8dfb-fbf29e15a055'::uuid, '811f4e04-864d-46b4-8c61-c2d319003efc'::uuid, 'sprechen', 'Sprechen', 4, 15)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('2cac571d-9891-4c91-8cc3-2951cbeede5d'::uuid, '294c5435-aa2d-4a95-8dfb-fbf29e15a055'::uuid, 'speaking', 'Stellen Sie sich vor. Sprechen Sie über Name, Alter, Land, Wohnort, Sprachen, Beruf und Hobby. Buchstabieren Sie danach Ihren Familiennamen und nennen Sie Ihre Telefonnummer.', 3, 1, '{"bank_question_id":"A1-SIM-01-SP01","part":1,"instruction":"Stellen Sie sich vor. Sprechen Sie über Name, Alter, Land, Wohnort, Sprachen, Beruf und Hobby. Buchstabieren Sie danach Ihren Familiennamen und nennen Sie Ihre Telefonnummer.","passage":null,"audio_url":null,"recommended_words":null,"requirements":["Sich vorstellen","Ein Wort buchstabieren","Eine Nummer nennen"],"fields":null,"rubric":{"introduction":1,"spelling":1,"number":1},"allowed_scores":{"introduction":[0,0.5,1],"spelling":[0,0.5,1],"number":[0,0.5,1]},"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('2cac571d-9891-4c91-8cc3-2951cbeede5d'::uuid, ARRAY[]::text[], NULL, '{"rubric":{"introduction":1,"spelling":1,"number":1},"allowed_scores":{"introduction":[0,0.5,1],"spelling":[0,0.5,1],"number":[0,0.5,1]}}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('0546e7a0-d3ab-4403-8510-8f620a090c5f'::uuid, '294c5435-aa2d-4a95-8dfb-fbf29e15a055'::uuid, 'speaking', 'Bitten Sie um Informationen und geben Sie Informationen. Stellen und beantworten Sie zu jedem Thema eine einfache Frage.', 6, 2, '{"bank_question_id":"A1-SIM-01-SP02","part":2,"instruction":"Bitten Sie um Informationen und geben Sie Informationen. Stellen und beantworten Sie zu jedem Thema eine einfache Frage.","passage":null,"audio_url":null,"recommended_words":null,"requirements":["Thema Einkaufen — Karte: Preis","Thema Wochenende — Karte: Freunde"],"fields":null,"rubric":{"question_1":1.5,"answer_1":1.5,"question_2":1.5,"answer_2":1.5},"allowed_scores":{"question_1":[0,0.75,1.5],"answer_1":[0,0.75,1.5],"question_2":[0,0.75,1.5],"answer_2":[0,0.75,1.5]},"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('0546e7a0-d3ab-4403-8510-8f620a090c5f'::uuid, ARRAY[]::text[], NULL, '{"rubric":{"question_1":1.5,"answer_1":1.5,"question_2":1.5,"answer_2":1.5},"allowed_scores":{"question_1":[0,0.75,1.5],"answer_1":[0,0.75,1.5],"question_2":[0,0.75,1.5],"answer_2":[0,0.75,1.5]}}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('2e6253d5-ee66-4886-81ee-bc3435614b22'::uuid, '294c5435-aa2d-4a95-8dfb-fbf29e15a055'::uuid, 'speaking', 'Formulieren Sie Bitten und reagieren Sie auf Bitten Ihres Partners oder Ihrer Partnerin.', 6, 3, '{"bank_question_id":"A1-SIM-01-SP03","part":3,"instruction":"Formulieren Sie Bitten und reagieren Sie auf Bitten Ihres Partners oder Ihrer Partnerin.","passage":null,"audio_url":null,"recommended_words":null,"requirements":["Karte 1: ein Glas Wasser","Karte 2: das Fenster schließen"],"fields":null,"rubric":{"request_1":1.5,"response_1":1.5,"request_2":1.5,"response_2":1.5},"allowed_scores":{"request_1":[0,0.75,1.5],"response_1":[0,0.75,1.5],"request_2":[0,0.75,1.5],"response_2":[0,0.75,1.5]},"playback_count":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('2e6253d5-ee66-4886-81ee-bc3435614b22'::uuid, ARRAY[]::text[], NULL, '{"rubric":{"request_1":1.5,"response_1":1.5,"request_2":1.5,"response_2":1.5},"allowed_scores":{"request_1":[0,0.75,1.5],"response_1":[0,0.75,1.5],"request_2":[0,0.75,1.5],"response_2":[0,0.75,1.5]}}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
END $$;
