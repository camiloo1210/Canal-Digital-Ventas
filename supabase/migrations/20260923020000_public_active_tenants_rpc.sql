-- Migration: Add list_public_active_tenants RPC for directory

CREATE OR REPLACE FUNCTION core.list_public_active_tenants()
RETURNS TABLE (id UUID, name VARCHAR, slug VARCHAR)
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.slug
    FROM core.tenants t
    WHERE t.status = 'active'
    ORDER BY t.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION core.list_public_active_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.list_public_active_tenants() TO anon, authenticated;
