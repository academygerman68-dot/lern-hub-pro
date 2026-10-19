-- Google OAuth sends given_name / family_name / picture / avatar_url in raw_user_meta_data.
-- Keep public signup student+pending; only seed metadata may set other roles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  first_name text := coalesce(
    nullif(trim(NEW.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(NEW.raw_user_meta_data ->> 'given_name'), ''),
    ''
  );
  last_name text := coalesce(
    nullif(trim(NEW.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(NEW.raw_user_meta_data ->> 'family_name'), ''),
    ''
  );
  full_name text := coalesce(
    nullif(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(NEW.raw_user_meta_data ->> 'name'), ''),
    ''
  );
  avatar text := coalesce(
    nullif(trim(NEW.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(trim(NEW.raw_user_meta_data ->> 'picture'), '')
  );
  requested_role text := lower(coalesce(NEW.raw_user_meta_data ->> 'role', 'student'));
  seed_flag text := coalesce(NEW.raw_user_meta_data ->> 'seed', '');
  safe_role public.app_role := 'student';
  initial_status public.profile_status := 'pending';
BEGIN
  IF first_name = '' AND full_name <> '' THEN
    first_name := split_part(full_name, ' ', 1);
    last_name := coalesce(nullif(trim(substr(full_name, length(first_name) + 1)), ''), last_name);
  END IF;

  IF seed_flag = 'true' AND requested_role IN ('student', 'teacher', 'admin') THEN
    safe_role := requested_role::public.app_role;
    initial_status := 'active';
  ELSE
    safe_role := 'student';
    initial_status := 'pending';
  END IF;

  INSERT INTO public.profiles (
    id, role, email, first_name, last_name, language, status, phone, avatar_url
  )
  VALUES (
    NEW.id,
    safe_role,
    NEW.email,
    coalesce(first_name, ''),
    coalesce(last_name, ''),
    CASE
      WHEN NEW.raw_user_meta_data ->> 'language' IN ('en', 'fr', 'de')
        THEN (NEW.raw_user_meta_data ->> 'language')::public.app_locale
      ELSE 'fr'::public.app_locale
    END,
    initial_status,
    nullif(trim(coalesce(NEW.raw_user_meta_data ->> 'phone', '')), ''),
    avatar
  );
  RETURN NEW;
END;
$function$;
