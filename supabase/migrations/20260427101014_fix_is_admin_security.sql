/*
  # Fix is_admin() security vulnerabilities

  1. Problem
    - Function has a mutable search_path, allowing search_path injection attacks
    - anon and authenticated roles can execute the SECURITY DEFINER function
      via /rest/v1/rpc/is_admin, which is not intended

  2. Changes
    - Recreate is_admin() with SET search_path = '' to lock it down
    - Revoke EXECUTE from anon and authenticated roles
    - Only internal Postgres/RLS calls should invoke this function
*/

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT auth.uid() = 'b7073072-7865-4b98-b26e-20a493d7e159'::uuid;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated;
