-- Kivi sync reads now include the wholesale offer so the assistant can quote it.
-- New versioned functions: the existing ones keep their return type and stay untouched.
BEGIN;

CREATE FUNCTION core.kivi_sync_get_product_with_offset_v2(p_tenant_id uuid, p_product_id uuid)
RETURNS TABLE (id uuid, tenant_id uuid, name text, price_cents integer, description text,
               stock integer, status text, version integer, kivi_version_offset integer,
               wholesale_price_cents integer, wholesale_min_quantity integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.tenant_id, p.name::text, p.price_cents, p.description::text,
           p.stock, p.status::text, p.version, COALESCE(o.version_offset, 0),
           p.wholesale_price_cents, p.wholesale_min_quantity
    FROM catalog.products p
    JOIN core.kivi_connections c ON c.tenant_id = p.tenant_id AND c.status <> 'unlinked'
    LEFT JOIN core.kivi_product_version_offsets o
      ON o.tenant_id = p.tenant_id AND o.product_id = p.id
    WHERE p.tenant_id = p_tenant_id AND p.id = p_product_id;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_get_product_with_offset_v2(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_get_product_with_offset_v2(uuid, uuid) TO kivi_sync_worker_role;

CREATE FUNCTION core.kivi_sync_list_products_with_offset_v2(
  p_tenant_id uuid, p_after_id uuid, p_limit integer
)
RETURNS TABLE (id uuid, tenant_id uuid, name text, price_cents integer, description text,
               stock integer, status text, version integer, kivi_version_offset integer,
               wholesale_price_cents integer, wholesale_min_quantity integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.tenant_id, p.name::text, p.price_cents, p.description::text,
           p.stock, p.status::text, p.version, COALESCE(o.version_offset, 0),
           p.wholesale_price_cents, p.wholesale_min_quantity
    FROM catalog.products p
    JOIN core.kivi_connections c ON c.tenant_id = p.tenant_id AND c.status <> 'unlinked'
    LEFT JOIN core.kivi_product_version_offsets o
      ON o.tenant_id = p.tenant_id AND o.product_id = p.id
    WHERE p.tenant_id = p_tenant_id AND (p_after_id IS NULL OR p.id > p_after_id)
    ORDER BY p.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_list_products_with_offset_v2(uuid, uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_list_products_with_offset_v2(uuid, uuid, integer) TO kivi_sync_worker_role;

COMMIT;
