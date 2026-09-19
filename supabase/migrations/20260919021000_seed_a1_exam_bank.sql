-- Idempotent seed of A1-01 / A1-02 / A1-03 mock exams
DO $$
DECLARE
  v_level_id uuid;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE code = 'A1' LIMIT 1;
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Level A1 missing';
  END IF;
  -- A1-01
  INSERT INTO public.exams (
    id, code, title, description, instructions, level_id, duration_minutes,
    pass_percentage, status, published_at, max_attempts, is_mock
  ) VALUES (
    '28e243eb-edbb-46e1-8a00-9d8a8fd2a8a8'::uuid,
    'A1-01',
    'Examen blanc A1-01',
    'Alltag & Familie',
    'Alltag & Familie · 65 min · 50 points',
    v_level_id,
    65,
    60,
    'published',
    now(),
    3,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    instructions = EXCLUDED.instructions,
    level_id = EXCLUDED.level_id,
    duration_minutes = EXCLUDED.duration_minutes,
    status = 'published',
    published_at = coalesce(public.exams.published_at, now()),
    is_mock = true,
    updated_at = now();
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, '28e243eb-edbb-46e1-8a00-9d8a8fd2a8a8'::uuid, 'lesen', 'Lesen', 1, 15)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('1b6b6764-9511-4815-8286-0332ee3d9fd5'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'true_false', 'Lisa kommt um 18 Uhr.', 1, 1, '{"bank_question_id":"A1-01-L01","part":1,"instruction":"Lesen Sie die Nachricht. Ist die Aussage richtig oder falsch?","passage":"Hallo Karim, mein Zug hat heute Verspätung. Ich komme nicht um 18 Uhr, sondern gegen 19 Uhr. Bis später! Lisa","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('547b2c8b-e08f-4b43-8910-a03b8ab8b5be'::uuid, '1b6b6764-9511-4815-8286-0332ee3d9fd5'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3d66d4b9-6a2b-4ba1-8cd0-58fe5ec99c42'::uuid, '1b6b6764-9511-4815-8286-0332ee3d9fd5'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('1b6b6764-9511-4815-8286-0332ee3d9fd5'::uuid, ARRAY['Falsch']::text[], 'Lisa schreibt, dass sie erst gegen 19 Uhr kommt.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('b2490023-d62b-4f49-8a76-bfab50679a95'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'true_false', 'Paul kann vor 16 Uhr Kaffee trinken.', 1, 2, '{"bank_question_id":"A1-01-L02","part":1,"instruction":"Lesen Sie die Nachricht. Ist die Aussage richtig oder falsch?","passage":"Guten Morgen Sara, ich arbeite heute bis 16 Uhr. Danach können wir zusammen Kaffee trinken. Paul","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('d7091fe1-ca7b-457c-8d9f-9d3f0360d1fe'::uuid, 'b2490023-d62b-4f49-8a76-bfab50679a95'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ff5bd0c9-fe44-4001-808f-0517c49be49d'::uuid, 'b2490023-d62b-4f49-8a76-bfab50679a95'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('b2490023-d62b-4f49-8a76-bfab50679a95'::uuid, ARRAY['Falsch']::text[], 'Paul arbeitet bis 16 Uhr und kann erst danach Kaffee trinken.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('0baf6efe-2a78-485a-8e93-19c8ceec559e'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'true_false', 'Die Geburtstagsfeier ist am Sonntag.', 1, 3, '{"bank_question_id":"A1-01-L03","part":1,"instruction":null,"passage":"Liebe Anna, am Sonntag feiern wir den Geburtstag von meiner Mutter. Kommst du um 15 Uhr zu uns? Viele Grüße Maria","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('8b361989-ea6a-401c-8ef1-985d8387a3eb'::uuid, '0baf6efe-2a78-485a-8e93-19c8ceec559e'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('f5832a81-aa2f-4633-8039-b6edfab3a9df'::uuid, '0baf6efe-2a78-485a-8e93-19c8ceec559e'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('0baf6efe-2a78-485a-8e93-19c8ceec559e'::uuid, ARRAY['Richtig']::text[], 'Im Text steht ausdrücklich: am Sonntag.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('452adb58-607a-4fd0-810c-4d75f296e7af'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'true_false', 'Nina möchte heute Abend ins Kino gehen.', 1, 4, '{"bank_question_id":"A1-01-L04","part":1,"instruction":null,"passage":"Hallo Jonas, heute Abend können wir nicht ins Kino gehen. Ich bin krank. Vielleicht am Freitag? Nina","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('981972e4-19cf-491d-88e6-543921d82f2e'::uuid, '452adb58-607a-4fd0-810c-4d75f296e7af'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('9bf852f4-f91e-4f54-80b0-5344025ceae4'::uuid, '452adb58-607a-4fd0-810c-4d75f296e7af'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('452adb58-607a-4fd0-810c-4d75f296e7af'::uuid, ARRAY['Falsch']::text[], 'Nina ist krank und kann heute Abend nicht ins Kino gehen.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('ab972aa9-3053-4106-806a-83b6d9de5965'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'true_false', 'Herr Müller soll um 10:20 Uhr in der Praxis sein.', 1, 5, '{"bank_question_id":"A1-01-L05","part":1,"instruction":null,"passage":"Herr Müller, Ihr Termin beim Zahnarzt ist morgen um 10:30 Uhr. Bitte kommen Sie zehn Minuten früher. Praxis Schneider","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ca2fdd37-075b-428b-84b6-b730b5ebcc12'::uuid, 'ab972aa9-3053-4106-806a-83b6d9de5965'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a8ee90ae-7947-4352-80df-b4a13d5a219e'::uuid, 'ab972aa9-3053-4106-806a-83b6d9de5965'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('ab972aa9-3053-4106-806a-83b6d9de5965'::uuid, ARRAY['Richtig']::text[], 'Der Termin ist um 10:30 Uhr. Zehn Minuten früher bedeutet 10:20 Uhr.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('d3d3742a-e940-4daa-873b-19a0cd73ba52'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'single_choice', 'Wann kann man am Samstag Brot kaufen?', 1, 6, '{"bank_question_id":"A1-01-L06","part":2,"instruction":null,"passage":"Bäckerei König. Montag-Freitag: 06:30-18:00. Samstag: 07:00-13:00. Sonntag: geschlossen.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('acbabc49-848c-4840-81a1-0fa79cd72027'::uuid, 'd3d3742a-e940-4daa-873b-19a0cd73ba52'::uuid, '06:30', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('69730990-bbf3-4d1c-89e0-96d21d6ecbe6'::uuid, 'd3d3742a-e940-4daa-873b-19a0cd73ba52'::uuid, '10:00', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('df0e8344-2f03-436c-8a80-47f3419f6889'::uuid, 'd3d3742a-e940-4daa-873b-19a0cd73ba52'::uuid, '15:00', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('d3d3742a-e940-4daa-873b-19a0cd73ba52'::uuid, ARRAY['B']::text[], 'Am Samstag ist die Bäckerei von 07:00 bis 13:00 Uhr geöffnet.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('78f15704-166a-405b-8670-ecb56304e6c3'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'single_choice', 'Was bedeutet das?', 1, 7, '{"bank_question_id":"A1-01-L07","part":2,"instruction":null,"passage":"Bitte nicht parken! Einfahrt Tag und Nacht freihalten.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('2d35cb7a-ede6-44e5-8492-019bf8b9a89f'::uuid, '78f15704-166a-405b-8670-ecb56304e6c3'::uuid, 'Man darf hier nur nachts parken.', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('529bc561-4b69-42ac-8b97-dee6b28c46aa'::uuid, '78f15704-166a-405b-8670-ecb56304e6c3'::uuid, 'Man darf hier kurz parken.', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c29c7a51-6e81-43c7-851b-45d80ff1db07'::uuid, '78f15704-166a-405b-8670-ecb56304e6c3'::uuid, 'Man darf hier nicht parken.', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('78f15704-166a-405b-8670-ecb56304e6c3'::uuid, ARRAY['C']::text[], 'Bitte nicht parken bedeutet, dass Parken hier verboten ist.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('d02c401e-70c7-4620-8152-4ac3cbd4947a'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'single_choice', 'Wann ist die Bibliothek heute geschlossen?', 1, 8, '{"bank_question_id":"A1-01-L08","part":2,"instruction":null,"passage":"Bibliothek. Heute ab 14 Uhr geschlossen.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('cad78d17-0d1a-48c7-8df6-20d3a75e1e76'::uuid, 'd02c401e-70c7-4620-8152-4ac3cbd4947a'::uuid, 'den ganzen Tag', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('f8f00a6a-e516-4a7d-884d-525117006ecc'::uuid, 'd02c401e-70c7-4620-8152-4ac3cbd4947a'::uuid, 'ab 14 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('e0828c34-2f9a-4d41-8467-dbac8c88c034'::uuid, 'd02c401e-70c7-4620-8152-4ac3cbd4947a'::uuid, 'bis 14 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('d02c401e-70c7-4620-8152-4ac3cbd4947a'::uuid, ARRAY['B']::text[], 'Ab 14 Uhr bedeutet: ab diesem Zeitpunkt ist die Bibliothek geschlossen.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('678cf1f7-378e-4ae1-859f-11449652aa7a'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'single_choice', 'Wer darf hier hinein?', 1, 9, '{"bank_question_id":"A1-01-L09","part":2,"instruction":null,"passage":"Nur für Mitarbeiter","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ef7a482b-8aac-4f02-809b-06538fd7ea6f'::uuid, '678cf1f7-378e-4ae1-859f-11449652aa7a'::uuid, 'alle Besucher', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5380ad04-acf1-4657-8440-da102fc25513'::uuid, '678cf1f7-378e-4ae1-859f-11449652aa7a'::uuid, 'nur Studenten', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('e2f4d7f8-c510-4fab-8ac4-b390a9d21229'::uuid, '678cf1f7-378e-4ae1-859f-11449652aa7a'::uuid, 'die Mitarbeiter', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('678cf1f7-378e-4ae1-859f-11449652aa7a'::uuid, ARRAY['C']::text[], 'Nur für Mitarbeiter bedeutet, dass nur das Personal hinein darf.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('d2782c2b-80dc-42a0-88f3-c84bfac8ed6a'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'single_choice', 'Wo gibt es Frühstück?', 1, 10, '{"bank_question_id":"A1-01-L10","part":2,"instruction":null,"passage":"Frühstück täglich von 7:00 bis 10:00 Uhr. Restaurant - Erdgeschoss.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('cc8f3d8e-fc8d-48f7-8269-b03df1b48630'::uuid, 'd2782c2b-80dc-42a0-88f3-c84bfac8ed6a'::uuid, 'im ersten Stock', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5eb8149b-225e-4d0b-8386-d5ddf10c3e36'::uuid, 'd2782c2b-80dc-42a0-88f3-c84bfac8ed6a'::uuid, 'im Erdgeschoss', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('edeb7f03-1284-40e3-8b3a-5f1829a4bc45'::uuid, 'd2782c2b-80dc-42a0-88f3-c84bfac8ed6a'::uuid, 'im Zimmer', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('d2782c2b-80dc-42a0-88f3-c84bfac8ed6a'::uuid, ARRAY['B']::text[], 'Im Text steht: Restaurant - Erdgeschoss.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('5fb533a5-de92-493e-8c00-e197920f2312'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'single_choice', 'Was kostet das Zimmer?', 1, 11, '{"bank_question_id":"A1-01-L11","part":3,"instruction":null,"passage":"Zimmer frei. Kleines möbliertes Zimmer in Köln. 390 € pro Monat. Internet inklusive.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c49e090e-e19b-4832-89de-cbc91b938e45'::uuid, '5fb533a5-de92-493e-8c00-e197920f2312'::uuid, '176 €', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('baa5afdd-b7e2-46cc-8245-0247ae310e58'::uuid, '5fb533a5-de92-493e-8c00-e197920f2312'::uuid, '390 €', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('999ccdac-4833-4bd7-81bf-50bfcaca94b2'::uuid, '5fb533a5-de92-493e-8c00-e197920f2312'::uuid, '442 €', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('5fb533a5-de92-493e-8c00-e197920f2312'::uuid, ARRAY['B']::text[], 'Das Zimmer kostet 390 € pro Monat.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('7c802a4b-43db-448b-8baa-bc251a89f916'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'single_choice', 'Wie oft pro Woche ist der Kurs?', 1, 12, '{"bank_question_id":"A1-01-L12","part":3,"instruction":null,"passage":"Deutsch lernen! A1-Kurs Dienstag und Donnerstag, 18:00-20:00 Uhr.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('504ba6e1-289a-422e-853b-2bf513675e0e'::uuid, '7c802a4b-43db-448b-8baa-bc251a89f916'::uuid, 'einmal', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3e35c112-29e8-49c9-8077-77a3b625ec5f'::uuid, '7c802a4b-43db-448b-8baa-bc251a89f916'::uuid, 'zweimal', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('93391bdf-45c5-412b-8a02-c5b954d93cea'::uuid, '7c802a4b-43db-448b-8baa-bc251a89f916'::uuid, 'dreimal', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('7c802a4b-43db-448b-8baa-bc251a89f916'::uuid, ARRAY['B']::text[], 'Der Kurs findet am Dienstag und Donnerstag statt, also zweimal pro Woche.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('85cc496b-2bf3-4a6e-89c6-367ccb04bb8a'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'single_choice', 'Was wird verkauft?', 1, 13, '{"bank_question_id":"A1-01-L13","part":3,"instruction":null,"passage":"Fahrrad zu verkaufen. Blaues Citybike, zwei Jahre alt, sehr guter Zustand. Preis: 120 €.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('173e6e72-6a74-4318-8e2e-34a01ee9bb80'::uuid, '85cc496b-2bf3-4a6e-89c6-367ccb04bb8a'::uuid, 'ein Auto', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('9d6bef84-c1b0-470b-8fb5-34e351be2c5e'::uuid, '85cc496b-2bf3-4a6e-89c6-367ccb04bb8a'::uuid, 'ein Fahrrad', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3b748ce6-6440-458c-8171-3bcb723f9a8c'::uuid, '85cc496b-2bf3-4a6e-89c6-367ccb04bb8a'::uuid, 'ein Motorrad', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('85cc496b-2bf3-4a6e-89c6-367ccb04bb8a'::uuid, ARRAY['B']::text[], 'Die Anzeige beginnt mit Fahrrad zu verkaufen.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('e06dd030-7f97-44a5-8bd4-5dd25bc30844'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'single_choice', 'Wann ist das Café geschlossen?', 1, 14, '{"bank_question_id":"A1-01-L14","part":3,"instruction":null,"passage":"Café Morgenrot. Frühstück, Kuchen und Kaffee. Montag Ruhetag.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('d930dcb7-4fbf-499a-8884-457a9c88cfdb'::uuid, 'e06dd030-7f97-44a5-8bd4-5dd25bc30844'::uuid, 'Sonntag', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('1b5ce1f3-73e1-4c8d-8339-af431cab8ea2'::uuid, 'e06dd030-7f97-44a5-8bd4-5dd25bc30844'::uuid, 'Montag', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('29fa4610-8cae-4449-86c8-c35459d2f198'::uuid, 'e06dd030-7f97-44a5-8bd4-5dd25bc30844'::uuid, 'Freitag', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('e06dd030-7f97-44a5-8bd4-5dd25bc30844'::uuid, ARRAY['B']::text[], 'Montag ist Ruhetag.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('f79a8da2-8675-4f7c-800e-5294dd662364'::uuid, '66163040-6991-4ec4-85fe-018fb7a8c566'::uuid, 'single_choice', 'Wann braucht die Familie den Babysitter?', 1, 15, '{"bank_question_id":"A1-01-L15","part":3,"instruction":null,"passage":"Babysitter gesucht. Wir suchen eine freundliche Person für unsere zwei Kinder. Freitagabend, 18-22 Uhr.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a8db128e-e532-4c5e-825a-a53386f3f5d0'::uuid, 'f79a8da2-8675-4f7c-800e-5294dd662364'::uuid, 'Freitagmorgen', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6df9703a-15c2-412d-8724-41ea338ad0d4'::uuid, 'f79a8da2-8675-4f7c-800e-5294dd662364'::uuid, 'Samstagnachmittag', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('4f4e9ab5-f33e-485c-8c06-8b0d61703600'::uuid, 'f79a8da2-8675-4f7c-800e-5294dd662364'::uuid, 'Freitagabend', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('f79a8da2-8675-4f7c-800e-5294dd662364'::uuid, ARRAY['C']::text[], 'Die Anzeige nennt Freitagabend von 18 bis 22 Uhr.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, '28e243eb-edbb-46e1-8a00-9d8a8fd2a8a8'::uuid, 'hoeren', 'Hören', 2, 15)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('400d6d25-521a-4501-8795-949fa863c1a4'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Wie spät ist es?', 1, 1, '{"bank_question_id":"A1-01-H01","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('cfd2722a-d6db-4963-8090-b944dbd80bfc'::uuid, '400d6d25-521a-4501-8795-949fa863c1a4'::uuid, '08:45', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('4c20ad68-1e9c-4d99-80a2-79818b5ddb5f'::uuid, '400d6d25-521a-4501-8795-949fa863c1a4'::uuid, '09:15', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5f72d6ec-1a04-468e-81c0-b7ec667f1943'::uuid, '400d6d25-521a-4501-8795-949fa863c1a4'::uuid, '09:30', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('400d6d25-521a-4501-8795-949fa863c1a4'::uuid, ARRAY['B']::text[], 'Viertel nach neun bedeutet 09:15 Uhr.', '{"audio_script":"Frau: Entschuldigung, wie spät ist es? Mann: Viertel nach neun. Frau: Danke."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('00f1c149-1ffb-4136-8c2e-1211e9c40aa5'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Wie viel kostet der Kaffee?', 1, 2, '{"bank_question_id":"A1-01-H02","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('22cc4b2e-1be7-4218-8acc-a31696ba1656'::uuid, '00f1c149-1ffb-4136-8c2e-1211e9c40aa5'::uuid, '2,05 €', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7b425f76-e1d3-4bac-8cd7-553321d76951'::uuid, '00f1c149-1ffb-4136-8c2e-1211e9c40aa5'::uuid, '2,50 €', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('2d8747a1-e426-4c72-80fd-277546cad31a'::uuid, '00f1c149-1ffb-4136-8c2e-1211e9c40aa5'::uuid, '5,20 €', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('00f1c149-1ffb-4136-8c2e-1211e9c40aa5'::uuid, ARRAY['B']::text[], 'Die Frau sagt: Zwei Euro fünfzig.', '{"audio_script":"Mann: Was kostet der Kaffee? Frau: Zwei Euro fünfzig. Mann: Dann nehme ich einen."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('da78ccce-d5d8-4360-84f8-56c9b8b4a1f0'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Welchen Bus braucht die Frau?', 1, 3, '{"bank_question_id":"A1-01-H03","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a1ec78c7-9fa0-4263-8a30-2c3656261973'::uuid, 'da78ccce-d5d8-4360-84f8-56c9b8b4a1f0'::uuid, '2', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('569cdaad-05c3-4202-868d-2b629df73854'::uuid, 'da78ccce-d5d8-4360-84f8-56c9b8b4a1f0'::uuid, '10', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('d2cec4ec-2484-4874-8d77-813800a33ca0'::uuid, 'da78ccce-d5d8-4360-84f8-56c9b8b4a1f0'::uuid, '12', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('da78ccce-d5d8-4360-84f8-56c9b8b4a1f0'::uuid, ARRAY['C']::text[], 'Der Mann sagt: Die Nummer zwölf.', '{"audio_script":"Frau: Welcher Bus fährt zum Bahnhof? Mann: Die Nummer zwölf. Frau: Danke schön."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('e5cf4fd0-3a42-4356-81cd-56e6e92d841c'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Wann kann die Frau ins Kino gehen?', 1, 4, '{"bank_question_id":"A1-01-H04","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('cf35ec1e-7b7b-4ec5-8e47-055ff383da45'::uuid, 'e5cf4fd0-3a42-4356-81cd-56e6e92d841c'::uuid, 'heute', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('e6b3a663-5f89-489f-8d35-8c6a5f5a057f'::uuid, 'e5cf4fd0-3a42-4356-81cd-56e6e92d841c'::uuid, 'morgen', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7bc80e5d-caa5-42af-8305-50b9ff333578'::uuid, 'e5cf4fd0-3a42-4356-81cd-56e6e92d841c'::uuid, 'nächste Woche', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('e5cf4fd0-3a42-4356-81cd-56e6e92d841c'::uuid, ARRAY['B']::text[], 'Die Frau sagt, dass sie morgen Zeit hat.', '{"audio_script":"Mann: Gehen wir heute ins Kino? Frau: Heute kann ich nicht. Aber morgen habe ich Zeit."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('cf5656b3-da56-49ca-8b47-551d47d15699'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Was möchte der Mann?', 1, 5, '{"bank_question_id":"A1-01-H05","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ecdd5008-cb3a-46aa-8c5f-48393ee70bfd'::uuid, 'cf5656b3-da56-49ca-8b47-551d47d15699'::uuid, 'Kaffee mit Zucker', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('97e7c619-e650-40a0-8e95-ad56dc0c2856'::uuid, 'cf5656b3-da56-49ca-8b47-551d47d15699'::uuid, 'Tee mit Zucker', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('bca79606-e87f-4b87-8aba-ef8d47e61ad7'::uuid, 'cf5656b3-da56-49ca-8b47-551d47d15699'::uuid, 'Tee ohne Zucker', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('cf5656b3-da56-49ca-8b47-551d47d15699'::uuid, ARRAY['C']::text[], 'Der Mann bestellt Tee ohne Zucker.', '{"audio_script":"Frau: Möchten Sie Tee oder Kaffee? Mann: Einen Tee, bitte. Ohne Zucker."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('71d7a441-0992-4548-8c3c-f87e6092a7af'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Was ist richtig?', 1, 6, '{"bank_question_id":"A1-01-H06","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('077f0496-4e53-4a37-8ef6-f7af1324cfb3'::uuid, '71d7a441-0992-4548-8c3c-f87e6092a7af'::uuid, 'Der Zug fährt früher.', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('401c8f1a-29cc-4867-8543-56a8ca06cb21'::uuid, '71d7a441-0992-4548-8c3c-f87e6092a7af'::uuid, 'Der Zug hat zehn Minuten Verspätung.', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('83928019-9b6d-4f35-824f-e66c5e5f7952'::uuid, '71d7a441-0992-4548-8c3c-f87e6092a7af'::uuid, 'Der Zug fährt nicht.', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('71d7a441-0992-4548-8c3c-f87e6092a7af'::uuid, ARRAY['B']::text[], 'Zehn Minuten später bedeutet zehn Minuten Verspätung.', '{"audio_script":"Achtung auf Gleis drei. Der Zug nach Frankfurt fährt heute zehn Minuten später ab."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('3b8cb450-f64d-4de9-85b3-5b2d76aef438'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Wann ist der neue Termin?', 1, 7, '{"bank_question_id":"A1-01-H07","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('847a908d-d13d-4c59-82dc-c4ae21472686'::uuid, '3b8cb450-f64d-4de9-85b3-5b2d76aef438'::uuid, '9 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0f6edbd7-79a0-47cf-82f5-56f3a6af9a68'::uuid, '3b8cb450-f64d-4de9-85b3-5b2d76aef438'::uuid, '10 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('b1b2f4a3-6c8a-4aae-8f6d-ff17070f57c4'::uuid, '3b8cb450-f64d-4de9-85b3-5b2d76aef438'::uuid, '11 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('3b8cb450-f64d-4de9-85b3-5b2d76aef438'::uuid, ARRAY['C']::text[], 'Der neue Termin ist um elf Uhr.', '{"audio_script":"Guten Tag, hier ist die Praxis Dr. Weber. Ihr Termin morgen ist nicht um neun Uhr, sondern um elf Uhr."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('e9370278-b711-447a-888f-07c305ff750a'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Wann schließt das Geschäft?', 1, 8, '{"bank_question_id":"A1-01-H08","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('eec1cfdc-8711-4553-88ff-427c9d34b736'::uuid, 'e9370278-b711-447a-888f-07c305ff750a'::uuid, '17 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('d74a731d-0fed-4600-8819-094709b3a581'::uuid, 'e9370278-b711-447a-888f-07c305ff750a'::uuid, '18 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('035377a8-0c2a-4fdc-8e7d-feca12247dbc'::uuid, 'e9370278-b711-447a-888f-07c305ff750a'::uuid, '19 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('e9370278-b711-447a-888f-07c305ff750a'::uuid, ARRAY['A']::text[], 'Das Geschäft schließt um 17 Uhr.', '{"audio_script":"Liebe Kundinnen und Kunden, unser Geschäft schließt heute bereits um 17 Uhr."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('d5a22733-5b1e-42d4-81f3-44b224525cde'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Wo wartet Emma?', 1, 9, '{"bank_question_id":"A1-01-H09","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('f6f158e2-d5fb-464c-867a-b5b679d37258'::uuid, 'd5a22733-5b1e-42d4-81f3-44b224525cde'::uuid, 'in der Küche', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('257840e9-7fa4-4cc7-8dfe-0853956b8604'::uuid, 'd5a22733-5b1e-42d4-81f3-44b224525cde'::uuid, 'draußen vor dem Eingang', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('8d2cb207-519e-4313-85dc-35889b447721'::uuid, 'd5a22733-5b1e-42d4-81f3-44b224525cde'::uuid, 'im Auto', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('d5a22733-5b1e-42d4-81f3-44b224525cde'::uuid, ARRAY['B']::text[], 'Emma sagt: Ich sitze draußen vor dem Eingang.', '{"audio_script":"Hallo David, hier ist Emma. Ich bin schon im Restaurant. Ich sitze draußen vor dem Eingang."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('04410350-a186-4618-8150-a24b85731cff'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Wo fährt der Bus ab?', 1, 10, '{"bank_question_id":"A1-01-H10","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('727848ba-9d35-4620-8005-2c2350a35317'::uuid, '04410350-a186-4618-8150-a24b85731cff'::uuid, 'Haltestelle 5', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('482c84b0-bb6c-45fb-8538-fd44f4662b2b'::uuid, '04410350-a186-4618-8150-a24b85731cff'::uuid, 'Haltestelle 6', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('daa2def2-aed5-455f-898c-edfd93fc95d5'::uuid, '04410350-a186-4618-8150-a24b85731cff'::uuid, 'Haltestelle 7', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('04410350-a186-4618-8150-a24b85731cff'::uuid, ARRAY['C']::text[], 'Der Bus fährt von Haltestelle sieben ab.', '{"audio_script":"Der Bus zum Flughafen fährt in fünf Minuten von Haltestelle sieben."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('eb3b4b26-a0a3-4f45-89f0-e59f7fcc8f7f'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Was möchte der Mann nicht?', 1, 11, '{"bank_question_id":"A1-01-H11","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('729b619b-1ff8-4003-8d6d-e8b31451a85c'::uuid, 'eb3b4b26-a0a3-4f45-89f0-e59f7fcc8f7f'::uuid, 'Brot', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('b02468ef-c69a-4e6c-868e-b82d12546dbc'::uuid, 'eb3b4b26-a0a3-4f45-89f0-e59f7fcc8f7f'::uuid, 'Käse', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5a310358-a9cf-4ead-8190-57bff4277104'::uuid, 'eb3b4b26-a0a3-4f45-89f0-e59f7fcc8f7f'::uuid, 'Kaffee', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('eb3b4b26-a0a3-4f45-89f0-e59f7fcc8f7f'::uuid, ARRAY['C']::text[], 'Der Mann sagt ausdrücklich, dass er keinen Kaffee möchte.', '{"audio_script":"Frau: Was möchtest du zum Frühstück? Mann: Nur Brot und Käse. Kaffee möchte ich heute nicht."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('6ed8bcd2-ae22-4273-8577-0148e3b22ed4'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Wann beginnt der Kurs?', 1, 12, '{"bank_question_id":"A1-01-H12","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('d1ea03e7-c6f0-44fe-8cd9-a574b2b77a3f'::uuid, '6ed8bcd2-ae22-4273-8577-0148e3b22ed4'::uuid, '17:30', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('434cd54d-39d5-4cc0-8721-b919db112e6d'::uuid, '6ed8bcd2-ae22-4273-8577-0148e3b22ed4'::uuid, '18:30', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('d0b4f4ec-880b-478b-808b-c06e8121ec5e'::uuid, '6ed8bcd2-ae22-4273-8577-0148e3b22ed4'::uuid, '19:30', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('6ed8bcd2-ae22-4273-8577-0148e3b22ed4'::uuid, ARRAY['B']::text[], 'Halb sieben am Abend bedeutet 18:30 Uhr.', '{"audio_script":"Mann: Wann beginnt dein Deutschkurs? Frau: Um halb sieben am Abend. Mann: Also um 18:30? Frau: Genau."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('93133bf6-3ba3-446c-81f3-ed3bcc006201'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Was soll der Mann kaufen?', 1, 13, '{"bank_question_id":"A1-01-H13","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('cc9f770a-2649-4e75-8b72-fd3b91e0e6b0'::uuid, '93133bf6-3ba3-446c-81f3-ed3bcc006201'::uuid, 'Eier', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5dbc73f6-ffa7-453b-8e7b-a62aef1ce956'::uuid, '93133bf6-3ba3-446c-81f3-ed3bcc006201'::uuid, 'Milch', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('50f39c1b-8873-4cc4-8d56-e71c8855862f'::uuid, '93133bf6-3ba3-446c-81f3-ed3bcc006201'::uuid, 'Eier und Milch', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('93133bf6-3ba3-446c-81f3-ed3bcc006201'::uuid, ARRAY['B']::text[], 'Sie brauchen Milch. Eier haben sie schon.', '{"audio_script":"Frau: Wir brauchen noch Milch. Mann: Ich gehe gleich zum Supermarkt. Brauchen wir auch Eier? Frau: Nein, Eier haben wir noch."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('ae334f91-be56-4ff9-8c1c-000b1b5a7177'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Wann ist der Termin?', 1, 14, '{"bank_question_id":"A1-01-H14","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('fe67edee-be1a-46cc-83b1-0b6ae8ac8196'::uuid, 'ae334f91-be56-4ff9-8c1c-000b1b5a7177'::uuid, 'Dienstag, 14 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('62802cdc-a924-4bad-8ac3-39afae7cea83'::uuid, 'ae334f91-be56-4ff9-8c1c-000b1b5a7177'::uuid, 'Donnerstag, 12 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6a335d6b-9f48-405a-88a4-fcb57cddf9bd'::uuid, 'ae334f91-be56-4ff9-8c1c-000b1b5a7177'::uuid, 'Donnerstag, 14 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('ae334f91-be56-4ff9-8c1c-000b1b5a7177'::uuid, ARRAY['C']::text[], 'Der freie Termin ist Donnerstag um 14 Uhr.', '{"audio_script":"Mann: Guten Tag. Ich möchte einen Termin bei Frau Dr. Berger. Frau: Donnerstag um 14 Uhr ist noch frei. Mann: Ja, das passt."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('4592f1f9-11f5-4b42-8392-b6ba9351ecbc'::uuid, '4418178c-e510-4ea4-8a16-feb77348ccbb'::uuid, 'listening', 'Wann gehen sie schwimmen?', 1, 15, '{"bank_question_id":"A1-01-H15","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('8c81786d-e751-44a5-81e0-5e724fa98915'::uuid, '4592f1f9-11f5-4b42-8392-b6ba9351ecbc'::uuid, 'heute', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('61058588-952f-40d8-8c89-2fffb4f93112'::uuid, '4592f1f9-11f5-4b42-8392-b6ba9351ecbc'::uuid, 'Freitag', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('1cd11b5e-f324-4bc3-8efe-d1c491fb8455'::uuid, '4592f1f9-11f5-4b42-8392-b6ba9351ecbc'::uuid, 'Samstag', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('4592f1f9-11f5-4b42-8392-b6ba9351ecbc'::uuid, ARRAY['C']::text[], 'Sie vereinbaren Samstag.', '{"audio_script":"Frau: Kommst du mit zum Schwimmen? Mann: Heute leider nicht. Ich muss arbeiten. Am Samstag habe ich Zeit. Frau: Gut, dann Samstag."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('ee54f79b-61a8-4418-8c42-3de47d681dfe'::uuid, '28e243eb-edbb-46e1-8a00-9d8a8fd2a8a8'::uuid, 'schreiben', 'Schreiben', 3, 20)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('1a350cda-32c6-43ee-8ece-1f1d0e2e52ac'::uuid, 'ee54f79b-61a8-4418-8c42-3de47d681dfe'::uuid, 'form_fill', 'Sie möchten einen Kurs im Sportzentrum besuchen. Füllen Sie das Formular aus.', 10, 1, '{"bank_question_id":"A1-01-S01","part":1,"instruction":"Sie möchten einen Kurs im Sportzentrum besuchen. Füllen Sie das Formular aus.","passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":[{"key":"Vorname","points":2},{"key":"Nachname","points":2},{"key":"Geburtsdatum","points":2},{"key":"Adresse","points":2},{"key":"Telefonnummer","points":2}],"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('1a350cda-32c6-43ee-8ece-1f1d0e2e52ac'::uuid, ARRAY['form_fill']::text[], NULL, '{"source_data":{"Vorname":"Adam","Nachname":"El Mansouri","Geburtsdatum":"12.03.2001","Adresse":"Rosenstraße 14, 50667 Köln","Telefonnummer":"0157 45892130"},"fields":[{"key":"Vorname","points":2},{"key":"Nachname","points":2},{"key":"Geburtsdatum","points":2},{"key":"Adresse","points":2},{"key":"Telefonnummer","points":2}]}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('e23bfec3-bbd4-413e-817b-1fa43cc033da'::uuid, 'ee54f79b-61a8-4418-8c42-3de47d681dfe'::uuid, 'writing', 'Sie möchten Ihre Freundin Anna am Samstag besuchen. Schreiben Sie eine kurze Nachricht.', 10, 2, '{"bank_question_id":"A1-01-S02","part":2,"instruction":"Sie möchten Ihre Freundin Anna am Samstag besuchen. Schreiben Sie eine kurze Nachricht.","passage":null,"audio_url":null,"recommended_words":"30-40","requirements":["Sagen Sie, wann Sie kommen.","Sagen Sie, was Sie mitbringen.","Fragen Sie nach der Adresse."],"fields":null,"rubric":{"task_completion":4,"comprehensibility":2,"vocabulary":2,"grammar_and_spelling":2}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('e23bfec3-bbd4-413e-817b-1fa43cc033da'::uuid, ARRAY[]::text[], NULL, '{"sample_answer":"Hallo Anna, ich komme am Samstag gegen 15 Uhr. Ich bringe einen Kuchen und Saft mit. Kannst du mir bitte noch deine Adresse schicken? Bis Samstag! Liebe Grüße, Samir","rubric":{"task_completion":4,"comprehensibility":2,"vocabulary":2,"grammar_and_spelling":2}}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  -- A1-02
  INSERT INTO public.exams (
    id, code, title, description, instructions, level_id, duration_minutes,
    pass_percentage, status, published_at, max_attempts, is_mock
  ) VALUES (
    '4d7831c4-9478-4cf1-8156-e5d671adf7ba'::uuid,
    'A1-02',
    'Examen blanc A1-02',
    'Reisen & Termine',
    'Reisen & Termine · 65 min · 50 points',
    v_level_id,
    65,
    60,
    'published',
    now(),
    3,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    instructions = EXCLUDED.instructions,
    level_id = EXCLUDED.level_id,
    duration_minutes = EXCLUDED.duration_minutes,
    status = 'published',
    published_at = coalesce(public.exams.published_at, now()),
    is_mock = true,
    updated_at = now();
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, '4d7831c4-9478-4cf1-8156-e5d671adf7ba'::uuid, 'lesen', 'Lesen', 1, 15)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('8f70533d-9fbc-4077-8b18-3f2d3eceacc7'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'true_false', 'Julia kommt um 17 Uhr.', 1, 1, '{"bank_question_id":"A1-02-L01","part":1,"instruction":null,"passage":"Hallo Samir, mein Bus kommt heute erst um 17:30 Uhr. Warte bitte nicht um 17 Uhr auf mich. Bis später! Julia","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('50210151-e3d2-40eb-8ec5-274994ac425f'::uuid, '8f70533d-9fbc-4077-8b18-3f2d3eceacc7'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('b2cd668d-2f6b-49bf-8822-2c31f1725e7e'::uuid, '8f70533d-9fbc-4077-8b18-3f2d3eceacc7'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('8f70533d-9fbc-4077-8b18-3f2d3eceacc7'::uuid, ARRAY['Falsch']::text[], 'Julia kommt erst um 17:30 Uhr.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('83109bb7-8f4c-455d-8f28-0e5a4d4cdfc7'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'true_false', 'Herr Becker hat am Dienstag einen Termin.', 1, 2, '{"bank_question_id":"A1-02-L02","part":1,"instruction":null,"passage":"Guten Tag Herr Becker, Ihr Termin ist am Dienstag, den 14. Mai, um 9 Uhr. Praxis Hoffmann","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('853cf5df-a3ef-4291-82e5-8f70ea4b3878'::uuid, '83109bb7-8f4c-455d-8f28-0e5a4d4cdfc7'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('fb41dfbb-7137-4a36-82e3-e1494bba179b'::uuid, '83109bb7-8f4c-455d-8f28-0e5a4d4cdfc7'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('83109bb7-8f4c-455d-8f28-0e5a4d4cdfc7'::uuid, ARRAY['Richtig']::text[], 'Der Termin ist am Dienstag.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('fcda609d-9e90-49fa-806c-ec291ebb3578'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'true_false', 'Der Zug fährt um 8:40 Uhr.', 1, 3, '{"bank_question_id":"A1-02-L03","part":1,"instruction":null,"passage":"Hallo Mia, unser Zug fährt morgen nicht um 8:10 Uhr, sondern um 8:40 Uhr. Leon","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a1b3d6ac-e38b-4e85-8e1b-0e29eff4ca27'::uuid, 'fcda609d-9e90-49fa-806c-ec291ebb3578'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('dca038c4-29dc-4a6d-88f8-ec29f3b17ace'::uuid, 'fcda609d-9e90-49fa-806c-ec291ebb3578'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('fcda609d-9e90-49fa-806c-ec291ebb3578'::uuid, ARRAY['Richtig']::text[], 'Im Text steht ausdrücklich 8:40 Uhr.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('4968304a-a6cd-4cd3-8040-e6544086ecd6'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'true_false', 'Das Frühstück endet um 10 Uhr.', 1, 4, '{"bank_question_id":"A1-02-L04","part":1,"instruction":null,"passage":"Liebe Gäste, das Frühstück ist von 7 bis 10 Uhr im Restaurant im Erdgeschoss.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('331ea648-17a5-415b-8f83-c12077f90c33'::uuid, '4968304a-a6cd-4cd3-8040-e6544086ecd6'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0b4dccd7-2c6f-4341-875b-6d725dfae49f'::uuid, '4968304a-a6cd-4cd3-8040-e6544086ecd6'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('4968304a-a6cd-4cd3-8040-e6544086ecd6'::uuid, ARRAY['Richtig']::text[], 'Das Frühstück ist bis 10 Uhr.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('8bcd2260-48eb-4ad3-8d8d-cf47a34c4a04'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'true_false', 'Lara geht am Montag zum Arzt.', 1, 5, '{"bank_question_id":"A1-02-L05","part":1,"instruction":null,"passage":"Hallo Tom, ich kann am Montag nicht zum Arzt gehen. Ich habe jetzt einen neuen Termin am Mittwoch. Lara","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('e4a2cfdd-487d-4a0c-8315-95b939b1429d'::uuid, '8bcd2260-48eb-4ad3-8d8d-cf47a34c4a04'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('850b1b84-ef99-48eb-842e-039796f29d09'::uuid, '8bcd2260-48eb-4ad3-8d8d-cf47a34c4a04'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('8bcd2260-48eb-4ad3-8d8d-cf47a34c4a04'::uuid, ARRAY['Falsch']::text[], 'Der neue Termin ist am Mittwoch.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('6a379961-d960-4205-81a2-b5400c32d0c8'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'single_choice', 'Ein Bus fährt um 15:00 Uhr. Wann fährt der nächste?', 1, 6, '{"bank_question_id":"A1-02-L06","part":2,"instruction":null,"passage":"Flughafen-Bus. Abfahrt alle 30 Minuten. 06:00-22:00 Uhr.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('cc8fecce-cc5f-4c8a-8cc2-872893b18ea3'::uuid, '6a379961-d960-4205-81a2-b5400c32d0c8'::uuid, '15:15', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('70ed3b7f-339b-407a-8d20-a8a4927e82ad'::uuid, '6a379961-d960-4205-81a2-b5400c32d0c8'::uuid, '15:30', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c3269bfe-985a-4317-8e12-f107b256fac9'::uuid, '6a379961-d960-4205-81a2-b5400c32d0c8'::uuid, '16:00', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('6a379961-d960-4205-81a2-b5400c32d0c8'::uuid, ARRAY['B']::text[], 'Der Bus fährt alle 30 Minuten.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('c239b0f9-5c4f-47e1-845a-45154151823f'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'single_choice', 'Was ist richtig?', 1, 7, '{"bank_question_id":"A1-02-L07","part":2,"instruction":null,"passage":"Hotel Rezeption. 24 Stunden geöffnet.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a5870094-3623-4e38-8994-70c9271dde2c'::uuid, 'c239b0f9-5c4f-47e1-845a-45154151823f'::uuid, 'Die Rezeption ist nur morgens geöffnet.', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7ba412d8-51d1-4f19-847a-baf10249f10e'::uuid, 'c239b0f9-5c4f-47e1-845a-45154151823f'::uuid, 'Die Rezeption schließt um 24 Uhr.', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('56366a37-0d8b-424b-8796-895f293c1e6d'::uuid, 'c239b0f9-5c4f-47e1-845a-45154151823f'::uuid, 'Die Rezeption ist Tag und Nacht geöffnet.', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('c239b0f9-5c4f-47e1-845a-45154151823f'::uuid, ARRAY['C']::text[], '24 Stunden geöffnet bedeutet Tag und Nacht geöffnet.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('51697607-3130-4213-8306-89c254cef4ce'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'single_choice', 'Wo fährt der Zug ab?', 1, 8, '{"bank_question_id":"A1-02-L08","part":2,"instruction":null,"passage":"Gleis 4. Zug nach Hamburg. Abfahrt 12:45 Uhr.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6868b832-d0b4-4bd3-891b-4939aea97253'::uuid, '51697607-3130-4213-8306-89c254cef4ce'::uuid, 'Gleis 2', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ad85f8f1-a434-4161-88db-ff8fadf024b2'::uuid, '51697607-3130-4213-8306-89c254cef4ce'::uuid, 'Gleis 4', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6c11e72c-4d32-48ce-8264-a4b445e52f9e'::uuid, '51697607-3130-4213-8306-89c254cef4ce'::uuid, 'Gleis 12', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('51697607-3130-4213-8306-89c254cef4ce'::uuid, ARRAY['B']::text[], 'Der Zug fährt von Gleis 4.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('671eb004-db96-42ca-8102-98629a087491'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'single_choice', 'Wo kann man heute ein Ticket kaufen?', 1, 9, '{"bank_question_id":"A1-02-L09","part":2,"instruction":null,"passage":"Heute keine Tickets am Automaten. Bitte Tickets am Schalter kaufen.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('324d05bf-7a0d-42b3-8ceb-914bb667e70b'::uuid, '671eb004-db96-42ca-8102-98629a087491'::uuid, 'am Automaten', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('d0188930-d6fd-4003-8690-b5e39c7774de'::uuid, '671eb004-db96-42ca-8102-98629a087491'::uuid, 'am Schalter', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c7ac295d-7c06-4059-88d8-5f36d1fa449d'::uuid, '671eb004-db96-42ca-8102-98629a087491'::uuid, 'im Zug', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('671eb004-db96-42ca-8102-98629a087491'::uuid, ARRAY['B']::text[], 'Heute muss man die Tickets am Schalter kaufen.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('e4fa1f07-a38a-4006-80de-2aaa3b414264'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'single_choice', 'Was müssen Hotelgäste tun?', 1, 10, '{"bank_question_id":"A1-02-L10","part":2,"instruction":null,"passage":"Check-out bis 11:00 Uhr.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3194bd28-574a-4dd5-8082-71a7bcb91547'::uuid, 'e4fa1f07-a38a-4006-80de-2aaa3b414264'::uuid, 'vor 8 Uhr frühstücken', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7fee2b26-80a2-4121-8c10-729e4f50f131'::uuid, 'e4fa1f07-a38a-4006-80de-2aaa3b414264'::uuid, 'um 11 Uhr einchecken', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ed8ef1ea-e520-495a-8296-cbf116f5bc97'::uuid, 'e4fa1f07-a38a-4006-80de-2aaa3b414264'::uuid, 'spätestens um 11 Uhr das Zimmer verlassen', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('e4fa1f07-a38a-4006-80de-2aaa3b414264'::uuid, ARRAY['C']::text[], 'Check-out bis 11 Uhr bedeutet, dass das Zimmer spätestens um 11 Uhr verlassen werden muss.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('1f02f531-de4a-43a9-8936-0ab710c50dfa'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'single_choice', 'Was kostet ein Einzelzimmer?', 1, 11, '{"bank_question_id":"A1-02-L11","part":3,"instruction":null,"passage":"Pension Sonnenschein. Einzelzimmer: 55 €. Doppelzimmer: 80 €. Frühstück inklusive.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('79a6d04c-6fb3-43a6-8521-4e493e72235f'::uuid, '1f02f531-de4a-43a9-8936-0ab710c50dfa'::uuid, '35 €', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('31f04ea7-62fc-4ddc-8dd2-725118ef685c'::uuid, '1f02f531-de4a-43a9-8936-0ab710c50dfa'::uuid, '55 €', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('eb2f4ec7-7222-48f5-8b4d-11aa642fe453'::uuid, '1f02f531-de4a-43a9-8936-0ab710c50dfa'::uuid, '80 €', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('1f02f531-de4a-43a9-8936-0ab710c50dfa'::uuid, ARRAY['B']::text[], 'Ein Einzelzimmer kostet 55 €.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('2b139a20-f0ec-4eb9-8d79-f001552e5e1c'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'single_choice', 'Wann endet die Stadtrundfahrt?', 1, 12, '{"bank_question_id":"A1-02-L12","part":3,"instruction":null,"passage":"Stadtrundfahrt Berlin. Jeden Samstag um 10 Uhr. Dauer: 2 Stunden.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('aa446974-8b31-47f0-8ee7-603671d798ef'::uuid, '2b139a20-f0ec-4eb9-8d79-f001552e5e1c'::uuid, '11 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('1caaabde-864d-405e-841a-839fa64c5598'::uuid, '2b139a20-f0ec-4eb9-8d79-f001552e5e1c'::uuid, '12 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('87873d8a-302b-47ed-851c-5e084afe3980'::uuid, '2b139a20-f0ec-4eb9-8d79-f001552e5e1c'::uuid, '14 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('2b139a20-f0ec-4eb9-8d79-f001552e5e1c'::uuid, ARRAY['B']::text[], 'Sie beginnt um 10 Uhr und dauert zwei Stunden.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('fa641ba6-591f-4181-8f66-e6385d2084de'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'single_choice', 'Was bietet Taxi Müller?', 1, 13, '{"bank_question_id":"A1-02-L13","part":3,"instruction":null,"passage":"Taxi Müller. Tag und Nacht erreichbar.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5752ac5b-e108-45f7-80cd-a35ca5555e7f'::uuid, 'fa641ba6-591f-4181-8f66-e6385d2084de'::uuid, 'nur Fahrten am Tag', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('4ab5ba3b-f04b-4faa-8cb6-0edeaee98fbb'::uuid, 'fa641ba6-591f-4181-8f66-e6385d2084de'::uuid, 'nur Fahrten am Wochenende', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0d0e12ac-b1d2-4be6-8a44-9b97fa8ce581'::uuid, 'fa641ba6-591f-4181-8f66-e6385d2084de'::uuid, 'Fahrten zu jeder Tageszeit', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('fa641ba6-591f-4181-8f66-e6385d2084de'::uuid, ARRAY['C']::text[], 'Tag und Nacht bedeutet zu jeder Tageszeit.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('bdd77620-e4f0-41fc-886a-44310f01c6ac'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'single_choice', 'Wann ist das Reisebüro sonntags geöffnet?', 1, 14, '{"bank_question_id":"A1-02-L14","part":3,"instruction":null,"passage":"Reisebüro Weltweit. Montag-Freitag: 9-18 Uhr. Samstag: 9-13 Uhr. Sonntag: geschlossen.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('9d2681ff-5f92-4790-8cda-ab95bef38833'::uuid, 'bdd77620-e4f0-41fc-886a-44310f01c6ac'::uuid, '9-13 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('e6181b10-922a-45f7-8f14-304cdefc8ef2'::uuid, 'bdd77620-e4f0-41fc-886a-44310f01c6ac'::uuid, '9-18 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('246ed818-c357-4f83-8f8d-32149cefc4de'::uuid, 'bdd77620-e4f0-41fc-886a-44310f01c6ac'::uuid, 'gar nicht', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('bdd77620-e4f0-41fc-886a-44310f01c6ac'::uuid, ARRAY['C']::text[], 'Am Sonntag ist das Reisebüro geschlossen.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('1fecea9f-4db7-45c2-8429-ffd1cc11773d'::uuid, '77e86c12-6272-478f-8ce5-bb7c5b2c8dee'::uuid, 'single_choice', 'Was ist kostenlos?', 1, 15, '{"bank_question_id":"A1-02-L15","part":3,"instruction":null,"passage":"Hotel am See. WLAN kostenlos. Parkplatz: 8 € pro Tag.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('76451c9a-a366-45fa-882e-b5633896ec68'::uuid, '1fecea9f-4db7-45c2-8429-ffd1cc11773d'::uuid, 'der Parkplatz', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('f870136d-570e-4731-805d-6254959450ca'::uuid, '1fecea9f-4db7-45c2-8429-ffd1cc11773d'::uuid, 'das WLAN', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('2db4ec64-0ad0-40ed-8da8-69b4dc589acd'::uuid, '1fecea9f-4db7-45c2-8429-ffd1cc11773d'::uuid, 'das Frühstück', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('1fecea9f-4db7-45c2-8429-ffd1cc11773d'::uuid, ARRAY['B']::text[], 'Im Text steht WLAN kostenlos.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('13671128-4c3a-4976-8753-d3a35506db05'::uuid, '4d7831c4-9478-4cf1-8156-e5d671adf7ba'::uuid, 'hoeren', 'Hören', 2, 15)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('72e94eb5-0e1c-404f-8980-713be033cbb2'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Wann fährt der Zug?', 1, 1, '{"bank_question_id":"A1-02-H01","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ae8f6ab6-8d12-475d-87e1-62fc02c4f47e'::uuid, '72e94eb5-0e1c-404f-8980-713be033cbb2'::uuid, '10:05', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7703afd9-e190-4021-8e27-bac417ecf649'::uuid, '72e94eb5-0e1c-404f-8980-713be033cbb2'::uuid, '10:25', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('84099645-d240-4392-876e-e4a67a0d80d4'::uuid, '72e94eb5-0e1c-404f-8980-713be033cbb2'::uuid, '10:45', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('72e94eb5-0e1c-404f-8980-713be033cbb2'::uuid, ARRAY['B']::text[], 'Der Mann sagt: zehn Uhr fünfundzwanzig.', '{"audio_script":"Frau: Wann fährt unser Zug? Mann: Um zehn Uhr fünfundzwanzig. Frau: Gut, dann haben wir noch zwanzig Minuten."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('93e0e261-cb8c-4f8a-817b-a3eadcc688cf'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Welches Gleis sucht der Mann?', 1, 2, '{"bank_question_id":"A1-02-H02","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('43a9b54b-c59e-4a89-8d1c-3d0a40815212'::uuid, '93e0e261-cb8c-4f8a-817b-a3eadcc688cf'::uuid, '5', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6f4b3a39-1152-4799-8537-22802d638063'::uuid, '93e0e261-cb8c-4f8a-817b-a3eadcc688cf'::uuid, '6', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c68fc576-e83c-478d-884d-2fa6c7cc3d80'::uuid, '93e0e261-cb8c-4f8a-817b-a3eadcc688cf'::uuid, '7', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('93e0e261-cb8c-4f8a-817b-a3eadcc688cf'::uuid, ARRAY['B']::text[], 'Der Mann fragt nach Gleis sechs.', '{"audio_script":"Mann: Entschuldigung, wo ist Gleis sechs? Frau: Dort rechts, neben Gleis fünf."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('716023fb-9e34-4437-8d6a-3020efc4fe13'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Wie lange bleibt der Mann?', 1, 3, '{"bank_question_id":"A1-02-H03","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('61de72e4-b081-4891-8c71-7c60d475a7ac'::uuid, '716023fb-9e34-4437-8d6a-3020efc4fe13'::uuid, 'zwei Tage', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('bba1567c-74a6-47c6-8560-a6c9607ff5d3'::uuid, '716023fb-9e34-4437-8d6a-3020efc4fe13'::uuid, 'drei Tage', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3780dcf0-b56f-4af2-896b-2994cfd4745a'::uuid, '716023fb-9e34-4437-8d6a-3020efc4fe13'::uuid, 'eine Woche', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('716023fb-9e34-4437-8d6a-3020efc4fe13'::uuid, ARRAY['B']::text[], 'Der Mann sagt ausdrücklich drei Tage.', '{"audio_script":"Frau: Wie lange bleiben Sie in München? Mann: Drei Tage. Von Freitag bis Sonntag."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('05e2e4f9-c82f-4dd3-8891-55362c8a0c06'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Was möchte der Mann?', 1, 4, '{"bank_question_id":"A1-02-H04","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('d8206fbb-c9c5-452e-8e77-6b3fc4ecdffc'::uuid, '05e2e4f9-c82f-4dd3-8891-55362c8a0c06'::uuid, 'ein Doppelzimmer', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('bce1ee71-e5be-4200-81a1-59ac970d4c56'::uuid, '05e2e4f9-c82f-4dd3-8891-55362c8a0c06'::uuid, 'ein Einzelzimmer', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('1a46b7d7-a259-497e-8a88-dd47300ee5f6'::uuid, '05e2e4f9-c82f-4dd3-8891-55362c8a0c06'::uuid, 'eine Wohnung', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('05e2e4f9-c82f-4dd3-8891-55362c8a0c06'::uuid, ARRAY['B']::text[], 'Der Mann möchte ein Einzelzimmer.', '{"audio_script":"Mann: Ein Einzelzimmer für zwei Nächte, bitte. Frau: Das kostet 60 Euro pro Nacht."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('986e98db-7739-4db0-8442-41656e2e164c'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Wann treffen sie sich?', 1, 5, '{"bank_question_id":"A1-02-H05","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5166c11d-0567-4f91-8163-7408a23f3320'::uuid, '986e98db-7739-4db0-8442-41656e2e164c'::uuid, '15:00', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('d43e50f0-04c7-4ab4-8587-cd9290603a62'::uuid, '986e98db-7739-4db0-8442-41656e2e164c'::uuid, '15:30', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('67e9f333-51f6-4731-8c10-da0eb9d1e159'::uuid, '986e98db-7739-4db0-8442-41656e2e164c'::uuid, '16:30', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('986e98db-7739-4db0-8442-41656e2e164c'::uuid, ARRAY['B']::text[], 'Halb vier bedeutet 15:30 Uhr.', '{"audio_script":"Frau: Treffen wir uns um drei Uhr? Mann: Das ist zu früh. Geht auch halb vier? Frau: Ja, gut."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('47abdc89-4238-4a4b-87bd-98cfb9247d7a'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Wo fährt der Zug ab?', 1, 6, '{"bank_question_id":"A1-02-H06","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('49aed339-ce0f-45bb-83af-5ff0578601fb'::uuid, '47abdc89-4238-4a4b-87bd-98cfb9247d7a'::uuid, 'Gleis 5', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('fa07e693-8d7b-4f9b-81f1-86a5df2b7629'::uuid, '47abdc89-4238-4a4b-87bd-98cfb9247d7a'::uuid, 'Gleis 8', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('284d8660-3040-493f-8e63-7f44324d25a9'::uuid, '47abdc89-4238-4a4b-87bd-98cfb9247d7a'::uuid, 'Gleis 13', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('47abdc89-4238-4a4b-87bd-98cfb9247d7a'::uuid, ARRAY['B']::text[], 'Heute fährt der Zug von Gleis acht.', '{"audio_script":"Achtung. Der Zug nach Köln fährt heute von Gleis acht statt von Gleis fünf."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('7d24d973-35fd-4ff0-8a36-c7c0e76780be'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Bis wann gibt es Frühstück?', 1, 7, '{"bank_question_id":"A1-02-H07","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('4066b5cc-6c9d-4c70-8464-1e154ff6a49a'::uuid, '7d24d973-35fd-4ff0-8a36-c7c0e76780be'::uuid, '10:00', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0f6200dd-c18b-48e6-89c5-4b85fb48b62d'::uuid, '7d24d973-35fd-4ff0-8a36-c7c0e76780be'::uuid, '10:30', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('cb74bdde-5946-43ff-8d1a-9e50ba9e8005'::uuid, '7d24d973-35fd-4ff0-8a36-c7c0e76780be'::uuid, '11:00', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('7d24d973-35fd-4ff0-8a36-c7c0e76780be'::uuid, ARRAY['B']::text[], 'Halb elf bedeutet 10:30 Uhr.', '{"audio_script":"Willkommen im Hotel Central. Das Frühstück gibt es morgen von sieben bis halb elf."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('034668f8-d01e-4be8-8d89-ee9f27e4f033'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Wann ist der Termin?', 1, 8, '{"bank_question_id":"A1-02-H08","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a7364483-1c78-49b7-87cb-41b1de33a4d1'::uuid, '034668f8-d01e-4be8-8d89-ee9f27e4f033'::uuid, '14 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('58876813-f6f1-42bc-8daf-f9b7b43167e2'::uuid, '034668f8-d01e-4be8-8d89-ee9f27e4f033'::uuid, '15 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('924877b7-038f-42d2-88dc-e25a8aa48e42'::uuid, '034668f8-d01e-4be8-8d89-ee9f27e4f033'::uuid, '16 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('034668f8-d01e-4be8-8d89-ee9f27e4f033'::uuid, ARRAY['C']::text[], 'Der neue Termin ist um 16 Uhr.', '{"audio_script":"Hallo Frau Keller. Ihr Termin beim Arzt ist morgen nicht um 14 Uhr. Bitte kommen Sie um 16 Uhr."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('fc164894-94d0-42ec-8062-84a0fc65cb04'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Was ist passiert?', 1, 9, '{"bank_question_id":"A1-02-H09","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('2e671d33-5605-4070-8d11-ea156c71016a'::uuid, 'fc164894-94d0-42ec-8062-84a0fc65cb04'::uuid, 'Der Flug startet früher.', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('686b2410-6286-4919-8a36-e0a63ff2bd19'::uuid, 'fc164894-94d0-42ec-8062-84a0fc65cb04'::uuid, 'Der Flug hat Verspätung.', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ce249834-348f-49d1-8992-12e9f7cd99a8'::uuid, 'fc164894-94d0-42ec-8062-84a0fc65cb04'::uuid, 'Der Flug ist abgesagt.', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('fc164894-94d0-42ec-8062-84a0fc65cb04'::uuid, ARRAY['B']::text[], '25 Minuten später bedeutet Verspätung.', '{"audio_script":"Der Flug nach Paris startet heute 25 Minuten später."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('be71f193-1230-41ed-8133-8dc39174b14f'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Wann kommt der Bus?', 1, 10, '{"bank_question_id":"A1-02-H10","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7f4923c9-b456-4393-8ffc-a506c542a168'::uuid, 'be71f193-1230-41ed-8133-8dc39174b14f'::uuid, 'sofort', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6dafee37-f58b-42fd-8142-c68beedd03cf'::uuid, 'be71f193-1230-41ed-8133-8dc39174b14f'::uuid, 'in fünf Minuten', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('dfef91fe-7109-4033-872f-c0b338319576'::uuid, 'be71f193-1230-41ed-8133-8dc39174b14f'::uuid, 'in zehn Minuten', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('be71f193-1230-41ed-8133-8dc39174b14f'::uuid, ARRAY['C']::text[], 'Die Ansage sagt: in zehn Minuten.', '{"audio_script":"Liebe Fahrgäste, der nächste Bus zum Hauptbahnhof kommt in zehn Minuten."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('2a194330-5cbf-46f2-875a-af378978b249'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Wie möchte der Mann fahren?', 1, 11, '{"bank_question_id":"A1-02-H11","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('737c6210-687c-4b80-8cb9-81083b2f14ef'::uuid, '2a194330-5cbf-46f2-875a-af378978b249'::uuid, 'mit dem Bus', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('e6f2676a-c43e-4dd0-8dbb-43051830a9b6'::uuid, '2a194330-5cbf-46f2-875a-af378978b249'::uuid, 'mit dem Zug', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('4ef5c1da-dc04-4f95-8120-51344172c25d'::uuid, '2a194330-5cbf-46f2-875a-af378978b249'::uuid, 'mit dem Auto', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('2a194330-5cbf-46f2-875a-af378978b249'::uuid, ARRAY['B']::text[], 'Der Mann möchte mit dem Zug fahren.', '{"audio_script":"Frau: Möchtest du lieber mit dem Zug oder mit dem Bus fahren? Mann: Mit dem Zug. Das geht schneller."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('1e167a6a-3914-4bf3-8fbf-b3050a386983'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Wann fahren sie nach Hause?', 1, 12, '{"bank_question_id":"A1-02-H12","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('68db28d1-d6e7-41fc-8c10-42c95c04286c'::uuid, '1e167a6a-3914-4bf3-8fbf-b3050a386983'::uuid, 'Freitag', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3bc79bdc-211d-4942-835e-baa20653069e'::uuid, '1e167a6a-3914-4bf3-8fbf-b3050a386983'::uuid, 'Samstag', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7d17f939-44b3-447a-8675-6a6d03c8fea7'::uuid, '1e167a6a-3914-4bf3-8fbf-b3050a386983'::uuid, 'Sonntag', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('1e167a6a-3914-4bf3-8fbf-b3050a386983'::uuid, ARRAY['C']::text[], 'Am Sonntag fahren sie nach Hause.', '{"audio_script":"Mann: Hast du das Hotel schon gebucht? Frau: Ja, für Freitag und Samstag. Am Sonntag fahren wir nach Hause."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('3be6b444-7375-49fb-8159-7b6ff982fa97'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Wann öffnet das Museum?', 1, 13, '{"bank_question_id":"A1-02-H13","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ae9c6442-73fe-4605-8315-b8407331e241'::uuid, '3be6b444-7375-49fb-8159-7b6ff982fa97'::uuid, '8 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('f09f375a-81c3-4589-84cb-fedee75c6dbf'::uuid, '3be6b444-7375-49fb-8159-7b6ff982fa97'::uuid, '9 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('52ab7399-61c5-4ac1-881f-7b89728abdb3'::uuid, '3be6b444-7375-49fb-8159-7b6ff982fa97'::uuid, '10 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('3be6b444-7375-49fb-8159-7b6ff982fa97'::uuid, ARRAY['C']::text[], 'Das Museum öffnet um zehn Uhr.', '{"audio_script":"Frau: Entschuldigung, wann öffnet das Museum? Mann: Um zehn Uhr. Heute ist es bis 18 Uhr geöffnet."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('d7924b4d-576d-4187-8ec6-df394cc52f17'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Wo hat der Mann einen Termin?', 1, 14, '{"bank_question_id":"A1-02-H14","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('2fda9057-2908-40a7-815d-d75b9f9359f5'::uuid, 'd7924b4d-576d-4187-8ec6-df394cc52f17'::uuid, 'beim Zahnarzt', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('4573c078-c391-46ac-8aee-880aa2733fa0'::uuid, 'd7924b4d-576d-4187-8ec6-df394cc52f17'::uuid, 'beim Augenarzt', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('f2e7a3ee-1fc2-4e5a-8cca-7eb8aea34645'::uuid, 'd7924b4d-576d-4187-8ec6-df394cc52f17'::uuid, 'im Krankenhaus', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('d7924b4d-576d-4187-8ec6-df394cc52f17'::uuid, ARRAY['B']::text[], 'Der Mann sagt, dass der Termin beim Augenarzt ist.', '{"audio_script":"Mann: Ich habe morgen um neun Uhr einen Termin. Frau: Beim Zahnarzt? Mann: Nein, beim Augenarzt."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('f4bc90d8-8b5b-4544-8f0d-3067790c38a6'::uuid, '13671128-4c3a-4976-8753-d3a35506db05'::uuid, 'listening', 'Wie fahren sie zum Flughafen?', 1, 15, '{"bank_question_id":"A1-02-H15","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('078eadf9-4f7b-4f77-8af1-33336fbd7599'::uuid, 'f4bc90d8-8b5b-4544-8f0d-3067790c38a6'::uuid, 'mit dem Bus', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3c919700-2646-48c0-817f-de76f2237117'::uuid, 'f4bc90d8-8b5b-4544-8f0d-3067790c38a6'::uuid, 'mit dem Zug', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('fc02b5cb-2dfb-4a41-895e-25f3d106c7a0'::uuid, 'f4bc90d8-8b5b-4544-8f0d-3067790c38a6'::uuid, 'mit dem Taxi', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('f4bc90d8-8b5b-4544-8f0d-3067790c38a6'::uuid, ARRAY['C']::text[], 'Sie nehmen ein Taxi.', '{"audio_script":"Frau: Wie kommen wir zum Flughafen? Mann: Wir nehmen ein Taxi. Der Bus dauert zu lange."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('a810071e-7154-400c-85bc-3cb68a27057c'::uuid, '4d7831c4-9478-4cf1-8156-e5d671adf7ba'::uuid, 'schreiben', 'Schreiben', 3, 20)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('c9ac07c7-044a-44d3-8a5e-5fa8a1021ae7'::uuid, 'a810071e-7154-400c-85bc-3cb68a27057c'::uuid, 'form_fill', 'Sie sind in einem Hotel in Hamburg. Füllen Sie das Formular aus.', 10, 1, '{"bank_question_id":"A1-02-S01","part":1,"instruction":"Sie sind in einem Hotel in Hamburg. Füllen Sie das Formular aus.","passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":[{"key":"Vorname","points":2},{"key":"Nachname","points":2},{"key":"Geburtsdatum","points":2},{"key":"Wohnort","points":2},{"key":"Nächte","points":2}],"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('c9ac07c7-044a-44d3-8a5e-5fa8a1021ae7'::uuid, ARRAY['form_fill']::text[], NULL, '{"source_data":{"Vorname":"Sofia","Nachname":"Benali","Geburtsdatum":"05.09.2002","Wohnort":"Casablanca","Nächte":"3"},"fields":[{"key":"Vorname","points":2},{"key":"Nachname","points":2},{"key":"Geburtsdatum","points":2},{"key":"Wohnort","points":2},{"key":"Nächte","points":2}]}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('872dcb42-a818-443b-8231-0d7e3b6a22ff'::uuid, 'a810071e-7154-400c-85bc-3cb68a27057c'::uuid, 'writing', 'Sie fahren zu Ihrem Freund Daniel. Ihr Zug hat Verspätung. Schreiben Sie Daniel.', 10, 2, '{"bank_question_id":"A1-02-S02","part":2,"instruction":"Sie fahren zu Ihrem Freund Daniel. Ihr Zug hat Verspätung. Schreiben Sie Daniel.","passage":null,"audio_url":null,"recommended_words":"30-40","requirements":["Sagen Sie, warum Sie zu spät kommen.","Sagen Sie Ihre neue Ankunftszeit.","Bitten Sie Daniel, auf Sie zu warten."],"fields":null,"rubric":{"task_completion":4,"comprehensibility":2,"vocabulary":2,"grammar_and_spelling":2}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('872dcb42-a818-443b-8231-0d7e3b6a22ff'::uuid, ARRAY[]::text[], NULL, '{"sample_answer":"Hallo Daniel, mein Zug hat leider Verspätung. Ich komme nicht um 18 Uhr, sondern gegen 19 Uhr an. Kannst du bitte am Bahnhof auf mich warten? Bis später! Amir","rubric":{"task_completion":4,"comprehensibility":2,"vocabulary":2,"grammar_and_spelling":2}}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  -- A1-03
  INSERT INTO public.exams (
    id, code, title, description, instructions, level_id, duration_minutes,
    pass_percentage, status, published_at, max_attempts, is_mock
  ) VALUES (
    'fe66a632-8b08-4005-87b9-d527b7558d37'::uuid,
    'A1-03',
    'Examen blanc A1-03',
    'Wohnen & Freizeit',
    'Wohnen & Freizeit · 65 min · 50 points',
    v_level_id,
    65,
    60,
    'published',
    now(),
    3,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    instructions = EXCLUDED.instructions,
    level_id = EXCLUDED.level_id,
    duration_minutes = EXCLUDED.duration_minutes,
    status = 'published',
    published_at = coalesce(public.exams.published_at, now()),
    is_mock = true,
    updated_at = now();
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'fe66a632-8b08-4005-87b9-d527b7558d37'::uuid, 'lesen', 'Lesen', 1, 15)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('d068d8eb-2e1f-472d-8e8b-9667b9e41968'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'true_false', 'Lena braucht am Samstag Hilfe.', 1, 1, '{"bank_question_id":"A1-03-L01","part":1,"instruction":null,"passage":"Hallo Emma, ich ziehe am Samstag in meine neue Wohnung. Kannst du mir am Nachmittag helfen? Lena","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('0177129a-78bc-48fc-864c-621c0e86fd1a'::uuid, 'd068d8eb-2e1f-472d-8e8b-9667b9e41968'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('4c5e2130-154a-474b-8be7-cc0ed1b82afb'::uuid, 'd068d8eb-2e1f-472d-8e8b-9667b9e41968'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('d068d8eb-2e1f-472d-8e8b-9667b9e41968'::uuid, ARRAY['Richtig']::text[], 'Lena fragt Emma, ob sie ihr am Samstag helfen kann.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('b7546894-7a33-42a3-88f8-018c9d6f2739'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'true_false', 'Max spielt heute Fußball.', 1, 2, '{"bank_question_id":"A1-03-L02","part":1,"instruction":null,"passage":"Lieber Ben, heute kann ich nicht Fußball spielen. Ich muss bis 19 Uhr arbeiten. Max","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c237ed53-976b-49e4-8e63-3f773adaa612'::uuid, 'b7546894-7a33-42a3-88f8-018c9d6f2739'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('592d1b99-1d9c-4e2d-80ec-fa0951905de4'::uuid, 'b7546894-7a33-42a3-88f8-018c9d6f2739'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('b7546894-7a33-42a3-88f8-018c9d6f2739'::uuid, ARRAY['Falsch']::text[], 'Max kann heute nicht Fußball spielen, weil er arbeitet.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('de1ded0d-a2b7-419a-8067-d62799bbfd8a'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'true_false', 'Der Film beginnt um 19:30 Uhr.', 1, 3, '{"bank_question_id":"A1-03-L03","part":1,"instruction":null,"passage":"Hallo Marie, der Film beginnt um 20 Uhr. Treffen wir uns um 19:30 Uhr vor dem Kino? Anna","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('40f2d513-fedc-4a6c-864c-a6c1c5b6b015'::uuid, 'de1ded0d-a2b7-419a-8067-d62799bbfd8a'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ae82d365-6266-42bd-8eb4-6badd21ad172'::uuid, 'de1ded0d-a2b7-419a-8067-d62799bbfd8a'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('de1ded0d-a2b7-419a-8067-d62799bbfd8a'::uuid, ARRAY['Falsch']::text[], 'Sie treffen sich um 19:30 Uhr, aber der Film beginnt um 20 Uhr.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('f3f107e0-1766-4a57-8d4a-569fb10a9b9d'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'true_false', 'Der Techniker kommt wegen eines Problems mit der Heizung.', 1, 4, '{"bank_question_id":"A1-03-L04","part":1,"instruction":null,"passage":"Guten Tag Frau Klein, der Techniker kommt morgen zwischen 9 und 11 Uhr wegen Ihrer Heizung.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c68f8915-35a2-44b7-827f-9168a59fb8b1'::uuid, 'f3f107e0-1766-4a57-8d4a-569fb10a9b9d'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7d9d79ae-23ad-4806-87f7-87f652742b91'::uuid, 'f3f107e0-1766-4a57-8d4a-569fb10a9b9d'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('f3f107e0-1766-4a57-8d4a-569fb10a9b9d'::uuid, ARRAY['Richtig']::text[], 'Der Techniker kommt wegen der Heizung.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('7bc68f0c-7d5d-4477-8c40-25968dd40108'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'true_false', 'David soll Getränke mitbringen.', 1, 5, '{"bank_question_id":"A1-03-L05","part":1,"instruction":null,"passage":"Hi David, am Sonntag machen wir ein Picknick im Stadtpark. Bring bitte etwas zu trinken mit.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('49fed48a-c502-400b-8c4f-7dcd2cfff09c'::uuid, '7bc68f0c-7d5d-4477-8c40-25968dd40108'::uuid, 'Richtig', 'Richtig', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3334d7a2-c4f5-4018-82da-5fada6ee66b8'::uuid, '7bc68f0c-7d5d-4477-8c40-25968dd40108'::uuid, 'Falsch', 'Falsch', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('7bc68f0c-7d5d-4477-8c40-25968dd40108'::uuid, ARRAY['Richtig']::text[], 'David soll etwas zu trinken mitbringen.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('17adc2dc-ece5-4e75-846f-9835f673cf8d'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'single_choice', 'Wann kann man nicht schwimmen?', 1, 6, '{"bank_question_id":"A1-03-L06","part":2,"instruction":null,"passage":"Schwimmbad. Montag geschlossen.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c99a803b-b540-40a5-8330-b80a4407d469'::uuid, '17adc2dc-ece5-4e75-846f-9835f673cf8d'::uuid, 'Sonntag', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ae90764f-bbdc-4523-8653-66d693a069ca'::uuid, '17adc2dc-ece5-4e75-846f-9835f673cf8d'::uuid, 'Montag', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('221c1c50-657c-4e6e-8bdd-c429c99d1292'::uuid, '17adc2dc-ece5-4e75-846f-9835f673cf8d'::uuid, 'Dienstag', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('17adc2dc-ece5-4e75-846f-9835f673cf8d'::uuid, ARRAY['B']::text[], 'Das Schwimmbad ist am Montag geschlossen.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('22173ef8-3e1c-410e-8ced-176a6abc1140'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'single_choice', 'Was soll man hier machen?', 1, 7, '{"bank_question_id":"A1-03-L07","part":2,"instruction":null,"passage":"Bitte Fahrräder hier abstellen.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('9dc2f4b6-7db3-409e-8001-b5aa6719a63c'::uuid, '22173ef8-3e1c-410e-8ced-176a6abc1140'::uuid, 'Autos parken', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('f1729e2f-da01-4b93-87a4-8cf49ff5d39e'::uuid, '22173ef8-3e1c-410e-8ced-176a6abc1140'::uuid, 'Fahrräder abstellen', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a9cc5923-8d1d-4a4e-8302-cab8f30d9d17'::uuid, '22173ef8-3e1c-410e-8ced-176a6abc1140'::uuid, 'Fahrräder verkaufen', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('22173ef8-3e1c-410e-8ced-176a6abc1140'::uuid, ARRAY['B']::text[], 'Hier sollen Fahrräder abgestellt werden.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('d4004653-a323-4fd1-8e0f-aeb07ad4a6a3'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'single_choice', 'Was bedeutet das?', 1, 8, '{"bank_question_id":"A1-03-L08","part":2,"instruction":null,"passage":"Ruhe bitte ab 22 Uhr.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('96fcd107-f85b-488e-85b9-97317d27cb9c'::uuid, 'd4004653-a323-4fd1-8e0f-aeb07ad4a6a3'::uuid, 'Nach 22 Uhr Musik machen.', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('fcf4934d-a792-4afe-8f09-90c318f56447'::uuid, 'd4004653-a323-4fd1-8e0f-aeb07ad4a6a3'::uuid, 'Um 22 Uhr das Haus verlassen.', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('fad46aca-0476-48ce-8f34-5182f3a864b8'::uuid, 'd4004653-a323-4fd1-8e0f-aeb07ad4a6a3'::uuid, 'Nach 22 Uhr leise sein.', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('d4004653-a323-4fd1-8e0f-aeb07ad4a6a3'::uuid, ARRAY['C']::text[], 'Ab 22 Uhr soll man leise sein.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('70cf326a-b108-4a8b-8892-d713a68d11c3'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'single_choice', 'Wann öffnet das Fitnessstudio sonntags?', 1, 9, '{"bank_question_id":"A1-03-L09","part":2,"instruction":null,"passage":"Fitnessstudio. Neue Öffnungszeiten: Mo-Fr 07:00-22:00. Sa-So 09:00-18:00.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('11a95b68-fb13-454b-87d9-27860586451a'::uuid, '70cf326a-b108-4a8b-8892-d713a68d11c3'::uuid, '7 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('92ac6d0e-3f56-4a6d-8f51-8a8a25c80f41'::uuid, '70cf326a-b108-4a8b-8892-d713a68d11c3'::uuid, '8 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6831d40a-ca14-4924-817b-730f1cdf1a60'::uuid, '70cf326a-b108-4a8b-8892-d713a68d11c3'::uuid, '9 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('70cf326a-b108-4a8b-8892-d713a68d11c3'::uuid, ARRAY['C']::text[], 'Am Wochenende öffnet das Fitnessstudio um 9 Uhr.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('1803911f-5ce6-411f-8591-e6ed30fec660'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'single_choice', 'Wann beginnt der Film?', 1, 10, '{"bank_question_id":"A1-03-L10","part":2,"instruction":null,"passage":"Kino 3 - Filmstart 18:45","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('b94e7ff9-519a-4561-8a7e-84ed8df1fe03'::uuid, '1803911f-5ce6-411f-8591-e6ed30fec660'::uuid, '18:15', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('65bc101a-bb47-499f-8039-c5f7ac36fe15'::uuid, '1803911f-5ce6-411f-8591-e6ed30fec660'::uuid, '18:45', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3ad57c73-b759-4003-84b4-00d5c3850302'::uuid, '1803911f-5ce6-411f-8591-e6ed30fec660'::uuid, '19:45', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('1803911f-5ce6-411f-8591-e6ed30fec660'::uuid, ARRAY['B']::text[], 'Der Film startet um 18:45 Uhr.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('9ecd70f7-0097-4c00-80ca-c71ca4e1bcec'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'single_choice', 'Wie viele Zimmer hat die Wohnung?', 1, 11, '{"bank_question_id":"A1-03-L11","part":3,"instruction":null,"passage":"Wohnung zu vermieten. 2 Zimmer, Küche, Bad. 650 € monatlich. Nähe Stadtzentrum.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a49fb551-7e87-4ed3-86cb-44de6ddb3785'::uuid, '9ecd70f7-0097-4c00-80ca-c71ca4e1bcec'::uuid, '1', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c802f602-408f-474c-800f-25325437783d'::uuid, '9ecd70f7-0097-4c00-80ca-c71ca4e1bcec'::uuid, '2', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7057d42d-6e38-4ce3-8f34-5573019b117b'::uuid, '9ecd70f7-0097-4c00-80ca-c71ca4e1bcec'::uuid, '3', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('9ecd70f7-0097-4c00-80ca-c71ca4e1bcec'::uuid, ARRAY['B']::text[], 'Die Wohnung hat zwei Zimmer.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('f49778d1-7e3c-450d-81df-91a00f134293'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'single_choice', 'Wann ist das Training?', 1, 12, '{"bank_question_id":"A1-03-L12","part":3,"instruction":null,"passage":"Tennisclub Nord. Training mittwochs um 18 Uhr. Anfänger willkommen.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('eac22d04-c404-4a60-8bd1-4727c96cee5f'::uuid, 'f49778d1-7e3c-450d-81df-91a00f134293'::uuid, 'Montag', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a66874cf-403f-4472-8b52-bdd966cee0a2'::uuid, 'f49778d1-7e3c-450d-81df-91a00f134293'::uuid, 'Mittwoch', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c78b53c0-07d5-40c3-8b2c-46ea5d1d5619'::uuid, 'f49778d1-7e3c-450d-81df-91a00f134293'::uuid, 'Freitag', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('f49778d1-7e3c-450d-81df-91a00f134293'::uuid, ARRAY['B']::text[], 'Das Training ist mittwochs.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('fd0577ac-f891-4bea-87fd-a8b2d72fc8b3'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'single_choice', 'Was kostet der Eintritt?', 1, 13, '{"bank_question_id":"A1-03-L13","part":3,"instruction":null,"passage":"Konzert im Stadtpark. Samstag, 20 Uhr. Eintritt frei.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5c60e305-312d-4194-8819-f9600355d603'::uuid, 'fd0577ac-f891-4bea-87fd-a8b2d72fc8b3'::uuid, '5 €', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c3d0d881-ecc9-4c03-80e0-2e5d70377f8d'::uuid, 'fd0577ac-f891-4bea-87fd-a8b2d72fc8b3'::uuid, '20 €', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('af650520-8cea-4ce2-8265-e35f6576cd39'::uuid, 'fd0577ac-f891-4bea-87fd-a8b2d72fc8b3'::uuid, 'nichts', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('fd0577ac-f891-4bea-87fd-a8b2d72fc8b3'::uuid, ARRAY['C']::text[], 'Eintritt frei bedeutet kostenlos.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('9229ec56-4834-48bc-8886-319b8c6e8083'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'single_choice', 'Was kann man kostenlos benutzen?', 1, 14, '{"bank_question_id":"A1-03-L14","part":3,"instruction":null,"passage":"Stadtbibliothek. Bücher, Zeitschriften und kostenloses WLAN.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('55365c69-3c48-4d94-8fe2-407fb01b4dde'::uuid, '9229ec56-4834-48bc-8886-319b8c6e8083'::uuid, 'das Café', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('f1e6de94-4956-4d39-89a3-4b8d54f9f003'::uuid, '9229ec56-4834-48bc-8886-319b8c6e8083'::uuid, 'das WLAN', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('78e0e07d-bf30-4078-883f-6c1269db9d35'::uuid, '9229ec56-4834-48bc-8886-319b8c6e8083'::uuid, 'den Parkplatz', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('9229ec56-4834-48bc-8886-319b8c6e8083'::uuid, ARRAY['B']::text[], 'Das WLAN ist kostenlos.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('5fc985ad-3e10-41c5-8609-e7b0f0232f1f'::uuid, '886f44e5-9790-435d-8832-c4441c7a4b08'::uuid, 'single_choice', 'Wann kann man Pizza bestellen?', 1, 15, '{"bank_question_id":"A1-03-L15","part":3,"instruction":null,"passage":"Pizza Bella. Lieferung täglich von 17 bis 23 Uhr.","audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('bfe09a20-6f5d-4631-8778-2e4b9ecf8415'::uuid, '5fc985ad-3e10-41c5-8609-e7b0f0232f1f'::uuid, '12 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('9f9aa752-0fec-41b1-83ba-c2ff5b19b7f8'::uuid, '5fc985ad-3e10-41c5-8609-e7b0f0232f1f'::uuid, '20 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('babcafa6-2953-412a-8272-ea3bed9b8922'::uuid, '5fc985ad-3e10-41c5-8609-e7b0f0232f1f'::uuid, 'Mitternacht', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('5fc985ad-3e10-41c5-8609-e7b0f0232f1f'::uuid, ARRAY['B']::text[], '20 Uhr liegt zwischen 17 und 23 Uhr.', '{}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'fe66a632-8b08-4005-87b9-d527b7558d37'::uuid, 'hoeren', 'Hören', 2, 15)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('c5fe7d20-6a94-4169-84c3-4d9757adc959'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Wie viele Zimmer hat die Wohnung?', 1, 1, '{"bank_question_id":"A1-03-H01","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('b0f01a36-f0b7-4b3f-83b2-b70912a6b121'::uuid, 'c5fe7d20-6a94-4169-84c3-4d9757adc959'::uuid, 'zwei', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('42961d17-9a66-46eb-8398-85a2e328a4d9'::uuid, 'c5fe7d20-6a94-4169-84c3-4d9757adc959'::uuid, 'drei', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ec04e6f7-4de0-4fea-877c-cb86e986a592'::uuid, 'c5fe7d20-6a94-4169-84c3-4d9757adc959'::uuid, 'vier', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('c5fe7d20-6a94-4169-84c3-4d9757adc959'::uuid, ARRAY['B']::text[], 'Die Wohnung hat drei Zimmer.', '{"audio_script":"Frau: Wie groß ist deine Wohnung? Mann: Sie hat drei Zimmer."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('1def7a97-7320-4d8e-8ca5-98b8cafe5912'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Was macht die Frau?', 1, 2, '{"bank_question_id":"A1-03-H02","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c12dd65c-d8b2-423b-80bf-976a7e21759d'::uuid, '1def7a97-7320-4d8e-8ca5-98b8cafe5912'::uuid, 'laufen', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('76f2757f-bb32-4107-8f6b-a4164d783030'::uuid, '1def7a97-7320-4d8e-8ca5-98b8cafe5912'::uuid, 'schwimmen', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('cb6ddb4c-ebe2-44b6-8d75-5a880187fa93'::uuid, '1def7a97-7320-4d8e-8ca5-98b8cafe5912'::uuid, 'Tennis spielen', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('1def7a97-7320-4d8e-8ca5-98b8cafe5912'::uuid, ARRAY['B']::text[], 'Die Frau sagt, dass sie schwimmen geht.', '{"audio_script":"Mann: Gehst du heute laufen? Frau: Nein, heute gehe ich schwimmen."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('0c916d6b-be66-4145-8b0c-0926f4985df1'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Wann beginnt das Konzert?', 1, 3, '{"bank_question_id":"A1-03-H03","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('aee8a6e7-dc6a-4496-81ed-7988cd2b61f4'::uuid, '0c916d6b-be66-4145-8b0c-0926f4985df1'::uuid, '18 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('c80d8516-9742-4df3-8125-3f91f1621bbb'::uuid, '0c916d6b-be66-4145-8b0c-0926f4985df1'::uuid, '20 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('4964f252-b3ff-4018-8f7c-225d88b122a3'::uuid, '0c916d6b-be66-4145-8b0c-0926f4985df1'::uuid, '22 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('0c916d6b-be66-4145-8b0c-0926f4985df1'::uuid, ARRAY['B']::text[], 'Acht Uhr abends bedeutet 20 Uhr.', '{"audio_script":"Frau: Wann beginnt das Konzert? Mann: Um acht Uhr abends."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('6156114a-7965-4f67-8054-6c9fc8d581a1'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Was möchten sie machen?', 1, 4, '{"bank_question_id":"A1-03-H04","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7c3d3a9f-a715-450b-8a2e-964af89aaf67'::uuid, '6156114a-7965-4f67-8054-6c9fc8d581a1'::uuid, 'ins Kino gehen', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('69fb1490-2f71-4b9f-8399-37249594ab57'::uuid, '6156114a-7965-4f67-8054-6c9fc8d581a1'::uuid, 'picknicken', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('fcd3d5b1-6e4d-434d-844f-49cec600fa9e'::uuid, '6156114a-7965-4f67-8054-6c9fc8d581a1'::uuid, 'arbeiten', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('6156114a-7965-4f67-8054-6c9fc8d581a1'::uuid, ARRAY['B']::text[], 'Sie möchten im Park picknicken.', '{"audio_script":"Mann: Was machen wir Samstag? Frau: Das Wetter ist schön. Wir können im Park picknicken."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('c981a908-af44-4886-814b-8ea436131a5a'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Wie kommt man schnell zum Bahnhof?', 1, 5, '{"bank_question_id":"A1-03-H05","part":1,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('f7a56bf7-67f8-4a66-8df3-fccee6f64b4c'::uuid, 'c981a908-af44-4886-814b-8ea436131a5a'::uuid, 'zu Fuß', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('74300cbf-f543-43d5-8a87-e7cb3c1586d8'::uuid, 'c981a908-af44-4886-814b-8ea436131a5a'::uuid, 'mit dem Flugzeug', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('420dc630-f73e-4847-8fe1-e9d816fbe20c'::uuid, 'c981a908-af44-4886-814b-8ea436131a5a'::uuid, 'mit dem Zug', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('c981a908-af44-4886-814b-8ea436131a5a'::uuid, ARRAY['A']::text[], 'Der Bahnhof ist nur fünf Minuten zu Fuß entfernt.', '{"audio_script":"Frau: Ist deine Wohnung weit vom Bahnhof? Mann: Nein, nur fünf Minuten zu Fuß."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('e0ac1aa3-f458-469f-8f33-48ea489f784d'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Wann schließt das Schwimmbad?', 1, 6, '{"bank_question_id":"A1-03-H06","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('811876d3-babb-4f78-8aea-30ac19cdec61'::uuid, 'e0ac1aa3-f458-469f-8f33-48ea489f784d'::uuid, '16 Uhr', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5ea24589-cd47-49ca-8ece-636dc417aae4'::uuid, 'e0ac1aa3-f458-469f-8f33-48ea489f784d'::uuid, '17 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('67427df1-5d17-4fd5-8f73-4b40fdcb96f4'::uuid, 'e0ac1aa3-f458-469f-8f33-48ea489f784d'::uuid, '18 Uhr', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('e0ac1aa3-f458-469f-8f33-48ea489f784d'::uuid, ARRAY['B']::text[], 'Das Schwimmbad schließt um 17 Uhr.', '{"audio_script":"Liebe Besucher, das Schwimmbad schließt heute bereits um 17 Uhr."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('12f2e815-b6ee-42e5-8aa3-70d19bbbb028'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Wo läuft der Film?', 1, 7, '{"bank_question_id":"A1-03-H07","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('05c725bd-367c-4341-8a34-9374028cb84c'::uuid, '12f2e815-b6ee-42e5-8aa3-70d19bbbb028'::uuid, 'Saal 1', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('721cba99-c6bc-4135-8534-6a05559e3d62'::uuid, '12f2e815-b6ee-42e5-8aa3-70d19bbbb028'::uuid, 'Saal 2', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('bc95957e-473a-4bc6-8cf3-501c3edd672b'::uuid, '12f2e815-b6ee-42e5-8aa3-70d19bbbb028'::uuid, 'Saal 3', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('12f2e815-b6ee-42e5-8aa3-70d19bbbb028'::uuid, ARRAY['B']::text[], 'Der Film läuft in Saal zwei.', '{"audio_script":"Heute Abend beginnt der Film im Kino Saal zwei um 19:30 Uhr."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('6b2b7872-b688-4316-8a58-23c0efa7e80b'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Wann kommt der Techniker?', 1, 8, '{"bank_question_id":"A1-03-H08","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('5908c1e8-1234-4861-89e0-3d819c5fb208'::uuid, '6b2b7872-b688-4316-8a58-23c0efa7e80b'::uuid, 'morgens zwischen 8 und 9', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('1e257651-bf2d-4d82-86e5-cbf1ea747911'::uuid, '6b2b7872-b688-4316-8a58-23c0efa7e80b'::uuid, 'zwischen 10 und 12 Uhr', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3b6c3527-9ff9-4469-8073-e4ed960b90ab'::uuid, '6b2b7872-b688-4316-8a58-23c0efa7e80b'::uuid, 'abends', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('6b2b7872-b688-4316-8a58-23c0efa7e80b'::uuid, ARRAY['B']::text[], 'Der Techniker kommt zwischen 10 und 12 Uhr.', '{"audio_script":"Hallo Herr Braun. Morgen kommt unser Techniker zwischen 10 und 12 Uhr zu Ihnen."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('6503068f-3878-4b48-8cef-22c6e4c27a92'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Was ist richtig?', 1, 9, '{"bank_question_id":"A1-03-H09","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('17ae5cc8-c9d0-41a8-8e38-46be66cf1fda'::uuid, '6503068f-3878-4b48-8cef-22c6e4c27a92'::uuid, 'Das Studio öffnet später.', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('631daafa-bbba-4003-8b4c-11d3172b0f53'::uuid, '6503068f-3878-4b48-8cef-22c6e4c27a92'::uuid, 'Das Studio ist heute geschlossen.', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('972b1ba1-1f55-432e-898f-2cd1c42430b6'::uuid, '6503068f-3878-4b48-8cef-22c6e4c27a92'::uuid, 'Das Studio ist nur morgens geöffnet.', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('6503068f-3878-4b48-8cef-22c6e4c27a92'::uuid, ARRAY['B']::text[], 'Das Fitnessstudio bleibt heute geschlossen.', '{"audio_script":"Das Fitnessstudio ist heute wegen eines Feiertags geschlossen."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('cc2c55de-11df-4e2c-8b97-f81ebb874b61'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Wo ist das Fest?', 1, 10, '{"bank_question_id":"A1-03-H10","part":2,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('876fb6a4-c042-4abc-8663-37bc9d4a8ed0'::uuid, 'cc2c55de-11df-4e2c-8b97-f81ebb874b61'::uuid, 'im Stadtpark', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('3fae7d13-c0e4-4a57-806d-283e410a343d'::uuid, 'cc2c55de-11df-4e2c-8b97-f81ebb874b61'::uuid, 'auf dem Marktplatz', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6e61cb29-73a7-4ee1-822e-c2d24cb9722b'::uuid, 'cc2c55de-11df-4e2c-8b97-f81ebb874b61'::uuid, 'am Bahnhof', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('cc2c55de-11df-4e2c-8b97-f81ebb874b61'::uuid, ARRAY['B']::text[], 'Das Fest findet auf dem Marktplatz statt.', '{"audio_script":"Am Samstag findet das Straßenfest nicht im Stadtpark, sondern auf dem Marktplatz statt."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('1c42bccf-269b-4967-8881-1a8ff883b42b'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Was möchte der Mann machen?', 1, 11, '{"bank_question_id":"A1-03-H11","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ffa83fcb-a989-4437-82d7-dc561738ef55'::uuid, '1c42bccf-269b-4967-8881-1a8ff883b42b'::uuid, 'fernsehen', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('8040d7bd-feaa-4e8f-8339-9896b37fee4a'::uuid, '1c42bccf-269b-4967-8881-1a8ff883b42b'::uuid, 'lesen', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('289d99bd-530c-4bec-89c6-c51bd3b0748b'::uuid, '1c42bccf-269b-4967-8881-1a8ff883b42b'::uuid, 'schlafen', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('1c42bccf-269b-4967-8881-1a8ff883b42b'::uuid, ARRAY['B']::text[], 'Der Mann möchte lieber ein Buch lesen.', '{"audio_script":"Frau: Möchtest du heute Abend fernsehen? Mann: Nein, ich möchte lieber ein Buch lesen."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('bfde9599-ec80-431f-8fa3-21be0195eef4'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Wie hoch ist die Miete?', 1, 12, '{"bank_question_id":"A1-03-H12","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('b2a3a713-42a5-48c8-81ae-630bc27599bf'::uuid, 'bfde9599-ec80-431f-8fa3-21be0195eef4'::uuid, '600 €', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ea44ff11-7764-4ef9-8c43-820864fd90b1'::uuid, 'bfde9599-ec80-431f-8fa3-21be0195eef4'::uuid, '700 €', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('71061c12-a049-43e5-8532-7ccbb771060b'::uuid, 'bfde9599-ec80-431f-8fa3-21be0195eef4'::uuid, '800 €', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('bfde9599-ec80-431f-8fa3-21be0195eef4'::uuid, ARRAY['B']::text[], 'Die Miete beträgt 700 Euro im Monat.', '{"audio_script":"Mann: Wie viel kostet deine Miete? Frau: 700 Euro im Monat, inklusive Wasser."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('d05299d5-ff67-42c0-8464-634bc5e03e5b'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Wann fahren sie Fahrrad?', 1, 13, '{"bank_question_id":"A1-03-H13","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('dc0cd25e-1fda-4f79-8bf4-f6fbdbcced7f'::uuid, 'd05299d5-ff67-42c0-8464-634bc5e03e5b'::uuid, 'Samstagabend', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('6befe8f9-22e3-400a-88a2-0b2b91697aea'::uuid, 'd05299d5-ff67-42c0-8464-634bc5e03e5b'::uuid, 'Sonntagvormittag', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('54526f82-7493-4641-84fc-ed731a25d776'::uuid, 'd05299d5-ff67-42c0-8464-634bc5e03e5b'::uuid, 'Sonntagnachmittag', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('d05299d5-ff67-42c0-8464-634bc5e03e5b'::uuid, ARRAY['B']::text[], 'Sie fahren am Sonntagvormittag Fahrrad.', '{"audio_script":"Frau: Sollen wir am Sonntag Fahrrad fahren? Mann: Ja, aber am Vormittag. Am Nachmittag besuche ich meine Eltern."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('47d566f4-9246-492e-8676-876662049ab0'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Wo ist der Schlüssel?', 1, 14, '{"bank_question_id":"A1-03-H14","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('44040ac9-d69a-4bcf-82a0-8929cb57c85a'::uuid, '47d566f4-9246-492e-8676-876662049ab0'::uuid, 'im Schlafzimmer', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('7799c8f9-ca1c-433f-87f1-a47e374c7784'::uuid, '47d566f4-9246-492e-8676-876662049ab0'::uuid, 'im Auto', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('be893985-609b-4374-8871-46ca817daebe'::uuid, '47d566f4-9246-492e-8676-876662049ab0'::uuid, 'in der Küche', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('47d566f4-9246-492e-8676-876662049ab0'::uuid, ARRAY['C']::text[], 'Der Schlüssel liegt auf dem Tisch in der Küche.', '{"audio_script":"Mann: Wo ist mein Schlüssel? Frau: Er liegt auf dem Tisch in der Küche."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('55324824-39ce-41a7-8582-a2c9297022d8'::uuid, 'b4d00944-a291-4676-86c9-6b068f7049d4'::uuid, 'listening', 'Warum kommt der Mann nicht?', 1, 15, '{"bank_question_id":"A1-03-H15","part":3,"instruction":null,"passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":null,"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('a42e99c0-9429-4bb8-8e73-5f3c2f41c464'::uuid, '55324824-39ce-41a7-8582-a2c9297022d8'::uuid, 'Er arbeitet.', 'A', 1)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('ed6bcb45-faa1-4e09-8e5b-c659bfe6883d'::uuid, '55324824-39ce-41a7-8582-a2c9297022d8'::uuid, 'Er hat Kopfschmerzen.', 'B', 2)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_question_options (id, question_id, label, value, sort_order)
  VALUES ('199cbb6d-2976-4a0c-8904-d5e08d27efc7'::uuid, '55324824-39ce-41a7-8582-a2c9297022d8'::uuid, 'Er reist.', 'C', 3)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('55324824-39ce-41a7-8582-a2c9297022d8'::uuid, ARRAY['B']::text[], 'Der Mann bleibt wegen Kopfschmerzen zu Hause.', '{"audio_script":"Frau: Kommst du heute zum Sport? Mann: Nein, ich habe Kopfschmerzen. Ich bleibe zu Hause."}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_sections (id, exam_id, skill, title, sort_order, max_score)
  VALUES ('73af47f4-cb9a-45c5-8968-32f056d04634'::uuid, 'fe66a632-8b08-4005-87b9-d527b7558d37'::uuid, 'schreiben', 'Schreiben', 3, 20)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, skill = EXCLUDED.skill, sort_order = EXCLUDED.sort_order, max_score = EXCLUDED.max_score;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('6300105d-4e77-4a5b-82c1-5044ed31fdb6'::uuid, '73af47f4-cb9a-45c5-8968-32f056d04634'::uuid, 'form_fill', 'Sie möchten Mitglied in einem Sportverein werden. Füllen Sie das Formular aus.', 10, 1, '{"bank_question_id":"A1-03-S01","part":1,"instruction":"Sie möchten Mitglied in einem Sportverein werden. Füllen Sie das Formular aus.","passage":null,"audio_url":null,"recommended_words":null,"requirements":null,"fields":[{"key":"Vorname","points":2},{"key":"Nachname","points":2},{"key":"Geburtsdatum","points":2},{"key":"Sport","points":2},{"key":"Telefonnummer","points":2}],"rubric":null}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('6300105d-4e77-4a5b-82c1-5044ed31fdb6'::uuid, ARRAY['form_fill']::text[], NULL, '{"source_data":{"Vorname":"Lina","Nachname":"Haddad","Geburtsdatum":"21.06.2000","Sport":"Schwimmen","Telefonnummer":"0162 3378451"},"fields":[{"key":"Vorname","points":2},{"key":"Nachname","points":2},{"key":"Geburtsdatum","points":2},{"key":"Sport","points":2},{"key":"Telefonnummer","points":2}]}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
  INSERT INTO public.exam_questions (id, section_id, type, prompt, points, sort_order, metadata)
  VALUES ('bf8d3162-592f-423b-8a48-ba146c236b22'::uuid, '73af47f4-cb9a-45c5-8968-32f056d04634'::uuid, 'writing', 'Sie machen am Sonntag ein Picknick im Park. Schreiben Sie Ihrem Freund Lukas.', 10, 2, '{"bank_question_id":"A1-03-S02","part":2,"instruction":"Sie machen am Sonntag ein Picknick im Park. Schreiben Sie Ihrem Freund Lukas.","passage":null,"audio_url":null,"recommended_words":"30-40","requirements":["Laden Sie Lukas ein.","Sagen Sie die Uhrzeit.","Sagen Sie, wo Sie sich treffen."],"fields":null,"rubric":{"task_completion":4,"comprehensibility":2,"vocabulary":2,"grammar_and_spelling":2}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, prompt = EXCLUDED.prompt, points = EXCLUDED.points, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata;
  INSERT INTO public.exam_answer_keys (question_id, correct_values, explanation, teacher_payload)
  VALUES ('bf8d3162-592f-423b-8a48-ba146c236b22'::uuid, ARRAY[]::text[], NULL, '{"sample_answer":"Hallo Lukas, wir machen am Sonntag ein Picknick im Stadtpark. Hast du Zeit? Wir treffen uns um 13 Uhr vor dem Eingang vom Park. Kommst du auch? Liebe Grüße, Sara","rubric":{"task_completion":4,"comprehensibility":2,"vocabulary":2,"grammar_and_spelling":2}}'::jsonb)
  ON CONFLICT (question_id) DO UPDATE SET correct_values = EXCLUDED.correct_values, explanation = EXCLUDED.explanation, teacher_payload = EXCLUDED.teacher_payload;
END $$;