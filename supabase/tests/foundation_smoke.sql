-- Smoke checks for foundation (run via execute_sql as postgres / service role).
-- Expected: levels seeded, RLS on, rls_auto_enable not executable by anon.

SELECT code, name FROM public.levels ORDER BY sort_order;

SELECT c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY 1;

SELECT has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') AS anon_can_rls_auto;
SELECT has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') AS anon_can_is_admin;
SELECT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') AS auth_can_is_admin;

SELECT id, name, public FROM storage.buckets ORDER BY name;

SELECT key, is_public FROM public.app_settings ORDER BY key;
