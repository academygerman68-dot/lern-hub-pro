-- Phase 5: App settings + Audit logs

CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  description text,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX app_settings_is_public_idx ON public.app_settings (is_public);
CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs (actor_id);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (action);

CREATE TRIGGER app_settings_set_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, old_data, new_data, metadata)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_old_data, p_new_data, coalesce(p_metadata, '{}'::jsonb))
  RETURNING id INTO log_id;
  RETURN log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(text, text, uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_audit_log(text, text, uuid, jsonb, jsonb, jsonb) TO authenticated;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_settings_select_public_or_admin
ON public.app_settings FOR SELECT TO authenticated
USING (is_public = true OR public.is_admin());

CREATE POLICY app_settings_write_admin
ON public.app_settings FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY audit_logs_select_admin
ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_admin());

-- No direct INSERT/UPDATE/DELETE for clients; use write_audit_log SECURITY DEFINER

INSERT INTO public.app_settings (key, value, is_public, description) VALUES
  ('academy_name', '"Deutsch Academy"'::jsonb, true, 'Public academy display name'),
  ('logo_url', 'null'::jsonb, true, 'Public logo URL'),
  ('favicon_url', 'null'::jsonb, true, 'Public favicon URL'),
  ('default_language', '"en"'::jsonb, true, 'Default UI language'),
  ('available_languages', '["en","fr","de"]'::jsonb, true, 'Enabled UI languages'),
  ('support_email', '"support@deutsch-academy.local"'::jsonb, true, 'Support email'),
  ('support_phone', 'null'::jsonb, true, 'Support phone'),
  ('timezone', '"Europe/Berlin"'::jsonb, true, 'Academy timezone'),
  ('primary_color', '"#123B63"'::jsonb, true, 'Brand primary color'),
  ('secondary_color', '"#1E5A8A"'::jsonb, true, 'Brand secondary color'),
  ('payment_grace_days', '7'::jsonb, false, 'Grace period days after due date'),
  ('currency', '"EUR"'::jsonb, true, 'Default currency');
