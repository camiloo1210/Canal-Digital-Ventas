BEGIN;

ALTER TABLE core.kivi_connections ADD COLUMN sync_generation integer NOT NULL DEFAULT 0
  CHECK (sync_generation >= 0);

CREATE OR REPLACE FUNCTION core.kivi_sync_get_connection_v3(p_tenant_id uuid)
RETURNS TABLE (tenant_id uuid, base_url text, connection_id uuid, secret_ref text,
  token_ciphertext text, token_key_version smallint, status text,
  last_reconciled_at timestamptz, sync_generation integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT c.tenant_id, c.base_url, c.connection_id, c.secret_ref,
    c.token_ciphertext, c.token_key_version, c.status, c.last_reconciled_at, c.sync_generation
  FROM core.kivi_connections c WHERE c.tenant_id = p_tenant_id;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_get_connection_v3(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_get_connection_v3(uuid) TO kivi_sync_worker_role;

CREATE OR REPLACE FUNCTION core.kivi_sync_save_state_v2(
  p_tenant_id uuid, p_connection_id uuid, p_generation integer,
  p_status text, p_last_reconciled_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('pending', 'active', 'needs_reconcile')
     OR p_generation IS NULL OR p_generation < 0 THEN
    RAISE EXCEPTION 'Invalid synchronization state' USING ERRCODE = '22023';
  END IF;
  UPDATE core.kivi_connections c
  SET status = p_status, last_reconciled_at = p_last_reconciled_at,
      sync_generation = c.sync_generation + 1, updated_at = NOW()
  WHERE c.tenant_id = p_tenant_id AND c.connection_id = p_connection_id
    AND c.sync_generation = p_generation AND c.status <> 'unlinked';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_save_state_v2(uuid, uuid, integer, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_save_state_v2(uuid, uuid, integer, text, timestamptz) TO kivi_sync_worker_role;

-- Old workers must fail closed instead of bypassing the generation fence.
REVOKE ALL ON FUNCTION core.kivi_sync_save_state(uuid, text, timestamptz) FROM kivi_sync_worker_role;

COMMIT;
