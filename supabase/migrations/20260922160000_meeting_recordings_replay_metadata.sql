-- Additive metadata for Direct > Replays CRUD (URL-based rediffusions).
alter table public.meeting_recordings
  add column if not exists description text,
  add column if not exists recorded_on date;

comment on column public.meeting_recordings.description is
  'Optional staff-facing description of the replay.';
comment on column public.meeting_recordings.recorded_on is
  'Display date of the recorded session (defaults to created_at date when null).';
