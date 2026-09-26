-- Migration: Secure Tenant Directory V2
-- Revokes public/anon access to the global tenant directory.
-- The directory is only required by the Buyer Dashboard which is authenticated.

REVOKE ALL ON FUNCTION public.list_public_active_tenants_v2(INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_public_active_tenants_v2(INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_public_active_tenants_v2(INT, INT) TO authenticated;
