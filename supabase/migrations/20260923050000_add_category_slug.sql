-- 1. Add slug column
ALTER TABLE catalog.categories ADD COLUMN slug VARCHAR(100);

-- 2. Create unaccent extension if not exists
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 3. Backfill categories
WITH normalized_categories AS (
    SELECT 
        id,
        LOWER(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    unaccent(name),
                    '[^a-zA-Z0-9]+', '-', 'g'
                ),
                '^-+|-+$', '', 'g'
            )
        ) AS base_slug,
        tenant_id
    FROM catalog.categories
),
numbered_categories AS (
    SELECT 
        id,
        tenant_id,
        base_slug,
        ROW_NUMBER() OVER (PARTITION BY tenant_id, base_slug ORDER BY id) as rn
    FROM normalized_categories
)
UPDATE catalog.categories c
SET slug = 
    CASE 
        WHEN n.rn = 1 THEN 
            LEFT(n.base_slug, 100)
        ELSE 
            LEFT(n.base_slug, 100 - LENGTH('-' || n.rn::text)) || '-' || n.rn::text
    END
FROM numbered_categories n
WHERE c.id = n.id;

-- Ensure no empty slugs were created
UPDATE catalog.categories 
SET slug = 'category-' || LEFT(id::text, 8) 
WHERE slug IS NULL OR slug = '';

-- 4. Make slug NOT NULL and UNIQUE per tenant
ALTER TABLE catalog.categories ALTER COLUMN slug SET NOT NULL;
ALTER TABLE catalog.categories ADD CONSTRAINT categories_tenant_id_slug_key UNIQUE (tenant_id, slug);

-- 5. Update RPCs
DROP FUNCTION IF EXISTS public.get_public_categories_by_slug(VARCHAR);
CREATE OR REPLACE FUNCTION public.get_public_categories_by_slug(p_tenant_slug VARCHAR)
RETURNS TABLE (slug VARCHAR, name VARCHAR, description TEXT)
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT c.slug, c.name, c.description
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


DROP FUNCTION IF EXISTS public.get_public_products_by_slug(VARCHAR, UUID, VARCHAR, INT, INT);
DROP FUNCTION IF EXISTS public.get_public_products_by_slug(VARCHAR, VARCHAR, VARCHAR, INT, INT);
CREATE OR REPLACE FUNCTION public.get_public_products_by_slug(
    p_tenant_slug VARCHAR,
    p_category_slug VARCHAR DEFAULT NULL,
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
    JOIN core.tenants t ON t.id = p.tenant_id
    LEFT JOIN catalog.categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
    WHERE t.slug = p_tenant_slug
      AND t.status = 'active'
      AND p.status = 'active'
      AND (p.category_id IS NULL OR c.status = 'active')
      AND (p_category_slug IS NULL OR c.slug = p_category_slug)
      AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%')
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit
    OFFSET v_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_products_by_slug(VARCHAR, VARCHAR, VARCHAR, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_products_by_slug(VARCHAR, VARCHAR, VARCHAR, INT, INT) TO anon, authenticated;
