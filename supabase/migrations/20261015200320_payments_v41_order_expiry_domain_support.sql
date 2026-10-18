-- Node domain transactions own order lifecycle and stock changes; financial RPC roles cannot.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='payment_order_domain_role') THEN
    CREATE ROLE payment_order_domain_role NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS sales.order_expiry_cancellations (
  order_id uuid PRIMARY KEY REFERENCES sales.orders(id),
  payment_id uuid NOT NULL UNIQUE,
  tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  reason text NOT NULL CHECK(reason='PAYMENT_EXPIRED'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(payment_id,order_id,tenant_id) REFERENCES sales.payments(id,order_id,tenant_id)
);
ALTER TABLE sales.order_expiry_cancellations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.order_expiry_cancellations FROM PUBLIC,anon,authenticated,service_role,payments_rpc_owner;
GRANT USAGE ON SCHEMA sales,catalog,core TO payment_order_domain_role;
GRANT SELECT,INSERT ON sales.order_expiry_cancellations TO payment_order_domain_role;
DROP POLICY IF EXISTS payment_domain_expiry_read ON sales.order_expiry_cancellations;
CREATE POLICY payment_domain_expiry_read ON sales.order_expiry_cancellations FOR SELECT TO payment_order_domain_role
  USING(tenant_id=nullif(current_setting('app.payment_tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS payment_domain_expiry_insert ON sales.order_expiry_cancellations;
CREATE POLICY payment_domain_expiry_insert ON sales.order_expiry_cancellations FOR INSERT TO payment_order_domain_role
  WITH CHECK(tenant_id=nullif(current_setting('app.payment_tenant_id',true),'')::uuid
    AND EXISTS(SELECT 1 FROM sales.orders o WHERE o.id=order_id AND o.tenant_id=tenant_id AND o.status='confirmed'));
GRANT SELECT ON sales.orders,sales.order_items,catalog.products TO payment_order_domain_role;
GRANT SELECT(id,order_id,tenant_id,status,amount_cents,gateway_transaction_id,environment) ON sales.payments TO payment_order_domain_role;
GRANT UPDATE(status,payment_gateway_id,version,updated_at) ON sales.orders TO payment_order_domain_role;
GRANT UPDATE(stock,version,updated_at) ON catalog.products TO payment_order_domain_role;
GRANT SELECT ON sales.order_automation_exclusions TO payment_order_domain_role;
GRANT INSERT(id,tenant_id,aggregate_type,aggregate_id,event_type,payload,status) ON core.outbox_events TO payment_order_domain_role;
DROP POLICY IF EXISTS payment_domain_order_read ON sales.orders;
CREATE POLICY payment_domain_order_read ON sales.orders FOR SELECT TO payment_order_domain_role
  USING(tenant_id=nullif(current_setting('app.payment_tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS payment_domain_order_update ON sales.orders;
CREATE POLICY payment_domain_order_update ON sales.orders FOR UPDATE TO payment_order_domain_role
  USING(tenant_id=nullif(current_setting('app.payment_tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id=nullif(current_setting('app.payment_tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS payment_domain_order_items_read ON sales.order_items;
CREATE POLICY payment_domain_order_items_read ON sales.order_items FOR SELECT TO payment_order_domain_role
  USING(EXISTS(SELECT 1 FROM sales.orders o WHERE o.id=order_id AND o.tenant_id=nullif(current_setting('app.payment_tenant_id',true),'')::uuid));
DROP POLICY IF EXISTS payment_domain_payment_read ON sales.payments;
CREATE POLICY payment_domain_payment_read ON sales.payments FOR SELECT TO payment_order_domain_role
  USING(tenant_id=nullif(current_setting('app.payment_tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS payment_domain_product_read ON catalog.products;
CREATE POLICY payment_domain_product_read ON catalog.products FOR SELECT TO payment_order_domain_role
  USING(tenant_id=nullif(current_setting('app.payment_tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS payment_domain_product_update ON catalog.products;
CREATE POLICY payment_domain_product_update ON catalog.products FOR UPDATE TO payment_order_domain_role
  USING(tenant_id=nullif(current_setting('app.payment_tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id=nullif(current_setting('app.payment_tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS payment_domain_exclusions_read ON sales.order_automation_exclusions;
CREATE POLICY payment_domain_exclusions_read ON sales.order_automation_exclusions FOR SELECT TO payment_order_domain_role
  USING(EXISTS(SELECT 1 FROM sales.orders o WHERE o.id=order_id));
DROP POLICY IF EXISTS payment_domain_outbox_insert ON core.outbox_events;
CREATE POLICY payment_domain_outbox_insert ON core.outbox_events FOR INSERT TO payment_order_domain_role
  WITH CHECK(aggregate_type='Order' AND tenant_id=nullif(current_setting('app.payment_tenant_id',true),'')::uuid
    AND EXISTS(SELECT 1 FROM sales.orders o WHERE o.id=aggregate_id AND o.tenant_id=outbox_events.tenant_id));
-- Relay publishes payment events into a separate durable consumer queue.
INSERT INTO core.outbox_relay_routes(worker_role,aggregate_type,event_type) VALUES
  ('outbox_worker_role','Payment','sales.payment.completed'),
  ('outbox_worker_role','Payment','sales.payment.checkout_expired')
  ON CONFLICT(worker_role,aggregate_type,event_type) DO NOTHING;
COMMIT;
