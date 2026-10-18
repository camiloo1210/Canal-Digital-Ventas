-- =================================================================================
-- V5 Hardened RPC: get_public_product_by_id
-- =================================================================================
-- Conceptually matches storefront grid listing policies:
-- tenant.slug = p_tenant_slug
-- tenant ACTIVE
-- product belongs to resolved tenant
-- product ACTIVE/publicable
-- category visibility == listing visibility (category NULL is visible)
-- =================================================================================

CREATE OR REPLACE FUNCTION public.get_public_product_by_id(
  p_tenant_slug text,
  p_product_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  price_cents integer,
  description text,
  category_id uuid,
  sku text,
  image_url text,
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
    p.in_stock
  FROM core.products p
  INNER JOIN core.tenants t ON p.tenant_id = t.id
  LEFT JOIN core.categories c ON p.category_id = c.id
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
REVOKE ALL ON FUNCTION public.get_public_product_by_id(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_product_by_id(text, uuid) TO anon, authenticated;
