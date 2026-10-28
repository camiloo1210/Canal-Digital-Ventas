-- Kivi pairing: the connection token is issued by Kivi in exchange for a one-time code and is
-- stored ENCRYPTED (AES-256-GCM, tenant id as AAD; the key lives only in server env vars,
-- never in the database). Follows 20261020000000_kivi_connections.sql, which stays untouched:
-- legacy rows keep their secret_ref (a worker env var name) and keep working.
BEGIN;

ALTER TABLE core.kivi_connections ADD COLUMN token_ciphertext text;
ALTER TABLE core.kivi_connections ADD COLUMN token_key_version smallint;

-- A paired row has no env var reference. The original secret_ref CHECK stays in force.
ALTER TABLE core.kivi_connections ALTER COLUMN secret_ref DROP NOT NULL;

-- Envelope: v<N>.<iv>.<ciphertext+tag> (base64url). Key version travels with the ciphertext.
ALTER TABLE core.kivi_connections ADD CONSTRAINT kivi_connections_token_envelope_check CHECK (
  (token_ciphertext IS NULL AND token_key_version IS NULL)
  OR (token_ciphertext ~ '^v[0-9]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' AND token_key_version >= 1)
);

-- Exactly one credential source while the link is live; an unlinked row holds no ciphertext.
ALTER TABLE core.kivi_connections ADD CONSTRAINT kivi_connections_credential_source_check CHECK (
  status = 'unlinked'
  OR ((secret_ref IS NOT NULL) <> (token_ciphertext IS NOT NULL))
);
ALTER TABLE core.kivi_connections ADD CONSTRAINT kivi_connections_unlinked_wiped_check CHECK (
  status <> 'unlinked' OR token_ciphertext IS NULL
);

-- v2 worker surface: same authorization and scoping as v1, plus the ciphertext. The v1
-- functions stay unchanged (they never return the ciphertext).
CREATE OR REPLACE FUNCTION core.kivi_sync_get_connection_v2(p_tenant_id uuid)
RETURNS TABLE (tenant_id uuid, base_url text, connection_id uuid, secret_ref text,
               token_ciphertext text, token_key_version smallint,
               status text, last_reconciled_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.tenant_id, c.base_url, c.connection_id, c.secret_ref, c.token_ciphertext,
           c.token_key_version, c.status, c.last_reconciled_at
    FROM core.kivi_connections c WHERE c.tenant_id = p_tenant_id;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_get_connection_v2(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_get_connection_v2(uuid) TO kivi_sync_worker_role;

CREATE OR REPLACE FUNCTION core.kivi_sync_list_due_v2(p_stale_before timestamptz)
RETURNS TABLE (tenant_id uuid, base_url text, connection_id uuid, secret_ref text,
               token_ciphertext text, token_key_version smallint,
               status text, last_reconciled_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.tenant_id, c.base_url, c.connection_id, c.secret_ref, c.token_ciphertext,
           c.token_key_version, c.status, c.last_reconciled_at
    FROM core.kivi_connections c
    WHERE c.status IN ('pending', 'needs_reconcile')
       OR (c.status = 'active' AND (c.last_reconciled_at IS NULL OR c.last_reconciled_at < p_stale_before))
    ORDER BY c.updated_at, c.tenant_id
    LIMIT 50;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_list_due_v2(timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_list_due_v2(timestamptz) TO kivi_sync_worker_role;

COMMIT;
