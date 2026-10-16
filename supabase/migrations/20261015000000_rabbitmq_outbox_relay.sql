-- Outbox worker functions. Role checks use pg_has_role (the has_role function does not exist)
-- and column references are qualified. Business mutations remain in TypeScript.
-- The dedicated worker login must be a member of outbox_worker_role.

CREATE TABLE core.outbox_relay_exclusions (
  event_id uuid PRIMARY KEY REFERENCES core.outbox_events(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
  excluded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE core.outbox_relay_exclusions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.outbox_relay_exclusions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON core.outbox_relay_exclusions TO outbox_rpc_owner;
CREATE POLICY outbox_relay_exclusions_read ON core.outbox_relay_exclusions
  FOR SELECT TO outbox_rpc_owner USING (true);

-- Order events created before the relay existed are never relayed automatically and are never deleted.
-- To release one, delete its row from this table with an audited statement.
INSERT INTO core.outbox_relay_exclusions (event_id, reason)
SELECT e.id, 'historical-order-event-before-relay'
FROM core.outbox_events e
WHERE e.aggregate_type = 'Order'
  AND e.status NOT IN ('COMPLETED', 'DEAD')
  AND e.created_at < TIMESTAMPTZ '2026-10-15 00:00:00+00'
ON CONFLICT (event_id) DO NOTHING;

-- Least privilege: a worker may claim an (aggregate_type, event_type) only when session_user is a
-- member of the worker_role of a route row. Rows naming a nonexistent role grant nothing.
CREATE TABLE core.outbox_relay_routes (
  worker_role name NOT NULL,
  aggregate_type text NOT NULL,
  event_type text NOT NULL,
  PRIMARY KEY (worker_role, aggregate_type, event_type)
);
ALTER TABLE core.outbox_relay_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.outbox_relay_routes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON core.outbox_relay_routes TO outbox_rpc_owner;
CREATE POLICY outbox_relay_routes_read ON core.outbox_relay_routes
  FOR SELECT TO outbox_rpc_owner USING (true);

-- Must match ORDER_NOTIFICATION_EVENTS in packages/core/src/features/notifications/application/notification-events.ts.
INSERT INTO core.outbox_relay_routes (worker_role, aggregate_type, event_type)
VALUES
  ('outbox_worker_role', 'Order', 'OrderConfirmedEvent'),
  ('outbox_worker_role', 'Order', 'OrderPaidEvent'),
  ('outbox_worker_role', 'Order', 'OrderProcessingEvent'),
  ('outbox_worker_role', 'Order', 'OrderShippedEvent'),
  ('outbox_worker_role', 'Order', 'OrderCancelledEvent')
ON CONFLICT (worker_role, aggregate_type, event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION core.claim_outbox_events(p_worker_token uuid, p_limit int)
RETURNS TABLE (id uuid, tenant_id uuid, aggregate_type varchar, aggregate_id uuid, event_type varchar, payload jsonb, attempt_count int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'outbox_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  IF p_worker_token IS NULL THEN
    RAISE EXCEPTION 'Worker token is required' USING ERRCODE = '22023';
  END IF;
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 1), 1), 100);

  UPDATE core.outbox_events o
  SET status = 'DEAD', lease_until = NULL, locked_by = NULL
  WHERE o.status = 'RETRY' AND o.attempt_count >= 5 AND o.next_attempt_at <= NOW()
    AND NOT EXISTS (SELECT 1 FROM core.outbox_relay_exclusions x WHERE x.event_id = o.id)
    AND EXISTS (
      SELECT 1 FROM core.outbox_relay_routes r
      JOIN pg_catalog.pg_roles wr ON wr.rolname = r.worker_role
      WHERE r.aggregate_type = o.aggregate_type AND r.event_type = o.event_type
        AND pg_catalog.pg_has_role(session_user, wr.oid, 'MEMBER')
    );

  RETURN QUERY
  UPDATE core.outbox_events o
  SET status = 'PROCESSING', locked_by = p_worker_token, locked_at = NOW(),
      lease_until = NOW() + INTERVAL '60 seconds', attempt_count = o.attempt_count + 1
  WHERE o.id IN (
    SELECT c.id FROM core.outbox_events c
    WHERE (c.status = 'PENDING'
       OR (c.status = 'PROCESSING' AND c.lease_until < NOW())
       OR (c.status = 'RETRY' AND c.next_attempt_at <= NOW() AND c.attempt_count < 5))
      AND NOT EXISTS (SELECT 1 FROM core.outbox_relay_exclusions x WHERE x.event_id = c.id)
      AND EXISTS (
        SELECT 1 FROM core.outbox_relay_routes r
        JOIN pg_catalog.pg_roles wr ON wr.rolname = r.worker_role
        WHERE r.aggregate_type = c.aggregate_type AND r.event_type = c.event_type
          AND pg_catalog.pg_has_role(session_user, wr.oid, 'MEMBER')
      )
    ORDER BY c.created_at, c.id
    FOR UPDATE SKIP LOCKED LIMIT p_limit
  )
  RETURNING o.id, o.tenant_id, o.aggregate_type, o.aggregate_id, o.event_type, o.payload, o.attempt_count;
END;
$$;

CREATE OR REPLACE FUNCTION core.renew_outbox_lease(p_event_id uuid, p_worker_token uuid, p_additional_seconds int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'outbox_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  p_additional_seconds := LEAST(GREATEST(COALESCE(p_additional_seconds, 1), 1), 120);

  UPDATE core.outbox_events
  SET lease_until = LEAST(NOW() + (p_additional_seconds || ' seconds')::interval, locked_at + INTERVAL '5 minutes')
  WHERE id = p_event_id AND status = 'PROCESSING' AND locked_by = p_worker_token AND lease_until >= NOW();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION core.complete_outbox_event(p_event_id uuid, p_worker_token uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'outbox_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  UPDATE core.outbox_events
  SET status = 'COMPLETED', lease_until = NULL, locked_by = NULL, completed_at = NOW()
  WHERE id = p_event_id AND status = 'PROCESSING'
    AND locked_by = p_worker_token AND lease_until > NOW();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION core.retry_outbox_event(p_event_id uuid, p_worker_token uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'outbox_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  UPDATE core.outbox_events
  SET status = CASE WHEN attempt_count >= 5 THEN 'DEAD' ELSE 'RETRY' END,
      lease_until = NULL, locked_by = NULL,
      next_attempt_at = NOW() + (POWER(2, LEAST(attempt_count, 10)) * INTERVAL '1 second')
  WHERE id = p_event_id AND status = 'PROCESSING'
    AND locked_by = p_worker_token AND lease_until > NOW();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION core.dead_letter_outbox_event(p_event_id uuid, p_worker_token uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'outbox_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  UPDATE core.outbox_events
  SET status = 'DEAD', lease_until = NULL, locked_by = NULL
  WHERE id = p_event_id AND status = 'PROCESSING'
    AND locked_by = p_worker_token AND lease_until > NOW();
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION core.claim_outbox_events(uuid, int) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION core.renew_outbox_lease(uuid, uuid, int) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION core.complete_outbox_event(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION core.retry_outbox_event(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION core.dead_letter_outbox_event(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.claim_outbox_events(uuid, int) TO outbox_worker_role;
GRANT EXECUTE ON FUNCTION core.renew_outbox_lease(uuid, uuid, int) TO outbox_worker_role;
GRANT EXECUTE ON FUNCTION core.complete_outbox_event(uuid, uuid) TO outbox_worker_role;
GRANT EXECUTE ON FUNCTION core.retry_outbox_event(uuid, uuid) TO outbox_worker_role;
GRANT EXECUTE ON FUNCTION core.dead_letter_outbox_event(uuid, uuid) TO outbox_worker_role;
