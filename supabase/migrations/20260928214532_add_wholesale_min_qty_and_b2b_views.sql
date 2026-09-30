-- 1. Schema & Backfill Strategy
ALTER TABLE catalog.products ADD COLUMN wholesale_min_quantity INTEGER DEFAULT 0 NOT NULL;

UPDATE catalog.products SET wholesale_min_quantity = 1 WHERE wholesale_price_cents > 0;

ALTER TABLE catalog.products ADD CONSTRAINT chk_wholesale_rules 
CHECK (
    (wholesale_price_cents = 0 AND wholesale_min_quantity = 0) 
    OR 
    (wholesale_price_cents > 0 AND wholesale_min_quantity >= 1)
);

-- 2. Reconstruccion Segura de RPC get_public_products_by_slug
DROP FUNCTION IF EXISTS public.get_public_products_by_slug(VARCHAR, VARCHAR, VARCHAR, INT, INT);

CREATE FUNCTION public.get_public_products_by_slug(
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
    availability_status VARCHAR,
    total_count BIGINT,
    wholesale_price_cents INT,
    wholesale_min_quantity INT
)
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_page INT;
    v_limit INT;
    v_offset INT;
    v_tenant_id UUID;
    v_is_b2b_authorized BOOLEAN := FALSE;
BEGIN
    v_page := GREATEST(COALESCE(p_page, 1), 1);
    v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 24);
    v_offset := (v_page - 1) * v_limit;

    -- Resolver Tenant
    SELECT t.id INTO v_tenant_id FROM core.tenants t WHERE t.slug = p_tenant_slug AND t.status = 'active';

    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Resolver Autorizacion B2B
    IF auth.uid() IS NOT NULL THEN
        v_is_b2b_authorized := EXISTS (
            SELECT 1 FROM core.tenant_memberships tm
            WHERE tm.user_id = auth.uid()
              AND tm.tenant_id = v_tenant_id
              AND tm.status = 'active'
        );
    END IF;

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
        CASE
            WHEN p.stock > 20 THEN 'AVAILABLE'::VARCHAR
            WHEN p.stock >= 1 AND p.stock <= 20 THEN 'LOW_STOCK'::VARCHAR
            WHEN p.stock = 0 THEN 'OUT_OF_STOCK'::VARCHAR
            ELSE 'CHECK_AVAILABILITY'::VARCHAR
        END AS availability_status,
        COUNT(*) OVER() AS total_count,
        CASE WHEN v_is_b2b_authorized AND p.wholesale_price_cents > 0 THEN p.wholesale_price_cents ELSE NULL::int END AS wholesale_price_cents,
        CASE WHEN v_is_b2b_authorized AND p.wholesale_price_cents > 0 THEN p.wholesale_min_quantity ELSE NULL::int END AS wholesale_min_quantity
    FROM catalog.products p
    LEFT JOIN catalog.categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
    WHERE p.tenant_id = v_tenant_id
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


-- 3. Reconstruccion Segura de RPC get_public_product_by_id
DROP FUNCTION IF EXISTS public.get_public_product_by_id(VARCHAR, UUID);

CREATE FUNCTION public.get_public_product_by_id(
  p_tenant_slug VARCHAR,
  p_product_id UUID
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  price_cents integer,
  description VARCHAR,
  category_id UUID,
  sku VARCHAR,
  image_url VARCHAR,
  has_variants boolean,
  in_stock boolean,
  availability_status VARCHAR,
  wholesale_price_cents integer,
  wholesale_min_quantity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_tenant_id UUID;
    v_is_b2b_authorized BOOLEAN := FALSE;
BEGIN
    -- Resolver Tenant
    SELECT t.id INTO v_tenant_id FROM core.tenants t WHERE t.slug = p_tenant_slug AND t.status = 'active';

    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Resolver Autorizacion B2B
    IF auth.uid() IS NOT NULL THEN
        v_is_b2b_authorized := EXISTS (
            SELECT 1 FROM core.tenant_memberships tm
            WHERE tm.user_id = auth.uid()
              AND tm.tenant_id = v_tenant_id
              AND tm.status = 'active'
        );
    END IF;

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
        CASE
            WHEN p.stock > 20 THEN 'AVAILABLE'::VARCHAR
            WHEN p.stock >= 1 AND p.stock <= 20 THEN 'LOW_STOCK'::VARCHAR
            WHEN p.stock = 0 THEN 'OUT_OF_STOCK'::VARCHAR
            ELSE 'CHECK_AVAILABILITY'::VARCHAR
        END AS availability_status,
        CASE WHEN v_is_b2b_authorized AND p.wholesale_price_cents > 0 THEN p.wholesale_price_cents ELSE NULL::int END AS wholesale_price_cents,
        CASE WHEN v_is_b2b_authorized AND p.wholesale_price_cents > 0 THEN p.wholesale_min_quantity ELSE NULL::int END AS wholesale_min_quantity
    FROM catalog.products p
    WHERE p.tenant_id = v_tenant_id
      AND p.id = p_product_id
      AND p.status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_product_by_id(VARCHAR, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_product_by_id(VARCHAR, UUID) TO anon, authenticated;
