-- Narrow outbox fencing functions. Business mutations remain in TypeScript.
-- The dedicated worker login must be a member of outbox_worker_role.
GRANT USAGE, CREATE ON SCHEMA core TO outbox_rpc_owner;

CREATE OR REPLACE FUNCTION core.claim_relay_outbox_event(p_worker_token uuid)
RETURNS TABLE (
  id uuid, tenant_id uuid, aggregate_type varchar, aggregate_id uuid,
  event_type varchar, payload jsonb, occurred_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'outbox_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  IF p_worker_token IS NULL THEN
    RAISE EXCEPTION 'Worker token is required' USING ERRCODE = '22023';
  END IF;

  UPDATE core.outbox_events o
  SET status = 'DEAD', locked_by = NULL, lease_until = NULL
  WHERE o.attempt_count >= 5 AND (
    (o.status = 'RETRY' AND o.next_attempt_at <= NOW()) OR
    (o.status = 'PROCESSING' AND o.lease_until < NOW())
  );

  RETURN QUERY
  UPDATE core.outbox_events o
  SET status = 'PROCESSING', locked_by = p_worker_token,
      locked_at = NOW(), lease_until = NOW() + INTERVAL '60 seconds',
      attempt_count = o.attempt_count + 1
  WHERE o.id = (
    SELECT candidate.id FROM core.outbox_events candidate
    WHERE candidate.status = 'PENDING'
       OR (candidate.status = 'RETRY' AND candidate.next_attempt_at <= NOW() AND candidate.attempt_count < 5)
       OR (candidate.status = 'PROCESSING' AND candidate.lease_until < NOW() AND candidate.attempt_count < 5)
    ORDER BY candidate.created_at, candidate.id
    FOR UPDATE SKIP LOCKED LIMIT 1
  )
  RETURNING o.id, o.tenant_id, o.aggregate_type, o.aggregate_id,
            o.event_type, o.payload, o.created_at;
END;
$$;
ALTER FUNCTION core.claim_relay_outbox_event(uuid) OWNER TO outbox_rpc_owner;
REVOKE ALL ON FUNCTION core.claim_relay_outbox_event(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.claim_relay_outbox_event(uuid) TO outbox_worker_role;

-- Correct PostgreSQL role checks in the completion/retry functions used by the relay.
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
ALTER FUNCTION core.complete_outbox_event(uuid, uuid) OWNER TO outbox_rpc_owner;
REVOKE ALL ON FUNCTION core.complete_outbox_event(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.complete_outbox_event(uuid, uuid) TO outbox_worker_role;

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
ALTER FUNCTION core.retry_outbox_event(uuid, uuid) OWNER TO outbox_rpc_owner;
REVOKE ALL ON FUNCTION core.retry_outbox_event(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.retry_outbox_event(uuid, uuid) TO outbox_worker_role;

REVOKE CREATE ON SCHEMA core FROM outbox_rpc_owner;
