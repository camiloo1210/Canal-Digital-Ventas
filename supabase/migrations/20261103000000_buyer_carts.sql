-- Server-side persistence of authenticated buyers' carts (hybrid model: the browser keeps the
-- live cart, signed-in buyers also get a server copy that expires on a sliding 30-day window).
-- The web backend reaches sales.carts / sales.cart_items through its privileged database login
-- (identity and tenant scoping live in TypeScript); the tables are closed to API roles.
-- The retention worker only gets the SECURITY DEFINER purge function below.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cart_retention_role') THEN
    CREATE ROLE cart_retention_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'canaldigital_cart_retention') THEN
    CREATE ROLE canaldigital_cart_retention
      LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS PASSWORD NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'canaldigital_cart_retention'
      AND (NOT rolcanlogin OR NOT rolinherit OR rolsuper OR rolcreatedb
           OR rolcreaterole OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'The cart retention worker requires an unprivileged inheriting login role';
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO canaldigital_cart_retention', current_database());
END;
$$;

ALTER ROLE canaldigital_cart_retention WITH CONNECTION LIMIT 2;
ALTER ROLE canaldigital_cart_retention SET statement_timeout = '15s';
ALTER ROLE canaldigital_cart_retention SET lock_timeout = '5s';
ALTER ROLE canaldigital_cart_retention SET idle_in_transaction_session_timeout = '30s';
-- Password is provisioned out of band, never in Git.
GRANT cart_retention_role TO canaldigital_cart_retention;

-- Buyer ownership. customer_id stays NULL for these carts (a buyer is an auth user, not a customer).
ALTER TABLE sales.carts
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Totals are derived from quantity * unit price; 50 lines * 99 units can exceed int4.
ALTER TABLE sales.carts ALTER COLUMN subtotal_cents TYPE bigint;
ALTER TABLE sales.cart_items ALTER COLUMN subtotal_cents TYPE bigint;

-- Line order is part of the snapshot.
ALTER TABLE sales.cart_items
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

-- One active server cart per buyer per store.
CREATE UNIQUE INDEX IF NOT EXISTS uq_carts_active_buyer
  ON sales.carts (tenant_id, buyer_user_id)
  WHERE status = 'active' AND buyer_user_id IS NOT NULL;

-- Retention scans.
CREATE INDEX IF NOT EXISTS idx_carts_buyer_expires_at
  ON sales.carts (expires_at)
  WHERE buyer_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carts_buyer_closed_updated_at
  ON sales.carts (updated_at)
  WHERE buyer_user_id IS NOT NULL AND status <> 'active';

-- Buyer carts must never be readable through the API roles.
REVOKE ALL ON sales.carts FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON sales.cart_items FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION core.purge_expired_buyer_carts(p_batch integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'cart_retention_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  IF p_batch IS NULL OR p_batch < 1 OR p_batch > 1000 THEN
    RAISE EXCEPTION 'Invalid batch size' USING ERRCODE = '22023';
  END IF;
  WITH doomed AS (
    SELECT c.id
    FROM sales.carts c
    WHERE c.buyer_user_id IS NOT NULL
      AND (
        c.expires_at < pg_catalog.now()
        OR (c.status IN ('converted', 'abandoned')
            AND c.updated_at < pg_catalog.now() - interval '7 days')
      )
    ORDER BY c.expires_at, c.id
    LIMIT p_batch
    FOR UPDATE SKIP LOCKED
  ), removed AS (
    DELETE FROM sales.carts c USING doomed d WHERE c.id = d.id RETURNING c.id
  )
  SELECT pg_catalog.count(*)::integer INTO v_deleted FROM removed;
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION core.purge_expired_buyer_carts(integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.purge_expired_buyer_carts(integer) TO cart_retention_role;

COMMIT;
