-- Optional Sprechen oral answers: private student audio + media columns.
-- Additive only; existing exams without speaking sections are unchanged.

alter table public.exam_answers
  add column if not exists answer_media_bucket text,
  add column if not exists answer_media_path text,
  add column if not exists answer_mime_type text;

comment on column public.exam_answers.answer_media_bucket is
  'Private storage bucket for oral (Sprechen) student audio.';
comment on column public.exam_answers.answer_media_path is
  'Storage path exam-oral/{attempt_id}/{student_id}/{question_id}-*.ext';

create index if not exists exam_answers_media_path_idx
  on public.exam_answers (answer_media_bucket, answer_media_path)
  where answer_media_path is not null;

-- Ensure webm/ogg allowed for MediaRecorder deposits (idempotent).
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct m order by m)
  from unnest(
    coalesce(allowed_mime_types, array[]::text[])
    || array['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/m4a']
  ) as m
)
where id = 'course-materials';

-- Path contract: exam-oral/{attempt_id}/{student_id}/{filename}
drop policy if exists course_materials_exam_oral_insert on storage.objects;
create policy course_materials_exam_oral_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-materials'
  and public.is_active_user()
  and public.current_student_id() is not null
  and (storage.foldername(name))[1] = 'exam-oral'
  and (storage.foldername(name))[3] = public.current_student_id()::text
  and exists (
    select 1
    from public.exam_attempts ea
    where ea.id = ((storage.foldername(name))[2])::uuid
      and ea.student_id = public.current_student_id()
      and ea.status = 'in_progress'
  )
);

drop policy if exists course_materials_exam_oral_select on storage.objects;
create policy course_materials_exam_oral_select
on storage.objects for select to authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = 'exam-oral'
  and (
    public.is_admin()
    or public.is_teacher()
    or (
      public.current_student_id() is not null
      and (storage.foldername(name))[3] = public.current_student_id()::text
    )
  )
);

drop policy if exists course_materials_exam_oral_update on storage.objects;
create policy course_materials_exam_oral_update
on storage.objects for update to authenticated
using (
  bucket_id = 'course-materials'
  and public.is_active_user()
  and public.current_student_id() is not null
  and (storage.foldername(name))[1] = 'exam-oral'
  and (storage.foldername(name))[3] = public.current_student_id()::text
)
with check (
  bucket_id = 'course-materials'
  and public.is_active_user()
  and public.current_student_id() is not null
  and (storage.foldername(name))[1] = 'exam-oral'
  and (storage.foldername(name))[3] = public.current_student_id()::text
  and exists (
    select 1
    from public.exam_attempts ea
    where ea.id = ((storage.foldername(name))[2])::uuid
      and ea.student_id = public.current_student_id()
      and ea.status = 'in_progress'
  )
);

drop policy if exists course_materials_exam_oral_delete on storage.objects;
create policy course_materials_exam_oral_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'course-materials'
  and (
    public.is_admin()
    or (
      public.current_student_id() is not null
      and (storage.foldername(name))[1] = 'exam-oral'
      and (storage.foldername(name))[3] = public.current_student_id()::text
    )
  )
);

-- Persist oral media metadata after private upload (student + in-progress attempt).
create or replace function public.save_exam_oral_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_bucket text,
  p_path text,
  p_mime_type text default null,
  p_flagged boolean default false
)
returns public.exam_answers
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row public.exam_attempts;
  q_type text;
  answer_row public.exam_answers;
  payload jsonb;
begin
  if p_bucket is null or nullif(trim(p_bucket), '') is null then
    raise exception 'BUCKET_REQUIRED';
  end if;
  if p_path is null or nullif(trim(p_path), '') is null then
    raise exception 'PATH_REQUIRED';
  end if;

  select * into attempt_row from public.exam_attempts where id = p_attempt_id for update;
  if attempt_row.id is null then
    raise exception 'ATTEMPT_NOT_FOUND';
  end if;
  if attempt_row.status <> 'in_progress' then
    raise exception 'ATTEMPT_NOT_EDITABLE';
  end if;
  if attempt_row.student_id <> public.current_student_id() and not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select eq.type::text
  into q_type
  from public.exam_questions eq
  join public.exam_sections es on es.id = eq.section_id
  where eq.id = p_question_id and es.exam_id = attempt_row.exam_id;

  if q_type is null then
    raise exception 'QUESTION_NOT_FOUND';
  end if;
  if q_type <> 'speaking' then
    raise exception 'NOT_SPEAKING_QUESTION';
  end if;

  -- Enforce path contract exam-oral/{attempt}/{student}/...
  if split_part(p_path, '/', 1) <> 'exam-oral'
     or split_part(p_path, '/', 2) <> p_attempt_id::text
     or split_part(p_path, '/', 3) <> attempt_row.student_id::text then
    raise exception 'INVALID_ORAL_PATH';
  end if;

  payload := jsonb_build_object(
    'kind', 'oral_audio',
    'bucket', p_bucket,
    'path', p_path,
    'mime_type', nullif(trim(coalesce(p_mime_type, '')), '')
  );

  insert into public.exam_answers (
    attempt_id, question_id, answer, flagged,
    answer_media_bucket, answer_media_path, answer_mime_type
  )
  values (
    p_attempt_id, p_question_id, payload, coalesce(p_flagged, false),
    p_bucket, p_path, nullif(trim(coalesce(p_mime_type, '')), '')
  )
  on conflict (attempt_id, question_id) do update set
    answer = excluded.answer,
    flagged = excluded.flagged,
    answer_media_bucket = excluded.answer_media_bucket,
    answer_media_path = excluded.answer_media_path,
    answer_mime_type = excluded.answer_mime_type,
    updated_at = now()
  returning * into answer_row;

  return answer_row;
end;
$$;

revoke all on function public.save_exam_oral_answer(uuid, uuid, text, text, text, boolean) from public;
grant execute on function public.save_exam_oral_answer(uuid, uuid, text, text, text, boolean) to authenticated;

-- Expose oral media on attempt review (student + staff).
create or replace function public.get_exam_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row public.exam_attempts;
  v_class_id uuid;
  v_level_id uuid;
  result jsonb;
begin
  select * into attempt_row from public.exam_attempts where id = p_attempt_id;
  if attempt_row.id is null then
    raise exception 'ATTEMPT_NOT_FOUND';
  end if;
  if attempt_row.status = 'in_progress' then
    raise exception 'ATTEMPT_NOT_SUBMITTED';
  end if;

  select e.class_id, e.level_id into v_class_id, v_level_id
  from public.exams e where e.id = attempt_row.exam_id;

  if not (
    public.is_admin()
    or public.teacher_can_manage_exam(v_class_id, v_level_id)
    or attempt_row.student_id = public.current_student_id()
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(jsonb_agg(row_data order by sort_section, sort_question), '[]'::jsonb)
  into result
  from (
    select
      es.sort_order as sort_section,
      eq.sort_order as sort_question,
      jsonb_build_object(
        'question_id', eq.id,
        'external_id', eq.metadata ->> 'bank_question_id',
        'skill', es.skill,
        'section_title', es.title,
        'type', eq.type,
        'prompt', eq.prompt,
        'instruction', eq.metadata ->> 'instruction',
        'passage', eq.metadata ->> 'passage',
        'points', eq.points,
        'student_answer', a.answer,
        'answer_media_bucket', a.answer_media_bucket,
        'answer_media_path', a.answer_media_path,
        'answer_mime_type', a.answer_mime_type,
        'is_correct', a.is_correct,
        'points_awarded', a.points_awarded,
        'correct_values', case
          when eq.type = 'form_fill' then null
          else ak.correct_values
        end,
        'correct_form', case
          when eq.type = 'form_fill' then ak.teacher_payload -> 'source_data'
          else null
        end,
        'explanation', ak.explanation,
        'options', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'value', o.value,
            'label', o.label
          ) order by o.sort_order), '[]'::jsonb)
          from public.exam_question_options o
          where o.question_id = eq.id
        ),
        'teacher_comment', a.teacher_comment,
        'grading_detail', a.grading_detail
      ) as row_data
    from public.exam_questions eq
    join public.exam_sections es on es.id = eq.section_id
    left join public.exam_answers a
      on a.question_id = eq.id and a.attempt_id = p_attempt_id
    left join public.exam_answer_keys ak on ak.question_id = eq.id
    where es.exam_id = attempt_row.exam_id
  ) t;

  return jsonb_build_object(
    'attempt_id', attempt_row.id,
    'status', attempt_row.status,
    'score', attempt_row.score,
    'max_score', attempt_row.max_score,
    'percentage', attempt_row.percentage,
    'skill_breakdown', attempt_row.skill_breakdown,
    'items', result
  );
end;
$$;
