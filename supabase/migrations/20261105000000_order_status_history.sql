-- HU-24: order status history so bottlenecks (time per stage, stuck orders) can be audited.
-- Rows are append-only and written by a trigger, so every code path that changes sales.orders.status is covered.

CREATE TABLE IF NOT EXISTS sales.order_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES sales.orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES core.tenants(id),
  from_status VARCHAR,
  to_status VARCHAR NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON sales.order_status_history(order_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_order_status_history_tenant ON sales.order_status_history(tenant_id, changed_at);

ALTER TABLE sales.order_status_history ENABLE ROW LEVEL SECURITY;
-- No client policy: the table is read only through the server-side PostgreSQL connection.
REVOKE ALL ON sales.order_status_history FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION sales.record_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO sales.order_status_history(order_id, tenant_id, from_status, to_status, changed_at)
    VALUES (NEW.id, NEW.tenant_id, NULL, NEW.status, NEW.created_at);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO sales.order_status_history(order_id, tenant_id, from_status, to_status, changed_at)
    VALUES (NEW.id, NEW.tenant_id, OLD.status, NEW.status, clock_timestamp());
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION sales.record_order_status_change() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sales.record_order_status_change() TO postgres;

DROP TRIGGER IF EXISTS trg_order_status_history ON sales.orders;
CREATE TRIGGER trg_order_status_history
  AFTER INSERT OR UPDATE OF status ON sales.orders
  FOR EACH ROW EXECUTE FUNCTION sales.record_order_status_change();

-- Backfill: past transitions are unknown, so each existing order gets one row with its current status
-- at its last update. That is enough to measure time stuck in the current status; stage durations
-- are only measured for orders whose transitions were recorded after this migration.
INSERT INTO sales.order_status_history(order_id, tenant_id, from_status, to_status, changed_at)
SELECT o.id, o.tenant_id, NULL, o.status, o.updated_at
FROM sales.orders o
WHERE NOT EXISTS (SELECT 1 FROM sales.order_status_history h WHERE h.order_id = o.id);
