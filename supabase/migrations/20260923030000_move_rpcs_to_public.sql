-- Move public RPCs to the public schema so PostgREST can expose them by default

DROP FUNCTION IF EXISTS core.get_public_tenant_by_slug(VARCHAR);
DROP FUNCTION IF EXISTS core.list_public_active_tenants();
DROP FUNCTION IF EXISTS catalog.get_public_categories_by_slug(VARCHAR);
DROP FUNCTION IF EXISTS catalog.get_public_products_by_slug(VARCHAR, UUID, VARCHAR, INT, INT);

-- Drop exacto porque el RETURNS TABLE contract cambió:
DROP FUNCTION IF EXISTS public.get_public_categories_by_slug(VARCHAR);

-- Remove explícitamente el contrato legacy basado en UUID para evitar dualidad de APIs:
DROP FUNCTION IF EXISTS public.get_public_products_by_slug(VARCHAR, UUID, VARCHAR, INT, INT);

-- Remove el RPC legacy global no-paginado (violación de seguridad V5):
DROP FUNCTION IF EXISTS public.list_public_active_tenants();


-- 1. list_public_active_tenants (REMOVED: Violates V5 Boundary)


-- 2. get_public_tenant_by_slug
CREATE OR REPLACE FUNCTION public.get_public_tenant_by_slug(p_tenant_slug VARCHAR)
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
REVOKE ALL ON FUNCTION public.get_public_tenant_by_slug(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_by_slug(VARCHAR) TO anon, authenticated;


-- 3. get_public_categories_by_slug
CREATE OR REPLACE FUNCTION public.get_public_categories_by_slug(p_tenant_slug VARCHAR)
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
REVOKE ALL ON FUNCTION public.get_public_categories_by_slug(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_categories_by_slug(VARCHAR) TO anon, authenticated;


-- 4. get_public_products_by_slug
CREATE OR REPLACE FUNCTION public.get_public_products_by_slug(
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
REVOKE ALL ON FUNCTION public.get_public_products_by_slug(VARCHAR, UUID, VARCHAR, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_products_by_slug(VARCHAR, UUID, VARCHAR, INT, INT) TO anon, authenticated;

