-- Auto-create students/teachers rows when a matching profile is inserted.

CREATE OR REPLACE FUNCTION public.handle_new_profile_entity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'student' THEN
    INSERT INTO public.students (profile_id)
    VALUES (NEW.id)
    ON CONFLICT (profile_id) DO NOTHING;
  ELSIF NEW.role = 'teacher' THEN
    INSERT INTO public.teachers (profile_id)
    VALUES (NEW.id)
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_entity ON public.profiles;
CREATE TRIGGER on_profile_created_entity
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_profile_entity();

REVOKE ALL ON FUNCTION public.handle_new_profile_entity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_profile_entity() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_profile_entity() FROM authenticated;
