-- Durable queue of carrier shipment creation jobs, enqueued in the same transaction
-- that moves an order to PROCESSING. The application transactor connects as the table
-- owner (like sales.manual_shipments), so it needs no explicit grant to INSERT.
CREATE TABLE sales.shipment_creation_jobs (
  order_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'creating', 'done', 'needs_attention', 'failed')),
  reason text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_token uuid,
  lease_until timestamptz,
  label_path text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (order_id, tenant_id) REFERENCES sales.orders (id, tenant_id) ON DELETE CASCADE,
  CHECK ((lease_token IS NULL) = (lease_until IS NULL))
);
CREATE INDEX shipment_creation_jobs_due_idx ON sales.shipment_creation_jobs (state, lease_until)
  WHERE state IN ('queued', 'creating');
ALTER TABLE sales.shipment_creation_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.shipment_creation_jobs FROM PUBLIC, anon, authenticated, service_role;

-- A dedicated technical login must be granted membership by the deployment operator.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'shipment_creation_worker_role') THEN
    CREATE ROLE shipment_creation_worker_role NOLOGIN;
  END IF;
END;
$$;
GRANT USAGE ON SCHEMA sales TO shipment_creation_worker_role;
GRANT SELECT ON sales.shipment_creation_jobs TO shipment_creation_worker_role;
GRANT UPDATE (state, reason, attempts, lease_token, lease_until, label_path, version, updated_at) ON sales.shipment_creation_jobs TO shipment_creation_worker_role;
CREATE POLICY shipment_creation_worker_read ON sales.shipment_creation_jobs FOR SELECT TO shipment_creation_worker_role USING (true);
CREATE POLICY shipment_creation_worker_update ON sales.shipment_creation_jobs FOR UPDATE TO shipment_creation_worker_role USING (true) WITH CHECK (true);
