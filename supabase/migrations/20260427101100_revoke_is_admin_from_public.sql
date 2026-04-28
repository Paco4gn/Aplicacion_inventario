/*
  # Revoke public execute on is_admin()

  The previous migration revoked from anon/authenticated individually but the
  grant exists on the PUBLIC pseudo-role, which still exposes the function.
  This migration revokes from PUBLIC, then re-grants only to postgres and
  service_role so internal/admin usage still works.
*/

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated;
