-- Provision the restricted database identity used exclusively by the FedEx sandbox worker.
-- The deployment operator must assign its password through the secret-management workflow;
-- keeping PASSWORD NULL prevents access until that explicit step is completed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'canaldigital_shipment_tracking'
  ) THEN
    CREATE ROLE canaldigital_shipment_tracking
      LOGIN
      INHERIT
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      CONNECTION LIMIT 2
      PASSWORD NULL;
  END IF;
END;
$$;

GRANT shipment_tracking_worker_role TO canaldigital_shipment_tracking;
