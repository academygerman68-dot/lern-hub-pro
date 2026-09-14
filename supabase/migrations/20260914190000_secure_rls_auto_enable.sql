-- Keep ensure_rls event trigger + rls_auto_enable mechanism.
-- Remove unnecessary EXECUTE grants from API roles.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

-- Owner/superuser retain ability for event trigger execution.
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO postgres;
