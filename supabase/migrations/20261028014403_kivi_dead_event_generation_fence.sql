BEGIN;

CREATE OR REPLACE FUNCTION core.kivi_sync_flag_dead_events()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
DECLARE
  v_flagged integer;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  WITH newly_dead AS (
    INSERT INTO core.kivi_dead_event_acks (event_id, tenant_id)
    SELECT e.id, e.tenant_id FROM core.outbox_events e
    JOIN core.kivi_connections c ON c.tenant_id = e.tenant_id AND c.status <> 'unlinked'
    WHERE e.status = 'DEAD' AND e.aggregate_type = 'Product'
      AND e.event_type IN ('ProductCreatedEvent', 'ProductDetailsChangedEvent',
        'ProductPricingChangedEvent', 'ProductStockAdjustedEvent', 'ProductArchivedEvent')
    ON CONFLICT (event_id) DO NOTHING RETURNING tenant_id
  ), flagged AS (
    UPDATE core.kivi_connections c
    SET status = CASE WHEN c.status = 'pending' THEN 'pending' ELSE 'needs_reconcile' END,
        sync_generation = c.sync_generation + 1, updated_at = NOW()
    WHERE c.status <> 'unlinked' AND c.tenant_id IN (SELECT n.tenant_id FROM newly_dead n)
    RETURNING c.tenant_id
  )
  SELECT COUNT(*)::integer INTO v_flagged FROM flagged;
  RETURN v_flagged;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_flag_dead_events() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_flag_dead_events() TO kivi_sync_worker_role;

COMMIT;
