-- These legacy SECURITY DEFINER helpers rely on the obsolete app_tenant_id claim.
-- Current use cases use server-side adapters and native transactions instead.
-- Retain the functions and their internal owner's privileges; remove browser capabilities.
BEGIN;

REVOKE ALL ON FUNCTION catalog.acquire_idempotency_lease(uuid,text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION catalog.renew_idempotency_lease(uuid,uuid,integer)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION catalog.complete_idempotency(uuid,uuid,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION catalog.consume_image_upload(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION core.append_outbox_event(varchar,uuid,varchar,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION catalog.append_product_audit(uuid,varchar,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
