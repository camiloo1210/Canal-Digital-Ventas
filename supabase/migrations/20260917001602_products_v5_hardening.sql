-- Migration: products_v5_hardening
-- Description: V5 End-to-End Hardening including structured idempotency state-machines, outbox fencing, multi-tenant composite FKs and precise Security Definer RPCs (Least Privilege Architecture).

-- ==========================================
-- DEFAULT PRIVILEGES (FUTURE PROOFING)
-- ==========================================
-- Ensure any future functions in these schemas do not leak execution to public
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA core REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ==========================================
-- ROLES
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'outbox_worker_role') THEN
      CREATE ROLE outbox_worker_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'outbox_rpc_owner') THEN
      CREATE ROLE outbox_rpc_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_rpc_owner') THEN
      CREATE ROLE app_rpc_owner NOLOGIN;
  END IF;

  -- Requisito de PostgreSQL: Para hacer ALTER OWNER, el usuario ejecutando la migración
  -- (generalmente 'postgres') debe ser miembro del rol destino.
  GRANT app_rpc_owner TO current_user;
  GRANT outbox_rpc_owner TO current_user;
END
$$;

-- Requisito de PostgreSQL: El nuevo owner debe tener USAGE y CREATE en el schema asociado
-- para poder asumir la propiedad (propiedad de objetos) a través de ALTER OWNER.
GRANT USAGE, CREATE ON SCHEMA catalog TO app_rpc_owner;
GRANT USAGE, CREATE ON SCHEMA core TO app_rpc_owner;
GRANT USAGE, CREATE ON SCHEMA core TO outbox_rpc_owner;

-- ==========================================
-- COMPOSITE PRIMARY/UNIQUE KEYS FOR TENANT-SAFE FKs
-- ==========================================
ALTER TABLE catalog.products ADD CONSTRAINT uq_products_tenant_id UNIQUE (tenant_id, id);

-- ==========================================
-- IDEMPOTENCY
-- ==========================================
CREATE TABLE catalog.idempotency_keys (
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL,
  request_hash TEXT NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
  owner_token UUID,
  lease_until TIMESTAMP WITH TIME ZONE,
  response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (tenant_id, idempotency_key),
  CONSTRAINT chk_idempotency_state CHECK (
    (status = 'IN_PROGRESS' AND owner_token IS NOT NULL AND lease_until IS NOT NULL AND response IS NULL AND completed_at IS NULL) OR
    (status = 'COMPLETED' AND owner_token IS NULL AND lease_until IS NULL AND response IS NOT NULL AND completed_at IS NOT NULL)
  )
);
ALTER TABLE catalog.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OUTBOX
-- ==========================================
CREATE TABLE core.outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  aggregate_type VARCHAR NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'RETRY', 'DEAD')),
  locked_by UUID,
  locked_at TIMESTAMP WITH TIME ZONE,
  lease_until TIMESTAMP WITH TIME ZONE,
  attempt_count INT DEFAULT 0 NOT NULL,
  next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT chk_outbox_state CHECK (
    (status = 'PENDING' AND locked_by IS NULL AND lease_until IS NULL AND completed_at IS NULL) OR
    (status = 'PROCESSING' AND locked_by IS NOT NULL AND lease_until IS NOT NULL AND completed_at IS NULL) OR
    (status = 'COMPLETED' AND locked_by IS NULL AND lease_until IS NULL AND completed_at IS NOT NULL) OR
    (status = 'RETRY' AND locked_by IS NULL AND lease_until IS NULL AND completed_at IS NULL) OR
    (status = 'DEAD' AND locked_by IS NULL AND lease_until IS NULL)
  )
);
ALTER TABLE core.outbox_events ENABLE ROW LEVEL SECURITY;
-- Partial Indexes for Outbox Worker Optimization
CREATE INDEX idx_outbox_pending ON core.outbox_events(created_at, id) WHERE status = 'PENDING';
CREATE INDEX idx_outbox_retry ON core.outbox_events(next_attempt_at, created_at, id) WHERE status = 'RETRY';
CREATE INDEX idx_outbox_processing ON core.outbox_events(lease_until, created_at, id) WHERE status = 'PROCESSING';

-- ==========================================
-- AUDIT
-- ==========================================
CREATE TABLE catalog.product_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  action VARCHAR NOT NULL,
  changes JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT fk_audit_product FOREIGN KEY (tenant_id, product_id) REFERENCES catalog.products(tenant_id, id) ON DELETE RESTRICT
);
ALTER TABLE catalog.product_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable select for authenticated users" ON catalog.product_audit_log FOR SELECT TO authenticated USING (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid);

-- ==========================================
-- IMAGE UPLOADS
-- ==========================================
CREATE TABLE catalog.image_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID,
  storage_key VARCHAR NOT NULL,
  expected_content_type VARCHAR NOT NULL,
  max_bytes BIGINT NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('CREATED', 'UPLOADING', 'UPLOADED', 'VALIDATING', 'READY', 'REJECTED', 'CONSUMED', 'EXPIRED')),
  checksum VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT uq_tenant_storage_key UNIQUE (tenant_id, storage_key),
  CONSTRAINT fk_upload_product FOREIGN KEY (tenant_id, product_id) REFERENCES catalog.products(tenant_id, id) ON DELETE SET NULL
);
ALTER TABLE catalog.image_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable select for authenticated users" ON catalog.image_uploads FOR SELECT TO authenticated USING (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid);

-- ==========================================
-- CQRS INDICES & PRODUCT UPDATES
-- ==========================================
CREATE INDEX idx_products_tenant_status_created_id 
ON catalog.products(tenant_id, status, created_at DESC, id DESC);

CREATE UNIQUE INDEX idx_products_tenant_sku_active
ON catalog.products(tenant_id, sku)
WHERE status != 'archived';

-- ==========================================
-- SECURITY DEFINER RPCs (Strict Application Boundaries)
-- ==========================================

-- 1. ACQUIRE IDEMPOTENCY LEASE
CREATE OR REPLACE FUNCTION catalog.acquire_idempotency_lease(
  p_idempotency_key uuid,
  p_request_hash text,
  p_owner_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = catalog, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_existing record;
BEGIN
  v_tenant_id := (select auth.jwt()->>'app_tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: No tenant context'; END IF;

  INSERT INTO catalog.idempotency_keys (tenant_id, idempotency_key, request_hash, status, owner_token, lease_until)
  VALUES (v_tenant_id, p_idempotency_key, p_request_hash, 'IN_PROGRESS', p_owner_token, NOW() + INTERVAL '30 seconds')
  ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM catalog.idempotency_keys WHERE tenant_id = v_tenant_id AND idempotency_key = p_idempotency_key;
    IF v_existing.status = 'COMPLETED' THEN
      IF v_existing.request_hash != p_request_hash THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED';
      ELSE
        RETURN jsonb_build_object('status', 'REPLAY', 'response', v_existing.response);
      END IF;
    ELSIF v_existing.status = 'IN_PROGRESS' THEN
      IF v_existing.lease_until < NOW() THEN
        IF v_existing.request_hash != p_request_hash THEN
           RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED';
        END IF;
        -- Atomic reclaim of lease
        UPDATE catalog.idempotency_keys
        SET owner_token = p_owner_token, lease_until = NOW() + INTERVAL '30 seconds'
        WHERE tenant_id = v_tenant_id AND idempotency_key = p_idempotency_key AND status = 'IN_PROGRESS' AND lease_until < NOW();
        
        IF NOT FOUND THEN RAISE EXCEPTION 'CONCURRENCY_CONFLICT'; END IF;
        RETURN jsonb_build_object('status', 'ACQUIRED');
      ELSE
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'ACQUIRED');
END;
$$;
ALTER FUNCTION catalog.acquire_idempotency_lease OWNER TO app_rpc_owner;

-- 2. RENEW IDEMPOTENCY LEASE
CREATE OR REPLACE FUNCTION catalog.renew_idempotency_lease(
  p_idempotency_key uuid,
  p_owner_token uuid,
  p_additional_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = catalog, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := (select auth.jwt()->>'app_tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: No tenant context'; END IF;

  IF p_additional_seconds > 60 THEN p_additional_seconds := 60; END IF;
  IF p_additional_seconds < 1 THEN p_additional_seconds := 1; END IF;

  UPDATE catalog.idempotency_keys
  SET lease_until = LEAST(NOW() + (p_additional_seconds || ' seconds')::interval, created_at + INTERVAL '5 minutes')
  WHERE tenant_id = v_tenant_id
    AND idempotency_key = p_idempotency_key
    AND owner_token = p_owner_token
    AND status = 'IN_PROGRESS'
    AND lease_until >= NOW();

  RETURN FOUND;
END;
$$;
ALTER FUNCTION catalog.renew_idempotency_lease OWNER TO app_rpc_owner;

-- 3. COMPLETE IDEMPOTENCY
CREATE OR REPLACE FUNCTION catalog.complete_idempotency(
  p_idempotency_key uuid,
  p_owner_token uuid,
  p_response jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = catalog, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := (select auth.jwt()->>'app_tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: No tenant context'; END IF;

  UPDATE catalog.idempotency_keys
  SET status = 'COMPLETED', response = p_response, completed_at = NOW(), lease_until = NULL, owner_token = NULL
  WHERE tenant_id = v_tenant_id
    AND idempotency_key = p_idempotency_key
    AND owner_token = p_owner_token
    AND status = 'IN_PROGRESS'
    AND lease_until >= NOW();

  RETURN FOUND;
END;
$$;
ALTER FUNCTION catalog.complete_idempotency OWNER TO app_rpc_owner;

-- 4. CONSUME IMAGE UPLOAD
CREATE OR REPLACE FUNCTION catalog.consume_image_upload(
  p_upload_id uuid,
  p_product_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = catalog, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := (select auth.jwt()->>'app_tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: No tenant context'; END IF;

  IF NOT EXISTS (SELECT 1 FROM catalog.products WHERE id = p_product_id AND tenant_id = v_tenant_id) THEN
    RAISE EXCEPTION 'Invalid product for tenant';
  END IF;

  UPDATE catalog.image_uploads
  SET status = 'CONSUMED', product_id = p_product_id
  WHERE id = p_upload_id AND tenant_id = v_tenant_id AND status = 'READY' AND expires_at > NOW();

  RETURN FOUND;
END;
$$;
ALTER FUNCTION catalog.consume_image_upload OWNER TO app_rpc_owner;

-- 5. APPEND OUTBOX EVENT
CREATE OR REPLACE FUNCTION core.append_outbox_event(
  p_aggregate_type varchar,
  p_aggregate_id uuid,
  p_event_type varchar,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_event_id uuid;
BEGIN
  v_tenant_id := (select auth.jwt()->>'app_tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: No tenant context'; END IF;

  INSERT INTO core.outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
  VALUES (v_tenant_id, p_aggregate_type, p_aggregate_id, p_event_type, p_payload)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;
ALTER FUNCTION core.append_outbox_event OWNER TO app_rpc_owner;

-- 6. APPEND PRODUCT AUDIT
CREATE OR REPLACE FUNCTION catalog.append_product_audit(
  p_product_id uuid,
  p_action varchar,
  p_changes jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = catalog, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_actor_id uuid;
  v_audit_id uuid;
BEGIN
  v_tenant_id := (select auth.jwt()->>'app_tenant_id')::uuid;
  v_actor_id := (select auth.uid())::uuid; 
  IF v_tenant_id IS NULL OR v_actor_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: Missing auth context'; END IF;

  INSERT INTO catalog.product_audit_log (tenant_id, product_id, actor_id, action, changes)
  VALUES (v_tenant_id, p_product_id, v_actor_id, p_action, p_changes)
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;
ALTER FUNCTION catalog.append_product_audit OWNER TO app_rpc_owner;


-- ==========================================
-- OUTBOX SECURE WORKER RPCs
-- ==========================================

-- Worker: CLAIM
CREATE OR REPLACE FUNCTION core.claim_outbox_events(p_worker_token uuid, p_limit int)
RETURNS TABLE (id uuid, tenant_id uuid, aggregate_type varchar, aggregate_id uuid, event_type varchar, payload jsonb, attempt_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT has_role(session_user, 'outbox_worker_role', 'MEMBER') THEN RAISE EXCEPTION 'Unauthorized worker access'; END IF;

  IF p_limit > 100 THEN p_limit := 100; END IF;
  IF p_limit < 1 THEN p_limit := 1; END IF;

  -- Phase 1: Mark max_attempt retries as DEAD atomically
  UPDATE core.outbox_events
  SET status = 'DEAD', lease_until = NULL, locked_by = NULL
  WHERE status = 'RETRY' AND attempt_count >= 5 AND next_attempt_at <= NOW();

  -- Phase 2: Claim valid events
  RETURN QUERY
  UPDATE core.outbox_events
  SET status = 'PROCESSING', locked_by = p_worker_token, locked_at = NOW(), lease_until = NOW() + INTERVAL '60 seconds', attempt_count = core.outbox_events.attempt_count + 1
  WHERE core.outbox_events.id IN (
    SELECT o.id FROM core.outbox_events o
    WHERE (o.status = 'PENDING') 
       OR (o.status = 'PROCESSING' AND o.lease_until < NOW()) 
       OR (o.status = 'RETRY' AND o.next_attempt_at <= NOW() AND o.attempt_count < 5)
    ORDER BY o.created_at ASC
    FOR UPDATE SKIP LOCKED LIMIT p_limit
  )
  RETURNING core.outbox_events.id, core.outbox_events.tenant_id, core.outbox_events.aggregate_type, core.outbox_events.aggregate_id, core.outbox_events.event_type, core.outbox_events.payload, core.outbox_events.attempt_count;
END;
$$;
ALTER FUNCTION core.claim_outbox_events OWNER TO outbox_rpc_owner;

-- Worker: RENEW LEASE
CREATE OR REPLACE FUNCTION core.renew_outbox_lease(p_event_id uuid, p_worker_token uuid, p_additional_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT has_role(session_user, 'outbox_worker_role', 'MEMBER') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_additional_seconds > 120 THEN p_additional_seconds := 120; END IF;

  UPDATE core.outbox_events
  SET lease_until = LEAST(NOW() + (p_additional_seconds || ' seconds')::interval, locked_at + INTERVAL '5 minutes')
  WHERE id = p_event_id AND status = 'PROCESSING' AND locked_by = p_worker_token AND lease_until >= NOW();
  
  RETURN FOUND;
END;
$$;
ALTER FUNCTION core.renew_outbox_lease OWNER TO outbox_rpc_owner;

-- Worker: COMPLETE
CREATE OR REPLACE FUNCTION core.complete_outbox_event(p_event_id uuid, p_worker_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT has_role(session_user, 'outbox_worker_role', 'MEMBER') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  
  UPDATE core.outbox_events
  SET status = 'COMPLETED', lease_until = NULL, locked_by = NULL, completed_at = NOW()
  WHERE id = p_event_id AND status = 'PROCESSING' AND locked_by = p_worker_token AND lease_until > NOW();
  
  RETURN FOUND;
END;
$$;
ALTER FUNCTION core.complete_outbox_event OWNER TO outbox_rpc_owner;

-- Worker: RETRY
CREATE OR REPLACE FUNCTION core.retry_outbox_event(p_event_id uuid, p_worker_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
DECLARE
  v_next_attempt timestamp with time zone;
BEGIN
  IF NOT has_role(session_user, 'outbox_worker_role', 'MEMBER') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  
  UPDATE core.outbox_events
  SET status = 'RETRY', 
      lease_until = NULL, 
      locked_by = NULL, 
      next_attempt_at = NOW() + (POWER(2, LEAST(attempt_count, 10)) * INTERVAL '1 second') + (random() * 1000 * INTERVAL '1 millisecond')
  WHERE id = p_event_id AND status = 'PROCESSING' AND locked_by = p_worker_token AND lease_until > NOW();
  
  RETURN FOUND;
END;
$$;
ALTER FUNCTION core.retry_outbox_event OWNER TO outbox_rpc_owner;

-- Worker: DEAD LETTER
CREATE OR REPLACE FUNCTION core.dead_letter_outbox_event(p_event_id uuid, p_worker_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT has_role(session_user, 'outbox_worker_role', 'MEMBER') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  
  UPDATE core.outbox_events
  SET status = 'DEAD', lease_until = NULL, locked_by = NULL
  WHERE id = p_event_id AND status = 'PROCESSING' AND locked_by = p_worker_token AND lease_until > NOW();
  
  RETURN FOUND;
END;
$$;
ALTER FUNCTION core.dead_letter_outbox_event OWNER TO outbox_rpc_owner;


-- ==========================================
-- PERMISSIONS (LEAST PRIVILEGE)
-- ==========================================

-- 1. REVOKE DEFAULT GRANTS (Zero native trust)
REVOKE ALL ON SCHEMA catalog FROM public;
REVOKE ALL ON SCHEMA core FROM public;

-- Revoke CREATE capability transferred during ALTER OWNER so the NOLOGIN roles cannot create things
REVOKE CREATE ON SCHEMA catalog FROM app_rpc_owner;
REVOKE CREATE ON SCHEMA core FROM app_rpc_owner;
REVOKE CREATE ON SCHEMA core FROM outbox_rpc_owner;

GRANT USAGE ON SCHEMA catalog TO authenticated;
GRANT USAGE ON SCHEMA core TO authenticated;

REVOKE ALL ON TABLE catalog.idempotency_keys FROM anon, authenticated, public;
REVOKE ALL ON TABLE core.outbox_events FROM anon, authenticated, public;
REVOKE ALL ON TABLE catalog.product_audit_log FROM anon, authenticated, public;
REVOKE ALL ON TABLE catalog.image_uploads FROM anon, authenticated, public;

-- 2. REVOKE COMPROMISING DEFAULT FUNCTIONS (PUBLIC EXECUTE EXCLUSION)
REVOKE EXECUTE ON FUNCTION catalog.acquire_idempotency_lease FROM public;
REVOKE EXECUTE ON FUNCTION catalog.renew_idempotency_lease FROM public;
REVOKE EXECUTE ON FUNCTION catalog.complete_idempotency FROM public;
REVOKE EXECUTE ON FUNCTION catalog.consume_image_upload FROM public;
REVOKE EXECUTE ON FUNCTION core.append_outbox_event FROM public;
REVOKE EXECUTE ON FUNCTION catalog.append_product_audit FROM public;
REVOKE EXECUTE ON FUNCTION core.claim_outbox_events FROM public;
REVOKE EXECUTE ON FUNCTION core.renew_outbox_lease FROM public;
REVOKE EXECUTE ON FUNCTION core.complete_outbox_event FROM public;
REVOKE EXECUTE ON FUNCTION core.retry_outbox_event FROM public;
REVOKE EXECUTE ON FUNCTION core.dead_letter_outbox_event FROM public;

-- 3. GRANT STRICT EXECUTE CAPABILITIES FOR WEB APP (Transaction Manager usage)
GRANT EXECUTE ON FUNCTION catalog.acquire_idempotency_lease TO authenticated;
GRANT EXECUTE ON FUNCTION catalog.renew_idempotency_lease TO authenticated;
GRANT EXECUTE ON FUNCTION catalog.complete_idempotency TO authenticated;
GRANT EXECUTE ON FUNCTION catalog.consume_image_upload TO authenticated;
GRANT EXECUTE ON FUNCTION core.append_outbox_event TO authenticated;
GRANT EXECUTE ON FUNCTION catalog.append_product_audit TO authenticated;

-- 4. GRANT INNER TABLE PRIVILEGES TO RPC OWNERS (SECURITY DEFINER RUNTIME)
-- app_rpc_owner restricted to strict least privilege per table
GRANT SELECT, INSERT, UPDATE ON TABLE catalog.idempotency_keys TO app_rpc_owner;
GRANT SELECT, UPDATE ON TABLE catalog.image_uploads TO app_rpc_owner;
GRANT INSERT ON TABLE catalog.product_audit_log TO app_rpc_owner;
GRANT SELECT, INSERT, UPDATE ON TABLE catalog.products TO app_rpc_owner;
GRANT INSERT ON TABLE core.outbox_events TO app_rpc_owner;
-- Exposing explicit RLS bypassing policies for the SECURITY DEFINER ownership model:
CREATE POLICY "app_rpc_owner_policy_idempotency" ON catalog.idempotency_keys FOR ALL TO app_rpc_owner USING (true) WITH CHECK (true);
CREATE POLICY "app_rpc_owner_policy_uploads" ON catalog.image_uploads FOR ALL TO app_rpc_owner USING (true) WITH CHECK (true);
CREATE POLICY "app_rpc_owner_policy_audit" ON catalog.product_audit_log FOR ALL TO app_rpc_owner USING (true) WITH CHECK (true);
CREATE POLICY "app_rpc_owner_policy_products" ON catalog.products FOR ALL TO app_rpc_owner USING (true) WITH CHECK (true);
CREATE POLICY "app_rpc_owner_policy_outbox" ON core.outbox_events FOR ALL TO app_rpc_owner USING (true) WITH CHECK (true);

-- outbox_rpc_owner restricted to strict least privilege for resolving events
GRANT SELECT, UPDATE ON TABLE core.outbox_events TO outbox_rpc_owner;
CREATE POLICY "outbox_rpc_owner_policy_outbox" ON core.outbox_events FOR ALL TO outbox_rpc_owner USING (true) WITH CHECK (true);

-- 5. GRANT STRICT WORKER EXECUTE CAPABILITIES
GRANT USAGE ON SCHEMA core TO outbox_worker_role;
-- Only allow Runtime Worker explicit execution, NEVER ANY direct TABLE action. (No SELECT, INSERT, UPDATE, DELETE).
GRANT EXECUTE ON FUNCTION core.claim_outbox_events TO outbox_worker_role;
GRANT EXECUTE ON FUNCTION core.renew_outbox_lease TO outbox_worker_role;
GRANT EXECUTE ON FUNCTION core.complete_outbox_event TO outbox_worker_role;
GRANT EXECUTE ON FUNCTION core.retry_outbox_event TO outbox_worker_role;
GRANT EXECUTE ON FUNCTION core.dead_letter_outbox_event TO outbox_worker_role;
