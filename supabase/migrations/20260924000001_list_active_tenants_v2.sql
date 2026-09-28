-- ==========================================
-- V5 Hardening: Tenant Directory V2
-- Adds description, logo_url, banner_url, and pagination
-- Minimum Public Projection for Marketplace
-- ==========================================

CREATE OR REPLACE FUNCTION public.list_public_active_tenants_v2(
    p_page INT DEFAULT 1,
    p_limit INT DEFAULT 24
)
RETURNS TABLE (
    name VARCHAR, 
    slug VARCHAR, 
    description VARCHAR,
    logo_url VARCHAR,
    banner_url VARCHAR,
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_page INT;
    v_limit INT;
    v_offset INT;
BEGIN
    v_page := GREATEST(COALESCE(p_page, 1), 1);
    v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100);
    v_offset := (v_page - 1) * v_limit;

    RETURN QUERY
    SELECT 
        t.name, 
        t.slug, 
        t.description,
        t.logo_url,
        t.banner_url,
        COUNT(*) OVER() AS total_count
    FROM core.tenants t
    WHERE t.status = 'active'
    ORDER BY t.name ASC, t.slug ASC
    LIMIT v_limit
    OFFSET v_offset;
END;
$$;

-- Hardening V5: Explicit Permissions
REVOKE ALL ON FUNCTION public.list_public_active_tenants_v2(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_active_tenants_v2(INT, INT) TO anon, authenticated;
