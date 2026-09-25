DROP FUNCTION IF EXISTS public.get_public_categories_by_slug(VARCHAR);

CREATE OR REPLACE FUNCTION public.get_public_categories_by_slug(p_tenant_slug VARCHAR)
RETURNS TABLE (id UUID, name VARCHAR, description TEXT)
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
