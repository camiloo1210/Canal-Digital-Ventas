-- Manual shipment metadata is store-entered and does not represent carrier tracking.
CREATE UNIQUE INDEX IF NOT EXISTS orders_id_tenant_unique ON sales.orders (id, tenant_id);
CREATE TABLE sales.manual_shipments (
  order_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  carrier text,
  tracking_number text,
  version integer NOT NULL CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (order_id, tenant_id) REFERENCES sales.orders (id, tenant_id) ON DELETE CASCADE,
  CHECK (carrier IS NOT NULL OR tracking_number IS NOT NULL),
  CHECK (carrier IS NULL OR length(carrier) BETWEEN 1 AND 120),
  CHECK (tracking_number IS NULL OR length(tracking_number) BETWEEN 1 AND 120)
);
CREATE TABLE sales.manual_shipment_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  carrier text,
  tracking_number text,
  version integer NOT NULL CHECK (version > 0),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (order_id, tenant_id) REFERENCES sales.orders (id, tenant_id) ON DELETE CASCADE,
  UNIQUE (order_id, version)
);
ALTER TABLE sales.manual_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales.manual_shipment_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.manual_shipments FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON sales.manual_shipment_history FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE sales.manual_shipment_history_id_seq FROM PUBLIC, anon, authenticated, service_role;
