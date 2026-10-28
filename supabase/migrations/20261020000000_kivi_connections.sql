-- Store -> Kivi connection and the narrow worker surface that syncs the catalog to Kivi.
-- The Kivi connection token is NEVER stored: secret_ref only names a server-side environment
-- variable. The table is closed to anon/authenticated/service_role; the web backend reaches it
-- through its privileged database login (owner checks live in TypeScript) and the sync worker
-- only through the SECURITY DEFINER functions below.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kivi_sync_worker_role') THEN
    CREATE ROLE kivi_sync_worker_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'canaldigital_kivi_sync') THEN
    CREATE ROLE canaldigital_kivi_sync
      LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS PASSWORD NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'canaldigital_kivi_sync'
      AND (NOT rolcanlogin OR NOT rolinherit OR rolsuper OR rolcreatedb
           OR rolcreaterole OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'The Kivi sync worker requires an unprivileged inheriting login role';
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO canaldigital_kivi_sync', current_database());
END;
$$;

ALTER ROLE canaldigital_kivi_sync WITH CONNECTION LIMIT 2;
ALTER ROLE canaldigital_kivi_sync SET statement_timeout = '15s';
ALTER ROLE canaldigital_kivi_sync SET lock_timeout = '5s';
ALTER ROLE canaldigital_kivi_sync SET idle_in_transaction_session_timeout = '30s';
-- Claim/complete/retry are fenced by outbox_worker_role; the route rows below limit this login
-- to Product events only. Password is provisioned out of band, never in Git.
GRANT outbox_worker_role TO canaldigital_kivi_sync;
GRANT kivi_sync_worker_role TO canaldigital_kivi_sync;

CREATE TABLE core.kivi_connections (
  tenant_id uuid PRIMARY KEY REFERENCES core.tenants(id) ON DELETE CASCADE,
  base_url text NOT NULL CHECK (base_url ~ '^https?://[^/?#@[:space:]]+$'),
  connection_id uuid NOT NULL,
  secret_ref text NOT NULL CHECK (secret_ref ~ '^KIVI_CONNECTION_TOKEN_[A-Z0-9_]{1,64}$'),
  status text NOT NULL CHECK (status IN ('pending', 'active', 'needs_reconcile', 'unlinked')),
  last_reconciled_at timestamptz,
  linked_by uuid,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
ALTER TABLE core.kivi_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.kivi_connections FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX idx_kivi_connections_due ON core.kivi_connections (status, last_reconciled_at)
  WHERE status <> 'unlinked';

-- Worker access: every function authorizes by the session login and is tenant-scoped.
CREATE OR REPLACE FUNCTION core.kivi_sync_get_connection(p_tenant_id uuid)
RETURNS TABLE (tenant_id uuid, base_url text, connection_id uuid, secret_ref text,
               status text, last_reconciled_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.tenant_id, c.base_url, c.connection_id, c.secret_ref, c.status, c.last_reconciled_at
    FROM core.kivi_connections c WHERE c.tenant_id = p_tenant_id;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_get_connection(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_get_connection(uuid) TO kivi_sync_worker_role;

CREATE OR REPLACE FUNCTION core.kivi_sync_list_due(p_stale_before timestamptz)
RETURNS TABLE (tenant_id uuid, base_url text, connection_id uuid, secret_ref text,
               status text, last_reconciled_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.tenant_id, c.base_url, c.connection_id, c.secret_ref, c.status, c.last_reconciled_at
    FROM core.kivi_connections c
    WHERE c.status IN ('pending', 'needs_reconcile')
       OR (c.status = 'active' AND (c.last_reconciled_at IS NULL OR c.last_reconciled_at < p_stale_before))
    ORDER BY c.updated_at, c.tenant_id
    LIMIT 50;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_list_due(timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_list_due(timestamptz) TO kivi_sync_worker_role;

-- An unlinked connection can never be revived by the worker (only a new owner link can).
CREATE OR REPLACE FUNCTION core.kivi_sync_save_state(
  p_tenant_id uuid, p_status text, p_last_reconciled_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending', 'active', 'needs_reconcile') THEN
    RAISE EXCEPTION 'Invalid connection status' USING ERRCODE = '22023';
  END IF;
  UPDATE core.kivi_connections
  SET status = p_status, last_reconciled_at = p_last_reconciled_at, updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND status <> 'unlinked';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_save_state(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_save_state(uuid, text, timestamptz) TO kivi_sync_worker_role;

-- Product projection, only for tenants that currently have a linked (not unlinked) connection.
CREATE OR REPLACE FUNCTION core.kivi_sync_get_product(p_tenant_id uuid, p_product_id uuid)
RETURNS TABLE (id uuid, tenant_id uuid, name text, price_cents integer, description text,
               stock integer, status text, version integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.tenant_id, p.name::text, p.price_cents, p.description::text,
           p.stock, p.status::text, p.version
    FROM catalog.products p
    JOIN core.kivi_connections c ON c.tenant_id = p.tenant_id AND c.status <> 'unlinked'
    WHERE p.tenant_id = p_tenant_id AND p.id = p_product_id;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_get_product(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_get_product(uuid, uuid) TO kivi_sync_worker_role;

CREATE OR REPLACE FUNCTION core.kivi_sync_list_products(
  p_tenant_id uuid, p_after_id uuid, p_limit integer
)
RETURNS TABLE (id uuid, tenant_id uuid, name text, price_cents integer, description text,
               stock integer, status text, version integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.tenant_id, p.name::text, p.price_cents, p.description::text,
           p.stock, p.status::text, p.version
    FROM catalog.products p
    JOIN core.kivi_connections c ON c.tenant_id = p.tenant_id AND c.status <> 'unlinked'
    WHERE p.tenant_id = p_tenant_id AND (p_after_id IS NULL OR p.id > p_after_id)
    ORDER BY p.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_list_products(uuid, uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_list_products(uuid, uuid, integer) TO kivi_sync_worker_role;

-- Product events delivered to Kivi. Must match KIVI_PRODUCT_EVENT_TYPES in
-- packages/core/src/features/kivi/application/kivi-events.ts.
INSERT INTO core.outbox_relay_routes (worker_role, aggregate_type, event_type)
VALUES
  ('kivi_sync_worker_role', 'Product', 'ProductCreatedEvent'),
  ('kivi_sync_worker_role', 'Product', 'ProductDetailsChangedEvent'),
  ('kivi_sync_worker_role', 'Product', 'ProductPricingChangedEvent'),
  ('kivi_sync_worker_role', 'Product', 'ProductStockAdjustedEvent'),
  ('kivi_sync_worker_role', 'Product', 'ProductArchivedEvent')
ON CONFLICT (worker_role, aggregate_type, event_type) DO NOTHING;

COMMIT;
