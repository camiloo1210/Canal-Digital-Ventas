-- The shipment-creation worker must check, BEFORE committing `creating` and calling the carrier,
-- whether the order already has a tracking number (for example one the seller typed in the manual
-- shipment form while the job waited). Without this the worker would create a second carrier
-- shipment and overwrite the seller's number.
-- Widens only the row scope of the existing SELECT policy from `creating` to `queued`/`creating`.
-- The column-scoped SELECT grant from 20261110030000 is unchanged (order_id, tenant_id, carrier,
-- tracking_number, version); INSERT/UPDATE stay restricted to the job currently `creating`.
DROP POLICY shipment_creation_worker_manual_read ON sales.manual_shipments;
CREATE POLICY shipment_creation_worker_manual_read ON sales.manual_shipments
  FOR SELECT TO shipment_creation_worker_role
  USING (EXISTS (
    SELECT 1 FROM sales.shipment_creation_jobs j
    WHERE j.order_id = manual_shipments.order_id AND j.tenant_id = manual_shipments.tenant_id
      AND j.state IN ('queued', 'creating')
  ));
