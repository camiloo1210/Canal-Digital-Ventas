-- =================================================================================
-- V5 Hardened RPC: get_public_product_by_id (Fix Schema Names & Types)
-- =================================================================================
-- Fixes the relation not found error by using the correct catalog schema
-- and matches VARCHAR types instead of TEXT
-- =================================================================================

DROP FUNCTION IF EXISTS public.get_public_product_by_id(text, uuid);

CREATE OR REPLACE FUNCTION public.get_public_product_by_id(
  p_tenant_slug VARCHAR,
  p_product_id uuid
)
RETURNS TABLE (
  id uuid,
  name VARCHAR,
  price_cents integer,
  description VARCHAR,
  category_id uuid,
  sku VARCHAR,
  image_url VARCHAR,
  has_variants boolean,
  in_stock boolean
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
    (p.stock > 0) AS in_stock
  FROM catalog.products p
  INNER JOIN core.tenants t ON p.tenant_id = t.id
  LEFT JOIN catalog.categories c ON p.category_id = c.id
  WHERE 
    p.id = p_product_id
    AND t.slug = p_tenant_slug
    AND t.status = 'active'
    AND p.status = 'active'
    -- Category visibility policy: if product has a category, it must be active. 
    -- If product has NO category, it is visible.
    AND (p.category_id IS NULL OR c.status = 'active');
END;
$$;

-- Secure the RPC
REVOKE ALL ON FUNCTION public.get_public_product_by_id(VARCHAR, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_product_by_id(VARCHAR, uuid) TO anon, authenticated;
