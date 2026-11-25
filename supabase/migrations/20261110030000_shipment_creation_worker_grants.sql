-- Least-privilege access for the FedEx sandbox shipment-creation worker.
-- Every read is column-scoped and restricted by RLS to rows tied to an active job
-- (state queued/creating); every write is restricted to the job currently `creating`.
-- Job claim/transition columns were granted in 20261110010000_shipment_creation_jobs.sql.
-- Seller retries run through the application transactor (table owner), not this role.
GRANT USAGE ON SCHEMA core, catalog TO shipment_creation_worker_role;

-- Recipient address and status of the order being shipped.
GRANT SELECT (id, tenant_id, customer_id, status, shipping_address_street, shipping_address_city,
  shipping_address_state, shipping_address_zip_code, shipping_address_country)
  ON sales.orders TO shipment_creation_worker_role;
CREATE POLICY shipment_creation_worker_orders_read ON sales.orders
  FOR SELECT TO shipment_creation_worker_role
  USING (EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = orders.id AND j.tenant_id = orders.tenant_id AND j.state IN ('queued', 'creating')
  ));

-- Recipient contact (name + phone only; no email or document).
GRANT SELECT (id, tenant_id, name, phone) ON sales.customers TO shipment_creation_worker_role;
CREATE POLICY shipment_creation_worker_customers_read ON sales.customers
  FOR SELECT TO shipment_creation_worker_role
  USING (EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    JOIN sales.orders o ON o.id = j.order_id AND o.tenant_id = j.tenant_id
    WHERE o.customer_id = customers.id AND o.tenant_id = customers.tenant_id
      AND j.state IN ('queued', 'creating')
  ));

-- Ordered quantities.
GRANT SELECT (id, order_id, product_id, quantity) ON sales.order_items TO shipment_creation_worker_role;
CREATE POLICY shipment_creation_worker_order_items_read ON sales.order_items
  FOR SELECT TO shipment_creation_worker_role
  USING (EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = order_items.order_id AND j.state IN ('queued', 'creating')
  ));

-- Package weight and dimensions of the ordered products of the job's tenant.
GRANT SELECT (id, tenant_id, weight_grams, length_mm, width_mm, height_mm)
  ON catalog.products TO shipment_creation_worker_role;
CREATE POLICY shipment_creation_worker_products_read ON catalog.products
  FOR SELECT TO shipment_creation_worker_role
  USING (EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    JOIN sales.order_items oi ON oi.order_id = j.order_id
    WHERE oi.product_id = products.id AND j.tenant_id = products.tenant_id
      AND j.state IN ('queued', 'creating')
  ));

-- Sender address of the job's store.
GRANT SELECT (tenant_id, contact_name, phone, street, city, state, zip_code, country)
  ON core.tenant_shipping_origins TO shipment_creation_worker_role;
CREATE POLICY shipment_creation_worker_origins_read ON core.tenant_shipping_origins
  FOR SELECT TO shipment_creation_worker_role
  USING (EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.tenant_id = tenant_shipping_origins.tenant_id AND j.state IN ('queued', 'creating')
  ));

-- Shipment upsert + history, mirroring PostgresManualShipmentRepository (version bump + history row).
-- ON CONFLICT DO UPDATE reads EXCLUDED.carrier/tracking_number, which requires SELECT on them.
GRANT SELECT (order_id, tenant_id, carrier, tracking_number, version) ON sales.manual_shipments TO shipment_creation_worker_role;
GRANT INSERT (order_id, tenant_id, carrier, tracking_number, version)
  ON sales.manual_shipments TO shipment_creation_worker_role;
GRANT UPDATE (carrier, tracking_number, version, updated_at)
  ON sales.manual_shipments TO shipment_creation_worker_role;
CREATE POLICY shipment_creation_worker_manual_read ON sales.manual_shipments
  FOR SELECT TO shipment_creation_worker_role
  USING (EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = manual_shipments.order_id AND j.tenant_id = manual_shipments.tenant_id
      AND j.state = 'creating'
  ));
CREATE POLICY shipment_creation_worker_manual_insert ON sales.manual_shipments
  FOR INSERT TO shipment_creation_worker_role
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = manual_shipments.order_id AND j.tenant_id = manual_shipments.tenant_id
      AND j.state = 'creating'
  ));
CREATE POLICY shipment_creation_worker_manual_update ON sales.manual_shipments
  FOR UPDATE TO shipment_creation_worker_role
  USING (EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = manual_shipments.order_id AND j.tenant_id = manual_shipments.tenant_id
      AND j.state = 'creating'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = manual_shipments.order_id AND j.tenant_id = manual_shipments.tenant_id
      AND j.state = 'creating'
  ));
GRANT INSERT (order_id, tenant_id, actor_id, carrier, tracking_number, version)
  ON sales.manual_shipment_history TO shipment_creation_worker_role;
GRANT USAGE ON SEQUENCE sales.manual_shipment_history_id_seq TO shipment_creation_worker_role;
CREATE POLICY shipment_creation_worker_history_insert ON sales.manual_shipment_history
  FOR INSERT TO shipment_creation_worker_role
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = manual_shipment_history.order_id
      AND j.tenant_id = manual_shipment_history.tenant_id AND j.state = 'creating'
  ));

-- Tracking link activation, mirroring PostgresTrackingActivationAdapter.enable
-- (sandbox environment EXISTS guard + upsert + confirmation read).
GRANT SELECT ON sales.shipment_tracking_environment TO shipment_creation_worker_role;
CREATE POLICY shipment_creation_worker_environment ON sales.shipment_tracking_environment
  FOR SELECT TO shipment_creation_worker_role USING (true);
GRANT SELECT (order_id, tenant_id, environment, provider, tracking_number, credential_ref, generation, active, paused)
  ON sales.shipment_tracking_links TO shipment_creation_worker_role;
GRANT INSERT (order_id, tenant_id, tracking_number, provider, credential_ref)
  ON sales.shipment_tracking_links TO shipment_creation_worker_role;
GRANT UPDATE (tracking_number, provider, credential_ref, generation, active, paused, next_poll_at,
  last_success_at, last_error_at, lease_token, lease_until, attempts, result)
  ON sales.shipment_tracking_links TO shipment_creation_worker_role;
CREATE POLICY shipment_creation_worker_links_read ON sales.shipment_tracking_links
  FOR SELECT TO shipment_creation_worker_role
  USING (environment = 'sandbox' AND EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = shipment_tracking_links.order_id
      AND j.tenant_id = shipment_tracking_links.tenant_id AND j.state = 'creating'
  ));
CREATE POLICY shipment_creation_worker_links_insert ON sales.shipment_tracking_links
  FOR INSERT TO shipment_creation_worker_role
  WITH CHECK (environment = 'sandbox' AND EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = shipment_tracking_links.order_id
      AND j.tenant_id = shipment_tracking_links.tenant_id AND j.state = 'creating'
  ));
CREATE POLICY shipment_creation_worker_links_update ON sales.shipment_tracking_links
  FOR UPDATE TO shipment_creation_worker_role
  USING (environment = 'sandbox' AND EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = shipment_tracking_links.order_id
      AND j.tenant_id = shipment_tracking_links.tenant_id AND j.state = 'creating'
  ))
  WITH CHECK (environment = 'sandbox' AND EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = shipment_tracking_links.order_id
      AND j.tenant_id = shipment_tracking_links.tenant_id AND j.state = 'creating'
  ));
