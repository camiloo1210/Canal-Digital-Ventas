BEGIN;

ALTER TABLE core.kivi_connections ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT '-infinity';
CREATE INDEX idx_kivi_connections_retry ON core.kivi_connections (next_attempt_at, updated_at, tenant_id)
  WHERE status <> 'unlinked';

CREATE OR REPLACE FUNCTION core.kivi_sync_claim_due(
  p_stale_before timestamptz, p_now timestamptz, p_retry_after timestamptz
)
RETURNS TABLE (tenant_id uuid, base_url text, connection_id uuid, secret_ref text,
  token_ciphertext text, token_key_version smallint, status text,
  last_reconciled_at timestamptz, sync_generation integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  IF p_stale_before IS NULL OR p_now IS NULL OR p_retry_after IS NULL
     OR NOT isfinite(p_now) OR NOT isfinite(p_retry_after)
     OR p_stale_before > p_now OR p_retry_after <= p_now
     OR p_retry_after > p_now + interval '24 hours' THEN
    RAISE EXCEPTION 'Invalid retry window' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT c.tenant_id FROM core.kivi_connections c
    WHERE c.next_attempt_at <= p_now AND (
      c.status IN ('pending', 'needs_reconcile') OR
      (c.status = 'active' AND (c.last_reconciled_at IS NULL OR c.last_reconciled_at < p_stale_before))
    )
    ORDER BY c.next_attempt_at, c.updated_at, c.tenant_id
    LIMIT 50 FOR UPDATE SKIP LOCKED
  )
  UPDATE core.kivi_connections c SET next_attempt_at = p_retry_after
  FROM candidates selected WHERE c.tenant_id = selected.tenant_id
  RETURNING c.tenant_id, c.base_url, c.connection_id, c.secret_ref, c.token_ciphertext,
    c.token_key_version, c.status, c.last_reconciled_at, c.sync_generation;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_claim_due(timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_claim_due(timestamptz, timestamptz, timestamptz) TO kivi_sync_worker_role;

COMMIT;
