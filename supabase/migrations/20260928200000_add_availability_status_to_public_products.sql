-- 1. Drop existing RPCs with their exact signatures
DROP FUNCTION IF EXISTS public.get_public_products_by_slug(VARCHAR, VARCHAR, VARCHAR, INT, INT);
DROP FUNCTION IF EXISTS public.get_public_product_by_id(VARCHAR, UUID);

-- 2. Recreate get_public_products_by_slug with availability_status
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
    availability_status VARCHAR,
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
        CASE
            WHEN p.stock > 20 THEN 'AVAILABLE'::VARCHAR
            WHEN p.stock >= 1 AND p.stock <= 20 THEN 'LOW_STOCK'::VARCHAR
            WHEN p.stock = 0 THEN 'OUT_OF_STOCK'::VARCHAR
            ELSE 'CHECK_AVAILABILITY'::VARCHAR
        END AS availability_status,
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

-- 3. Recreate get_public_product_by_id with availability_status
CREATE OR REPLACE FUNCTION public.get_public_product_by_id(
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
  availability_status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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
    END AS availability_status
  FROM catalog.products p
  JOIN core.tenants t ON t.id = p.tenant_id
  WHERE t.slug = p_tenant_slug
    AND p.id = p_product_id
    AND t.status = 'active'
    AND p.status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_product_by_id(VARCHAR, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_product_by_id(VARCHAR, UUID) TO anon, authenticated;
