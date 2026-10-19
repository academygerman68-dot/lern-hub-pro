-- Planned external meetings (Zoom / Google Meet) alongside Jitsi.
-- Replaces the "emergency Zoom vs normal" product distinction at creation time.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'video_provider'
      AND e.enumlabel = 'external'
  ) THEN
    ALTER TYPE public.video_provider ADD VALUE 'external';
  END IF;
END $$;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS external_meeting_url text;

COMMENT ON COLUMN public.live_sessions.external_meeting_url IS
  'HTTPS join link for Zoom or Google Meet when video_provider = external.';

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_external_meeting_url_https_chk;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_external_meeting_url_https_chk
  CHECK (
    external_meeting_url IS NULL
    OR external_meeting_url ~* '^https://([a-z0-9-]+\.)*(zoom\.us|zoom\.com\.cn)/'
    OR external_meeting_url ~* '^https://meet\.google\.com/'
  );

-- Keep join URLs out of table SELECT (same pattern as zoom_*); expose via RPC.
REVOKE ALL (external_meeting_url) ON TABLE public.live_sessions FROM anon, authenticated, public;
GRANT INSERT (external_meeting_url), UPDATE (external_meeting_url) ON TABLE public.live_sessions TO authenticated;

REVOKE SELECT ON TABLE public.live_sessions FROM anon, authenticated;
GRANT SELECT (
  id,
  title,
  class_id,
  teacher_id,
  starts_at,
  ends_at,
  status,
  meeting_provider,
  meeting_room,
  meeting_url,
  video_provider,
  created_by,
  created_at,
  updated_at
) ON TABLE public.live_sessions TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.live_session_join_target(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.live_sessions%ROWTYPE;
  staff boolean;
  join_url text;
  external_url text;
BEGIN
  IF NOT public.can_access_live_session(p_session_id) THEN
    RAISE EXCEPTION 'SESSION_ACCESS_DENIED';
  END IF;

  SELECT * INTO s FROM public.live_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_ACCESS_DENIED';
  END IF;

  staff := public.is_admin() OR public.is_teacher_of_class(s.class_id);
  join_url := nullif(trim(coalesce(s.zoom_join_url, s.zoom_url, '')), '');
  external_url := nullif(trim(coalesce(s.external_meeting_url, '')), '');

  IF s.video_provider = 'external' THEN
    IF external_url IS NULL THEN
      RAISE EXCEPTION 'EXTERNAL_URL_MISSING';
    END IF;
    RETURN jsonb_build_object(
      'provider', 'external',
      'url', external_url,
      'room', null,
      'start_url', null
    );
  END IF;

  IF s.video_provider = 'zoom' THEN
    IF join_url IS NULL THEN
      RAISE EXCEPTION 'ZOOM_URL_MISSING';
    END IF;
    RETURN jsonb_build_object(
      'provider', 'zoom',
      'url', join_url,
      'room', null,
      'start_url', CASE WHEN staff THEN nullif(trim(coalesce(s.zoom_start_url, '')), '') ELSE null END
    );
  END IF;

  RETURN jsonb_build_object(
    'provider', 'jitsi',
    'url', s.meeting_url,
    'room', s.meeting_room,
    'start_url', null
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.live_session_join_target(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.live_session_join_target(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
