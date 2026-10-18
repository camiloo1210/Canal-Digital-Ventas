-- V41 foundation + RPC 23/24. Writers remain disabled. No secrets or LOGIN passwords.
-- Existing payment DML is revoked in a separately reviewed delivery, after preflight.
BEGIN;

DO $$
BEGIN
  IF to_regclass('sales.payments') IS NULL OR to_regclass('sales.orders') IS NULL THEN
    RAISE EXCEPTION 'Payment baseline missing';
  END IF;
  IF EXISTS (SELECT 1 FROM sales.payments WHERE status NOT IN ('pending','completed','failed','refunded','partially_refunded','expired_unpaid_awaiting_reconciliation','late_payment_pending_compensation')) THEN
    RAISE EXCEPTION 'Unexpected payment status: review before expansion';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'payments_rpc_owner') THEN
    CREATE ROLE payments_rpc_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'payments_rpc_owner' AND (rolcanlogin OR rolbypassrls OR rolsuper OR rolcreaterole)) THEN
    RAISE EXCEPTION 'Unsafe payments owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'payment_checkout_role') THEN
    CREATE ROLE payment_checkout_role NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'payment_ingestion_role') THEN
    CREATE ROLE payment_ingestion_role NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT payments_rpc_owner TO CURRENT_USER;
GRANT USAGE, CREATE ON SCHEMA core, sales TO payments_rpc_owner;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, sales REVOKE ALL ON TABLES FROM anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS core.system_flags (
  name text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO core.system_flags(name, enabled) VALUES ('payments_v41_writers_enabled', false)
  ON CONFLICT(name) DO NOTHING;
ALTER TABLE core.system_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.system_flags FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON core.system_flags TO payments_rpc_owner;
DROP POLICY IF EXISTS payments_flags_read ON core.system_flags;
CREATE POLICY payments_flags_read ON core.system_flags FOR SELECT TO payments_rpc_owner USING (true);

CREATE TABLE IF NOT EXISTS core.gateway_credentials (
  provider text NOT NULL CHECK (provider = 'lemon_squeezy'),
  environment text NOT NULL CHECK (environment IN ('test','production')),
  store_id text NOT NULL CHECK (store_id ~ '^[1-9][0-9]*$'),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  webhook_secret_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT false,
  PRIMARY KEY (provider, environment)
);
ALTER TABLE core.gateway_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.gateway_credentials FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON core.gateway_credentials TO payments_rpc_owner;
DROP POLICY IF EXISTS payments_credentials_read ON core.gateway_credentials;
CREATE POLICY payments_credentials_read ON core.gateway_credentials FOR SELECT TO payments_rpc_owner USING (true);

ALTER TABLE sales.payments
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'legacy_unclassified',
  ADD COLUMN IF NOT EXISTS store_id text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS refunded_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkout_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_checkout_id text,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS checkout_creation_state text NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS checkout_creation_token uuid,
  ADD COLUMN IF NOT EXISTS checkout_creation_lease_until timestamptz;

ALTER TABLE sales.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE sales.payments ADD CONSTRAINT payments_status_check CHECK (status IN (
  'pending','completed','failed','refunded','partially_refunded',
  'expired_unpaid_awaiting_reconciliation','late_payment_pending_compensation'
));
ALTER TABLE sales.payments DROP CONSTRAINT IF EXISTS payments_environment_check;
ALTER TABLE sales.payments ADD CONSTRAINT payments_environment_check CHECK (environment IN ('test','production','legacy_unclassified'));
ALTER TABLE sales.payments DROP CONSTRAINT IF EXISTS payments_refund_amount_check;
ALTER TABLE sales.payments ADD CONSTRAINT payments_refund_amount_check CHECK (amount_cents > 0 AND refunded_amount_cents BETWEEN 0 AND amount_cents);
ALTER TABLE sales.payments DROP CONSTRAINT IF EXISTS payments_creation_check;
ALTER TABLE sales.payments ADD CONSTRAINT payments_creation_check CHECK (
  checkout_creation_state IN ('NOT_STARTED','IN_PROGRESS','CREATED','AMBIGUOUS','REJECTED')
  AND (checkout_creation_state <> 'IN_PROGRESS' OR (checkout_creation_token IS NOT NULL AND checkout_creation_lease_until IS NOT NULL))
  AND (checkout_creation_state <> 'CREATED' OR (provider_checkout_id IS NOT NULL AND checkout_url IS NOT NULL))
  AND (environment = 'legacy_unclassified' OR (currency IS NOT NULL AND store_id IS NOT NULL AND checkout_expires_at IS NOT NULL))
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='sales.payments'::regclass AND conname='payments_identity_unique') THEN
    ALTER TABLE sales.payments ADD CONSTRAINT payments_identity_unique UNIQUE (id, order_id, tenant_id);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_nonfailed_order ON sales.payments(order_id) WHERE status <> 'failed';
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_transaction_unique ON sales.payments(gateway,environment,gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sales.order_automation_exclusions (
  order_id uuid PRIMARY KEY REFERENCES sales.orders(id),
  reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO sales.order_automation_exclusions(order_id,reason)
  SELECT id, 'LEGACY_PENDING_PAYMENT_INVENTORY_UNCERTAIN' FROM sales.orders
  WHERE status = 'pending_payment' AND created_at < '2026-10-14T00:00:00Z'::timestamptz
  ON CONFLICT(order_id) DO NOTHING;
ALTER TABLE sales.order_automation_exclusions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.order_automation_exclusions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON sales.order_automation_exclusions TO payments_rpc_owner;
DROP POLICY IF EXISTS payments_exclusions_read ON sales.order_automation_exclusions;
CREATE POLICY payments_exclusions_read ON sales.order_automation_exclusions FOR SELECT TO payments_rpc_owner USING (true);

GRANT SELECT, INSERT ON sales.payments TO payments_rpc_owner;
GRANT UPDATE (status,failure_reason,provider_checkout_id,checkout_url,checkout_creation_state,
  checkout_creation_token,checkout_creation_lease_until,version,updated_at) ON sales.payments TO payments_rpc_owner;
DROP POLICY IF EXISTS payments_rpc_read ON sales.payments;
CREATE POLICY payments_rpc_read ON sales.payments FOR SELECT TO payments_rpc_owner USING (true);
DROP POLICY IF EXISTS payments_rpc_insert ON sales.payments;
CREATE POLICY payments_rpc_insert ON sales.payments FOR INSERT TO payments_rpc_owner WITH CHECK (true);
DROP POLICY IF EXISTS payments_rpc_update ON sales.payments;
CREATE POLICY payments_rpc_update ON sales.payments FOR UPDATE TO payments_rpc_owner USING (true) WITH CHECK (true);
GRANT SELECT (id,tenant_id,customer_id,status,total_amount_cents) ON sales.orders TO payments_rpc_owner;
GRANT SELECT (id,tenant_id,global_auth_id) ON sales.customers TO payments_rpc_owner;
GRANT SELECT (id,status,base_currency) ON core.tenants TO payments_rpc_owner;
DROP POLICY IF EXISTS payments_order_read ON sales.orders;
CREATE POLICY payments_order_read ON sales.orders FOR SELECT TO payments_rpc_owner USING (true);
DROP POLICY IF EXISTS payments_customer_read ON sales.customers;
CREATE POLICY payments_customer_read ON sales.customers FOR SELECT TO payments_rpc_owner USING (true);
DROP POLICY IF EXISTS payments_tenant_read ON core.tenants;
CREATE POLICY payments_tenant_read ON core.tenants FOR SELECT TO payments_rpc_owner USING (true);

CREATE OR REPLACE FUNCTION sales.guard_payment_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, sales AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.order_id <> OLD.order_id OR NEW.tenant_id <> OLD.tenant_id
    OR NEW.customer_id <> OLD.customer_id OR NEW.amount_cents <> OLD.amount_cents
    OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.environment <> OLD.environment
    OR NEW.store_id IS DISTINCT FROM OLD.store_id THEN
    RAISE EXCEPTION 'Payment identity is immutable' USING ERRCODE = 'FZ124';
  END IF;
  IF NEW.refunded_amount_cents < OLD.refunded_amount_cents THEN
    RAISE EXCEPTION 'Payment book cannot decrease' USING ERRCODE = 'FZ125';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payments_identity_immutable ON sales.payments;
CREATE TRIGGER payments_identity_immutable BEFORE UPDATE ON sales.payments
  FOR EACH ROW EXECUTE FUNCTION sales.guard_payment_identity();
REVOKE ALL ON FUNCTION sales.guard_payment_identity() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sales.guard_payment_identity() TO payments_rpc_owner;

CREATE OR REPLACE FUNCTION sales.create_pending_payment(
  p_order_id uuid, p_buyer_auth_id uuid, p_gateway text, p_environment text, p_ttl_seconds integer
) RETURNS TABLE (
  payment_id uuid, outcome text, order_id uuid, tenant_id uuid, amount_cents integer,
  currency text, store_id text, environment text, checkout_expires_at timestamptz,
  checkout_url text, checkout_creation_token uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, sales, core AS $$
DECLARE
  o record; c record; credential record; pay sales.payments%ROWTYPE; result_outcome text;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_checkout_role','MEMBER') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SET LOCAL lock_timeout = '5s';
  IF NOT EXISTS (SELECT 1 FROM core.system_flags f WHERE f.name = 'payments_v41_writers_enabled' AND f.enabled) THEN
    RAISE EXCEPTION 'Writers disabled' USING ERRCODE = 'FZ121';
  END IF;
  IF p_gateway IS DISTINCT FROM 'lemon_squeezy' OR p_environment NOT IN ('test','production') OR p_environment IS NULL THEN
    RAISE EXCEPTION 'Gateway unavailable' USING ERRCODE = 'FZ122';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('canaldigital:order:' || p_order_id::text,0));
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Unsupported isolation' USING ERRCODE = '25001';
  END IF;
  SELECT ord.id,ord.tenant_id,ord.customer_id,ord.status,ord.total_amount_cents INTO o
    FROM sales.orders ord JOIN sales.customers cust ON cust.id = ord.customer_id AND cust.tenant_id = ord.tenant_id
    WHERE ord.id = p_order_id AND cust.global_auth_id = p_buyer_auth_id;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM sales.order_automation_exclusions x WHERE x.order_id = p_order_id) THEN
    RAISE EXCEPTION 'Order unavailable' USING ERRCODE = 'FZ120';
  END IF;
  SELECT * INTO pay FROM sales.payments p WHERE p.order_id = p_order_id AND p.status <> 'failed' FOR UPDATE;
  IF pay.id IS NOT NULL AND pay.status IN ('completed','partially_refunded','refunded') THEN
    result_outcome := 'ALREADY_PAID';
  ELSE
    IF o.status <> 'confirmed' THEN RAISE EXCEPTION 'Order unavailable' USING ERRCODE = 'FZ120'; END IF;
    SELECT t.base_currency INTO c FROM core.tenants t WHERE t.id = o.tenant_id AND t.status = 'active';
    IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable' USING ERRCODE = 'FZ120'; END IF;
    SELECT * INTO credential FROM core.gateway_credentials g
      WHERE g.provider = p_gateway AND g.environment = p_environment AND g.active AND g.currency = c.base_currency;
    IF NOT FOUND OR o.total_amount_cents <= 0 THEN RAISE EXCEPTION 'Gateway unavailable' USING ERRCODE = 'FZ122'; END IF;
    IF pay.id IS NULL THEN
      INSERT INTO sales.payments(id,order_id,tenant_id,customer_id,status,gateway,amount_cents,
        environment,store_id,currency,checkout_expires_at,checkout_creation_state,checkout_creation_token,checkout_creation_lease_until)
      VALUES(gen_random_uuid(),o.id,o.tenant_id,o.customer_id,'pending',p_gateway,o.total_amount_cents,
        p_environment,credential.store_id,c.base_currency,clock_timestamp() + make_interval(secs => greatest(600,least(coalesce(p_ttl_seconds,1800),3600))),
        'IN_PROGRESS',gen_random_uuid(),clock_timestamp() + interval '30 seconds') RETURNING * INTO pay;
      result_outcome := 'CREATED';
    ELSIF pay.environment <> p_environment OR pay.status <> 'pending' OR pay.checkout_expires_at <= clock_timestamp() THEN
      result_outcome := 'CREATION_UNAVAILABLE';
    ELSIF pay.checkout_creation_state = 'CREATED' THEN result_outcome := 'EXISTING_WITH_CHECKOUT';
    ELSIF pay.checkout_creation_state = 'IN_PROGRESS' AND pay.checkout_creation_lease_until > clock_timestamp() THEN result_outcome := 'BUSY';
    ELSIF pay.checkout_creation_state = 'NOT_STARTED' THEN
      UPDATE sales.payments p SET checkout_creation_state = 'IN_PROGRESS',
        checkout_creation_token = gen_random_uuid(),checkout_creation_lease_until = clock_timestamp() + interval '30 seconds',
        updated_at = clock_timestamp() WHERE p.id = pay.id RETURNING * INTO pay;
      result_outcome := 'EXISTING_NO_CHECKOUT';
    ELSE
      IF pay.checkout_creation_state = 'IN_PROGRESS' THEN
        UPDATE sales.payments p SET checkout_creation_state = 'AMBIGUOUS', updated_at = clock_timestamp()
          WHERE p.id = pay.id RETURNING * INTO pay;
      END IF;
      result_outcome := 'CREATION_UNAVAILABLE';
    END IF;
  END IF;
  RETURN QUERY SELECT pay.id,result_outcome,pay.order_id,pay.tenant_id,pay.amount_cents,
    pay.currency,pay.store_id,pay.environment,pay.checkout_expires_at,pay.checkout_url,pay.checkout_creation_token;
END $$;

CREATE OR REPLACE FUNCTION sales.attach_provider_checkout(
  p_payment_id uuid,p_creation_token uuid,p_mode text,p_provider_checkout_id text,p_checkout_url text,p_reason_code text
) RETURNS TABLE(payment_id uuid,checkout_creation_state text,payment_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, sales, core AS $$
DECLARE pay sales.payments%ROWTYPE; target_order uuid;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_checkout_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  SET LOCAL lock_timeout = '5s';
  IF NOT EXISTS (SELECT 1 FROM core.system_flags f WHERE f.name = 'payments_v41_writers_enabled' AND f.enabled) THEN
    RAISE EXCEPTION 'Writers disabled' USING ERRCODE = 'FZ121';
  END IF;
  SELECT p.order_id INTO target_order FROM sales.payments p WHERE p.id = p_payment_id;
  IF target_order IS NULL THEN RAISE EXCEPTION 'Payment unavailable' USING ERRCODE = 'FZ120'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('canaldigital:order:' || target_order::text,0));
  IF current_setting('transaction_isolation') <> 'read committed' THEN RAISE EXCEPTION 'Unsupported isolation' USING ERRCODE = '25001'; END IF;
  SELECT * INTO pay FROM sales.payments p WHERE p.id = p_payment_id FOR UPDATE;
  IF pay.order_id <> target_order OR pay.checkout_creation_token IS DISTINCT FROM p_creation_token OR p_creation_token IS NULL THEN
    RAISE EXCEPTION 'Stale checkout creator' USING ERRCODE = 'FZ123';
  END IF;
  IF pay.status IN ('completed','partially_refunded','refunded') THEN
    RETURN QUERY SELECT pay.id,pay.checkout_creation_state,pay.status::text; RETURN;
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('CREATED','AMBIGUOUS','REJECTED') OR pay.status <> 'pending' THEN
    RAISE EXCEPTION 'Invalid checkout state' USING ERRCODE = 'FZ123';
  END IF;
  IF pay.checkout_creation_state = 'CREATED' THEN
    IF p_mode = 'CREATED' AND pay.provider_checkout_id = p_provider_checkout_id AND pay.checkout_url = p_checkout_url THEN
      RETURN QUERY SELECT pay.id,pay.checkout_creation_state,pay.status::text; RETURN;
    END IF;
    RAISE EXCEPTION 'Checkout conflict' USING ERRCODE = 'FZ123';
  END IF;
  IF pay.checkout_creation_state NOT IN ('IN_PROGRESS','AMBIGUOUS') THEN RAISE EXCEPTION 'Invalid checkout state' USING ERRCODE = 'FZ123'; END IF;
  IF p_mode = 'CREATED' THEN
    IF p_provider_checkout_id IS NULL OR length(p_provider_checkout_id) NOT BETWEEN 1 AND 128
      OR p_checkout_url IS NULL OR length(p_checkout_url) > 2048
      OR p_checkout_url !~ '^https://[a-zA-Z0-9-]+\.lemonsqueezy\.com/checkout/'
      OR pay.checkout_expires_at <= clock_timestamp() THEN
      RAISE EXCEPTION 'Invalid checkout response' USING ERRCODE = 'FZ123';
    END IF;
  ELSIF p_mode = 'REJECTED' THEN
    IF pay.checkout_creation_state <> 'IN_PROGRESS' OR pay.checkout_creation_lease_until <= clock_timestamp()
      OR p_reason_code IS NULL OR p_reason_code NOT IN ('HTTP_400','HTTP_401','HTTP_403','HTTP_404','HTTP_422','INVALID_CONFIGURATION') THEN
      RAISE EXCEPTION 'Rejection not proven' USING ERRCODE = 'FZ123';
    END IF;
  END IF;
  UPDATE sales.payments p SET checkout_creation_state = p_mode,
    provider_checkout_id = CASE WHEN p_mode = 'CREATED' THEN p_provider_checkout_id ELSE p.provider_checkout_id END,
    checkout_url = CASE WHEN p_mode = 'CREATED' THEN p_checkout_url ELSE p.checkout_url END,
    status = CASE WHEN p_mode = 'REJECTED' THEN 'failed' ELSE p.status END,
    failure_reason = CASE WHEN p_mode = 'REJECTED' THEN p_reason_code ELSE p.failure_reason END,
    version = p.version + 1,updated_at = clock_timestamp()
    WHERE p.id = p_payment_id RETURNING * INTO pay;
  RETURN QUERY SELECT pay.id,pay.checkout_creation_state,pay.status::text;
END $$;

ALTER FUNCTION sales.create_pending_payment(uuid,uuid,text,text,integer) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.attach_provider_checkout(uuid,uuid,text,text,text,text) OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.create_pending_payment(uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.attach_provider_checkout(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA sales TO payment_checkout_role;
GRANT EXECUTE ON FUNCTION sales.create_pending_payment(uuid,uuid,text,text,integer) TO payment_checkout_role;
GRANT EXECUTE ON FUNCTION sales.attach_provider_checkout(uuid,uuid,text,text,text,text) TO payment_checkout_role;

-- RPC 2: authenticate exact bytes in the database before creating any inbox event.
CREATE TABLE IF NOT EXISTS sales.payment_inbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL CHECK (environment IN ('test','production')),
  event_name text NOT NULL CHECK (event_name IN ('order_created','order_refunded')),
  provider_order_id text NOT NULL CHECK (provider_order_id ~ '^[1-9][0-9]*$'),
  payload bytea NOT NULL CHECK (octet_length(payload) BETWEEN 1 AND 1048576),
  body_hash text NOT NULL CHECK (body_hash ~ '^[a-f0-9]{64}$'),
  signature text NOT NULL CHECK (signature ~ '^[a-fA-F0-9]{64}$'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','FAILED','COMPLETED','DEAD')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  worker_token uuid, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(environment,event_name,provider_order_id,body_hash),
  CHECK (status <> 'PROCESSING' OR (worker_token IS NOT NULL AND lease_until IS NOT NULL))
);
ALTER TABLE sales.payment_inbox_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.payment_inbox_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON sales.payment_inbox_events TO payments_rpc_owner;
DROP POLICY IF EXISTS payments_inbox_read ON sales.payment_inbox_events;
CREATE POLICY payments_inbox_read ON sales.payment_inbox_events FOR SELECT TO payments_rpc_owner USING (true);
DROP POLICY IF EXISTS payments_inbox_insert ON sales.payment_inbox_events;
CREATE POLICY payments_inbox_insert ON sales.payment_inbox_events FOR INSERT TO payments_rpc_owner WITH CHECK (true);
GRANT USAGE ON SCHEMA vault,extensions TO payments_rpc_owner;
GRANT SELECT ON vault.decrypted_secrets TO payments_rpc_owner;

CREATE OR REPLACE FUNCTION sales.ingest_payment_webhook_event(
  p_payload bytea,p_signature text,p_event_name text,p_environment text
) RETURNS TABLE(outcome text,event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,sales,core AS $$
DECLARE credential record; secret_bytes bytea; actual_digest bytea; body jsonb;
  event_type text; resource_id text; hash text; inserted_id uuid;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_ingestion_role','MEMBER') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SET LOCAL statement_timeout = '10s';
  IF NOT EXISTS (SELECT 1 FROM core.system_flags f WHERE f.name = 'payments_v41_writers_enabled' AND f.enabled) THEN
    RAISE EXCEPTION 'Writers disabled' USING ERRCODE = 'FZ121';
  END IF;
  IF p_payload IS NULL OR octet_length(p_payload) NOT BETWEEN 1 AND 1048576 THEN
    RETURN QUERY SELECT 'MALFORMED'::text,NULL::uuid; RETURN;
  END IF;
  SELECT g.store_id,g.webhook_secret_id INTO credential FROM core.gateway_credentials g
    WHERE g.provider = 'lemon_squeezy' AND g.environment = p_environment AND g.active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gateway unavailable' USING ERRCODE = 'FZ122'; END IF;
  SELECT convert_to(v.decrypted_secret,'UTF8') INTO secret_bytes FROM vault.decrypted_secrets v WHERE v.id = credential.webhook_secret_id;
  IF secret_bytes IS NULL OR octet_length(secret_bytes) = 0 THEN RAISE EXCEPTION 'Gateway unavailable' USING ERRCODE = 'FZ122'; END IF;
  IF p_signature IS NULL OR p_signature !~ '^[a-fA-F0-9]{64}$' THEN
    RETURN QUERY SELECT 'INVALID_SIGNATURE'::text,NULL::uuid; RETURN;
  END IF;
  actual_digest := extensions.hmac(p_payload,secret_bytes,'sha256');
  -- Double HMAC prevents a timing comparison from exposing the digest being verified.
  IF extensions.hmac(decode(p_signature,'hex'),secret_bytes,'sha256') <>
    extensions.hmac(actual_digest,secret_bytes,'sha256') THEN
    RETURN QUERY SELECT 'INVALID_SIGNATURE'::text,NULL::uuid; RETURN;
  END IF;
  BEGIN
    body := convert_from(p_payload,'UTF8')::jsonb;
    event_type := body #>> '{meta,event_name}'; resource_id := body #>> '{data,id}';
    IF event_type IS DISTINCT FROM p_event_name OR body #>> '{data,type}' IS DISTINCT FROM 'orders' THEN
      RETURN QUERY SELECT 'MALFORMED'::text,NULL::uuid; RETURN;
    END IF;
    IF event_type NOT IN ('order_created','order_refunded') THEN
      RETURN QUERY SELECT 'IGNORED'::text,NULL::uuid; RETURN;
    END IF;
    IF resource_id IS NULL OR resource_id !~ '^[1-9][0-9]*$' THEN
      RETURN QUERY SELECT 'MALFORMED'::text,NULL::uuid; RETURN;
    END IF;
    IF body #>> '{data,attributes,store_id}' IS DISTINCT FROM credential.store_id
      OR jsonb_typeof(body #> '{data,attributes,test_mode}') IS DISTINCT FROM 'boolean'
      OR (body #>> '{data,attributes,test_mode}')::boolean IS DISTINCT FROM (p_environment = 'test') THEN
      RETURN QUERY SELECT 'CHANNEL_MISMATCH'::text,NULL::uuid; RETURN;
    END IF;
  EXCEPTION WHEN data_exception THEN
    RETURN QUERY SELECT 'MALFORMED'::text,NULL::uuid; RETURN;
  END;
  hash := encode(extensions.digest(p_payload,'sha256'),'hex');
  INSERT INTO sales.payment_inbox_events(environment,event_name,provider_order_id,payload,body_hash,signature)
    VALUES(p_environment,event_type,resource_id,p_payload,hash,p_signature)
    ON CONFLICT(environment,event_name,provider_order_id,body_hash) DO NOTHING RETURNING id INTO inserted_id;
  IF inserted_id IS NOT NULL THEN RETURN QUERY SELECT 'ACCEPTED'::text,inserted_id;
  ELSE
    SELECT i.id INTO inserted_id FROM sales.payment_inbox_events i WHERE i.environment = p_environment
      AND i.event_name = event_type AND i.provider_order_id = resource_id AND i.body_hash = hash;
    RETURN QUERY SELECT 'DUPLICATE'::text,inserted_id;
  END IF;
END $$;
ALTER FUNCTION sales.ingest_payment_webhook_event(bytea,text,text,text) OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.ingest_payment_webhook_event(bytea,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA sales TO payment_ingestion_role;
GRANT EXECUTE ON FUNCTION sales.ingest_payment_webhook_event(bytea,text,text,text) TO payment_ingestion_role;
REVOKE CREATE ON SCHEMA core,sales FROM payments_rpc_owner;
REVOKE payments_rpc_owner FROM CURRENT_USER;
COMMIT;
