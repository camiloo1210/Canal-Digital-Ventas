-- Sandbox tracking is opt-in and separate from the commercial order state.
-- Provision the environment marker and worker privileges only in a dedicated test database.
CREATE TABLE sales.shipment_tracking_environment (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  environment text NOT NULL CHECK (environment = 'sandbox'),
  deployment_id uuid NOT NULL
);
CREATE TABLE sales.shipment_tracking_links (
  order_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment = 'sandbox'),
  provider text NOT NULL CHECK (provider = 'fedex'),
  tracking_number text NOT NULL CHECK (length(tracking_number) BETWEEN 1 AND 120),
  credential_ref text NOT NULL CHECK (length(credential_ref) BETWEEN 1 AND 120),
  generation bigint NOT NULL DEFAULT 1 CHECK (generation > 0),
  active boolean NOT NULL DEFAULT true,
  paused boolean NOT NULL DEFAULT false,
  next_poll_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_success_at timestamptz,
  last_error_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  result text CHECK (result IN ('found', 'not_found', 'unsupported')),
  FOREIGN KEY (order_id, tenant_id) REFERENCES sales.orders (id, tenant_id) ON DELETE CASCADE,
  CHECK ((lease_token IS NULL) = (lease_until IS NULL))
);
CREATE INDEX shipment_tracking_due_idx ON sales.shipment_tracking_links (next_poll_at) WHERE active;
CREATE TABLE sales.shipment_tracking_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  generation bigint NOT NULL CHECK (generation > 0),
  provider_code text NOT NULL CHECK (length(provider_code) BETWEEN 1 AND 40),
  provider_event_id text,
  status text NOT NULL CHECK (status IN ('unknown', 'label_created', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned')),
  occurred_at timestamptz,
  date_only date,
  received_at timestamptz NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  mapping_version integer NOT NULL CHECK (mapping_version > 0),
  FOREIGN KEY (order_id, tenant_id) REFERENCES sales.orders (id, tenant_id) ON DELETE CASCADE,
  UNIQUE (order_id, generation, fingerprint),
  CHECK (occurred_at IS NULL OR date_only IS NULL)
);
ALTER TABLE sales.shipment_tracking_environment ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales.shipment_tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales.shipment_tracking_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.shipment_tracking_environment FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON sales.shipment_tracking_links FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON sales.shipment_tracking_observations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE sales.shipment_tracking_observations_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- A dedicated technical login must be granted membership by the deployment operator.
-- Application/public roles receive no direct access to these tables.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'shipment_tracking_worker_role') THEN
    CREATE ROLE shipment_tracking_worker_role NOLOGIN;
  END IF;
END;
$$;
GRANT USAGE ON SCHEMA sales TO shipment_tracking_worker_role;
GRANT SELECT ON sales.shipment_tracking_environment TO shipment_tracking_worker_role;
GRANT SELECT ON sales.shipment_tracking_links TO shipment_tracking_worker_role;
GRANT UPDATE (next_poll_at, last_success_at, last_error_at, lease_token, lease_until, attempts, result, paused) ON sales.shipment_tracking_links TO shipment_tracking_worker_role;
GRANT SELECT, INSERT ON sales.shipment_tracking_observations TO shipment_tracking_worker_role;
GRANT USAGE ON SEQUENCE sales.shipment_tracking_observations_id_seq TO shipment_tracking_worker_role;
CREATE POLICY tracking_worker_environment ON sales.shipment_tracking_environment FOR SELECT TO shipment_tracking_worker_role USING (true);
CREATE POLICY tracking_worker_links_read ON sales.shipment_tracking_links FOR SELECT TO shipment_tracking_worker_role USING (environment = 'sandbox');
CREATE POLICY tracking_worker_links_update ON sales.shipment_tracking_links FOR UPDATE TO shipment_tracking_worker_role USING (environment = 'sandbox') WITH CHECK (environment = 'sandbox');
CREATE POLICY tracking_worker_observations_read ON sales.shipment_tracking_observations FOR SELECT TO shipment_tracking_worker_role USING (true);
CREATE POLICY tracking_worker_observations_insert ON sales.shipment_tracking_observations FOR INSERT TO shipment_tracking_worker_role WITH CHECK (EXISTS (
  SELECT 1 FROM sales.shipment_tracking_links l WHERE l.order_id = shipment_tracking_observations.order_id AND l.tenant_id = shipment_tracking_observations.tenant_id AND l.environment = 'sandbox'
));
GRANT SELECT (order_id, tenant_id, tracking_number) ON sales.manual_shipments TO shipment_tracking_worker_role;
CREATE POLICY tracking_worker_manual_read ON sales.manual_shipments FOR SELECT TO shipment_tracking_worker_role USING (EXISTS (
  SELECT 1 FROM sales.shipment_tracking_links l WHERE l.order_id = manual_shipments.order_id AND l.tenant_id = manual_shipments.tenant_id AND l.environment = 'sandbox'
));

-- Fence old generations even if tracking is temporarily disabled in application config.
-- This trigger only fences associations; domain transitions remain in core.
CREATE FUNCTION sales.fence_tracking_on_guide_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.tracking_number IS DISTINCT FROM NEW.tracking_number THEN
    UPDATE sales.shipment_tracking_links
       SET active = false, generation = generation + 1, lease_token = NULL, lease_until = NULL
     WHERE order_id = NEW.order_id AND tenant_id = NEW.tenant_id AND active;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION sales.fence_tracking_on_guide_change() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sales.fence_tracking_on_guide_change() TO CURRENT_USER;
CREATE TRIGGER fence_tracking_on_guide_change
AFTER UPDATE OF tracking_number ON sales.manual_shipments
FOR EACH ROW EXECUTE FUNCTION sales.fence_tracking_on_guide_change();
GRANT DELETE ON sales.shipment_tracking_observations TO shipment_tracking_worker_role;
CREATE POLICY tracking_worker_observations_delete ON sales.shipment_tracking_observations FOR DELETE TO shipment_tracking_worker_role
USING (received_at < clock_timestamp() - interval '90 days');
