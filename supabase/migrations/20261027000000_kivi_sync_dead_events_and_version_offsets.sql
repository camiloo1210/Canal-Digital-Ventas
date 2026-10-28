-- Kivi sync hardening (follows 20261020000000_kivi_connections.sql, which stays untouched).
-- 1. Product outbox events that exhausted their retries (DEAD) flag the connection for reconcile.
-- 2. Reconcile can re-base a product above a newer Kivi version; the bump is persisted per product
--    so later outbox deliveries stay monotonic. Both surfaces are narrow, tenant-scoped, SECURITY
--    DEFINER functions authorized by the worker login (same pattern as the original migration).
BEGIN;

-- One row per DEAD event already turned into a reconcile flag: makes flagging idempotent.
CREATE TABLE core.kivi_dead_event_acks (
  event_id uuid PRIMARY KEY REFERENCES core.outbox_events(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT NOW()
);
ALTER TABLE core.kivi_dead_event_acks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.kivi_dead_event_acks FROM PUBLIC, anon, authenticated, service_role;

-- Per-product amount added on top of (catalog version + 1) when sending to Kivi. Only grows.
CREATE TABLE core.kivi_product_version_offsets (
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
  version_offset integer NOT NULL CHECK (version_offset >= 0),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, product_id)
);
ALTER TABLE core.kivi_product_version_offsets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.kivi_product_version_offsets FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION core.kivi_sync_flag_dead_events()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
DECLARE
  v_flagged integer;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;

  -- Acknowledge every unacknowledged DEAD Kivi Product event of a linked tenant, once.
  WITH newly_dead AS (
    INSERT INTO core.kivi_dead_event_acks (event_id, tenant_id)
    SELECT e.id, e.tenant_id
    FROM core.outbox_events e
    JOIN core.kivi_connections c ON c.tenant_id = e.tenant_id AND c.status <> 'unlinked'
    WHERE e.status = 'DEAD'
      AND e.aggregate_type = 'Product'
      -- Must match KIVI_PRODUCT_EVENT_TYPES (kivi-events.ts) and the kivi_sync_worker_role routes.
      AND e.event_type IN (
        'ProductCreatedEvent', 'ProductDetailsChangedEvent', 'ProductPricingChangedEvent',
        'ProductStockAdjustedEvent', 'ProductArchivedEvent'
      )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING tenant_id
  ),
  flagged AS (
    UPDATE core.kivi_connections c
    SET status = 'needs_reconcile', updated_at = NOW()
    WHERE c.status = 'active'
      AND c.tenant_id IN (SELECT n.tenant_id FROM newly_dead n)
    RETURNING c.tenant_id
  )
  SELECT COUNT(*)::integer INTO v_flagged FROM flagged;
  RETURN v_flagged;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_flag_dead_events() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_flag_dead_events() TO kivi_sync_worker_role;

CREATE OR REPLACE FUNCTION core.kivi_sync_raise_version_offset(
  p_tenant_id uuid, p_product_id uuid, p_offset integer
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Invalid version offset' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM core.kivi_connections c
    WHERE c.tenant_id = p_tenant_id AND c.status <> 'unlinked'
  ) OR NOT EXISTS (
    SELECT 1 FROM catalog.products p WHERE p.id = p_product_id AND p.tenant_id = p_tenant_id
  ) THEN
    RETURN false;
  END IF;
  INSERT INTO core.kivi_product_version_offsets (tenant_id, product_id, version_offset)
  VALUES (p_tenant_id, p_product_id, p_offset)
  ON CONFLICT (tenant_id, product_id) DO UPDATE
    SET version_offset = GREATEST(core.kivi_product_version_offsets.version_offset, EXCLUDED.version_offset),
        updated_at = NOW();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_raise_version_offset(uuid, uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_raise_version_offset(uuid, uuid, integer) TO kivi_sync_worker_role;

CREATE OR REPLACE FUNCTION core.kivi_sync_get_product_with_offset(p_tenant_id uuid, p_product_id uuid)
RETURNS TABLE (id uuid, tenant_id uuid, name text, price_cents integer, description text,
               stock integer, status text, version integer, kivi_version_offset integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.tenant_id, p.name::text, p.price_cents, p.description::text,
           p.stock, p.status::text, p.version, COALESCE(o.version_offset, 0)
    FROM catalog.products p
    JOIN core.kivi_connections c ON c.tenant_id = p.tenant_id AND c.status <> 'unlinked'
    LEFT JOIN core.kivi_product_version_offsets o
      ON o.tenant_id = p.tenant_id AND o.product_id = p.id
    WHERE p.tenant_id = p_tenant_id AND p.id = p_product_id;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_get_product_with_offset(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_get_product_with_offset(uuid, uuid) TO kivi_sync_worker_role;

CREATE OR REPLACE FUNCTION core.kivi_sync_list_products_with_offset(
  p_tenant_id uuid, p_after_id uuid, p_limit integer
)
RETURNS TABLE (id uuid, tenant_id uuid, name text, price_cents integer, description text,
               stock integer, status text, version integer, kivi_version_offset integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.tenant_id, p.name::text, p.price_cents, p.description::text,
           p.stock, p.status::text, p.version, COALESCE(o.version_offset, 0)
    FROM catalog.products p
    JOIN core.kivi_connections c ON c.tenant_id = p.tenant_id AND c.status <> 'unlinked'
    LEFT JOIN core.kivi_product_version_offsets o
      ON o.tenant_id = p.tenant_id AND o.product_id = p.id
    WHERE p.tenant_id = p_tenant_id AND (p_after_id IS NULL OR p.id > p_after_id)
    ORDER BY p.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_list_products_with_offset(uuid, uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_list_products_with_offset(uuid, uuid, integer) TO kivi_sync_worker_role;

COMMIT;
