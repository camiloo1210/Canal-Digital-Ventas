-- Migration: Fix Public Storefront Boundary
-- Replaces global views with parameterized SECURITY DEFINER RPCs

DROP VIEW IF EXISTS catalog.public_active_products;
DROP VIEW IF EXISTS catalog.public_active_categories;
DROP VIEW IF EXISTS core.public_active_tenants;

-- 1. Tenant Resolution RPC
CREATE OR REPLACE FUNCTION core.get_public_tenant_by_slug(p_tenant_slug VARCHAR)
RETURNS TABLE (id UUID, name VARCHAR, slug VARCHAR)
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.slug
    FROM core.tenants t
    WHERE t.slug = p_tenant_slug
      AND t.status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION core.get_public_tenant_by_slug(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.get_public_tenant_by_slug(VARCHAR) TO anon, authenticated;


-- 2. Categories RPC
CREATE OR REPLACE FUNCTION catalog.get_public_categories_by_slug(p_tenant_slug VARCHAR)
RETURNS TABLE (id UUID, name VARCHAR, description VARCHAR)
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.name, c.description
    FROM catalog.categories c
    JOIN core.tenants t ON t.id = c.tenant_id
    WHERE t.slug = p_tenant_slug
      AND t.status = 'active'
      AND c.status = 'active'
    ORDER BY c.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION catalog.get_public_categories_by_slug(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION catalog.get_public_categories_by_slug(VARCHAR) TO anon, authenticated;


-- 3. Products RPC
CREATE OR REPLACE FUNCTION catalog.get_public_products_by_slug(
    p_tenant_slug VARCHAR,
    p_category_id UUID DEFAULT NULL,
    p_search VARCHAR DEFAULT NULL,
    p_page INT DEFAULT 1,
    p_limit INT DEFAULT 24
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    price_cents INT,
    description VARCHAR,
    category_id UUID,
    sku VARCHAR,
    image_url VARCHAR,
    has_variants BOOLEAN,
    in_stock BOOLEAN,
    total_count BIGINT
)
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_page INT;
    v_limit INT;
    v_offset INT;
BEGIN
    -- Clamp pagination to prevent abuse
    v_page := GREATEST(COALESCE(p_page, 1), 1);
    v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 24);
    v_offset := (v_page - 1) * v_limit;

    RETURN QUERY
    SELECT 
        p.id, 
        p.name, 
        p.price_cents, 
        p.description, 
        p.category_id, 
        p.sku, 
        p.image_url, 
        p.has_variants, 
        (p.stock > 0) AS in_stock,
        COUNT(*) OVER() AS total_count
    FROM catalog.products p
    JOIN catalog.categories c ON c.id = p.category_id
    JOIN core.tenants t ON t.id = p.tenant_id
    WHERE t.slug = p_tenant_slug
      AND t.status = 'active'
      AND c.status = 'active'
      AND p.status = 'active'
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%')
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit
    OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION catalog.get_public_products_by_slug(VARCHAR, UUID, VARCHAR, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION catalog.get_public_products_by_slug(VARCHAR, UUID, VARCHAR, INT, INT) TO anon, authenticated;

