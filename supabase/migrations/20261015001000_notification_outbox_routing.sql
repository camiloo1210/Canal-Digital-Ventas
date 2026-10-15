-- Narrow outbox fencing functions. Business mutations remain in TypeScript.
-- The dedicated worker login must be a member of outbox_worker_role.
GRANT USAGE, CREATE ON SCHEMA core TO outbox_rpc_owner;

CREATE OR REPLACE FUNCTION core.claim_notification_outbox_event(p_worker_token uuid, p_event_types text[])
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
  WHERE o.aggregate_type = 'Order' AND o.event_type = ANY(p_event_types) AND o.attempt_count >= 5 AND (
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
    WHERE candidate.aggregate_type = 'Order' AND candidate.event_type = ANY(p_event_types) AND (candidate.status = 'PENDING'
       OR (candidate.status = 'RETRY' AND candidate.next_attempt_at <= NOW() AND candidate.attempt_count < 5)
       OR (candidate.status = 'PROCESSING' AND candidate.lease_until < NOW() AND candidate.attempt_count < 5))
    ORDER BY candidate.created_at, candidate.id
    FOR UPDATE SKIP LOCKED LIMIT 1
  )
  RETURNING o.id, o.tenant_id, o.aggregate_type, o.aggregate_id,
            o.event_type, o.payload, o.created_at;
END;
$$;
ALTER FUNCTION core.claim_notification_outbox_event(uuid, text[]) OWNER TO outbox_rpc_owner;
REVOKE ALL ON FUNCTION core.claim_notification_outbox_event(uuid, text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.claim_notification_outbox_event(uuid, text[]) TO outbox_worker_role;


REVOKE CREATE ON SCHEMA core FROM outbox_rpc_owner;

