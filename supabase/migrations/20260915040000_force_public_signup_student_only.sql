-- Public signup / OAuth must never self-assign teacher or admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  first_name text := coalesce(NEW.raw_user_meta_data ->> 'first_name', '');
  last_name text := coalesce(NEW.raw_user_meta_data ->> 'last_name', '');
  full_name text := coalesce(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '');
BEGIN
  IF first_name = '' AND full_name <> '' THEN
    first_name := split_part(full_name, ' ', 1);
    last_name := nullif(trim(substr(full_name, length(first_name) + 1)), '');
  END IF;

  INSERT INTO public.profiles (id, role, email, first_name, last_name, language)
  VALUES (
    NEW.id,
    'student'::public.app_role,
    NEW.email,
    coalesce(first_name, ''),
    coalesce(last_name, ''),
    CASE
      WHEN NEW.raw_user_meta_data ->> 'language' IN ('en', 'fr', 'de')
        THEN (NEW.raw_user_meta_data ->> 'language')::public.app_locale
      ELSE 'en'::public.app_locale
    END
  );
  RETURN NEW;
END;
$function$;
