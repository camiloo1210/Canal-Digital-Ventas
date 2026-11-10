-- Tracking number returned by the carrier when the shipment was created but could not be
-- recorded. Once set, the job may never be retried (a retry would create a duplicate carrier
-- shipment); the seller records this number through the manual shipment form instead.
-- Row scoping is unchanged: the worker's existing SELECT/UPDATE policies on this table apply.
ALTER TABLE sales.shipment_creation_jobs
  ADD COLUMN provider_tracking_number text
  CHECK (provider_tracking_number IS NULL OR length(provider_tracking_number) BETWEEN 1 AND 120);
GRANT UPDATE (provider_tracking_number) ON sales.shipment_creation_jobs TO shipment_creation_worker_role;
