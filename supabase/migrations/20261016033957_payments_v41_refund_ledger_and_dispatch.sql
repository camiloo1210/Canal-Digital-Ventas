-- ADR-PAY-001 option 1: bounded refund transitions, no order/inventory DML.
-- Writers stay disabled throughout provisioning and verification.
BEGIN;
GRANT payments_rpc_owner TO CURRENT_USER;
GRANT USAGE,CREATE ON SCHEMA sales TO payments_rpc_owner;
DO $$ DECLARE actor text; BEGIN
  FOREACH actor IN ARRAY ARRAY['payment_egress_role','payment_admin_proxy_role','payment_retention_role'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=actor) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',actor);
    END IF;
  END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS sales.payment_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES core.tenants(id),
  payment_id uuid REFERENCES sales.payments(id), source text NOT NULL,
  severity text NOT NULL CHECK(severity IN('LOW','MEDIUM','HIGH','CRITICAL')),
  code text NOT NULL CHECK(code ~ '^[A-Z][A-Z0-9_]{0,95}$'),
  details jsonb NOT NULL CHECK(octet_length(details::text)<=65536), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sales.payment_anomalies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.payment_anomalies FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON sales.payment_anomalies TO payments_rpc_owner;
DROP POLICY IF EXISTS payment_anomalies_read ON sales.payment_anomalies;
CREATE POLICY payment_anomalies_read ON sales.payment_anomalies FOR SELECT TO payments_rpc_owner USING(true);
DROP POLICY IF EXISTS payment_anomalies_insert ON sales.payment_anomalies;
CREATE POLICY payment_anomalies_insert ON sales.payment_anomalies FOR INSERT TO payments_rpc_owner WITH CHECK(true);

CREATE OR REPLACE FUNCTION sales.record_payment_anomaly(p_source text,p_severity text,p_code text,p_details jsonb,p_payment_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales AS $$
DECLARE anomaly uuid:=gen_random_uuid(); target_tenant uuid;
BEGIN
  IF NOT (pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER') OR pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER')
    OR pg_catalog.pg_has_role(session_user,'payment_ingestion_role','MEMBER') OR pg_catalog.pg_has_role(session_user,'payment_egress_role','MEMBER')
    OR pg_catalog.pg_has_role(session_user,'payment_admin_proxy_role','MEMBER') OR pg_catalog.pg_has_role(session_user,'payment_retention_role','MEMBER')
    OR pg_catalog.pg_has_role(session_user,'payment_order_domain_role','MEMBER')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_source IS NULL OR p_source NOT IN('INGESTION','WORKER','RECONCILIATION','EGRESS','ADMIN','RETENTION','DOMAIN','MONITOR') THEN RAISE EXCEPTION 'Invalid anomaly source' USING ERRCODE='FZ004'; END IF;
  IF p_severity IS NULL OR p_severity NOT IN('LOW','MEDIUM','HIGH','CRITICAL') THEN RAISE EXCEPTION 'Invalid anomaly severity' USING ERRCODE='FZ005'; END IF;
  IF p_details IS NULL OR octet_length(p_details::text)>65536 OR p_code IS NULL OR p_code !~ '^[A-Z][A-Z0-9_]{0,95}$' THEN RAISE EXCEPTION 'Invalid anomaly payload' USING ERRCODE='FZ006'; END IF;
  IF p_payment_id IS NOT NULL THEN SELECT tenant_id INTO target_tenant FROM sales.payments WHERE id=p_payment_id; END IF;
  INSERT INTO sales.payment_anomalies(id,tenant_id,payment_id,source,severity,code,details) VALUES(anomaly,target_tenant,p_payment_id,p_source,p_severity,p_code,p_details);
  RETURN anomaly;
END $$;

CREATE TABLE IF NOT EXISTS sales.refund_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL,order_id uuid NOT NULL,tenant_id uuid NOT NULL,
  provider_order_id text NOT NULL CHECK(provider_order_id ~ '^[1-9][0-9]*$'),
  environment text NOT NULL CHECK(environment IN('test','production')),
  amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 1 AND 9007199254740991),baseline_refunded_cents integer NOT NULL CHECK(baseline_refunded_cents>=0),
  intention text NOT NULL CHECK(intention IN('CUSTOMER_REQUEST','ADMIN_REQUEST','LATE_PAYMENT_COMPENSATION','EXTERNAL_PROVIDER_DASHBOARD')),
  requested_by uuid,compensation_obligation_id uuid REFERENCES sales.compensation_obligations(id),
  idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','DISPATCHING','REQUEST_ACCEPTED_BY_GATEWAY','RECONCILING','CONFIRMED_CAUSAL',
    'CLOSED_BY_OBSERVED_COVERAGE','CLOSED_BY_ADMIN_RESOLUTION','EXTERNAL_SETTLED_OBSERVED','OBSERVED_UNATTRIBUTED','AMBIGUOUS_UNRESOLVED_EXPOSURE',
    'FAILED_GATEWAY_REJECTED','FAILED_BY_ADMIN_ATTESTATION','ADMINISTRATIVE_LOSS_WRITE_OFF')),
  attribution_basis text CHECK(attribution_basis IN('PROVIDER_REFUND_ID','ADMINISTRATIVE_ATTESTATION','EXTERNAL_OBSERVATION')),
  provider_refund_id text,worker_token uuid,lease_until timestamptz,
  dispatch_attempted_at timestamptz,dispatch_count integer NOT NULL DEFAULT 0 CHECK(dispatch_count BETWEEN 0 AND 1),
  reconciliation_attempts integer NOT NULL DEFAULT 0 CHECK(reconciliation_attempts>=0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),last_evidence_at timestamptz,last_verification_id uuid,
  gateway_rejection_status integer CHECK(gateway_rejection_status IN(400,401,403,404,422)),
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,idempotency_key),FOREIGN KEY(payment_id,order_id,tenant_id) REFERENCES sales.payments(id,order_id,tenant_id),
  CHECK(status NOT IN('DISPATCHING','RECONCILING') OR (worker_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK(status<>'CONFIRMED_CAUSAL'), -- L3: the provider has no refund_id; never fabricate causal attribution.
  CHECK(status<>'CLOSED_BY_OBSERVED_COVERAGE' OR attribution_basis IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS refund_one_open_operation ON sales.refund_operations(payment_id) WHERE status IN(
  'PENDING','DISPATCHING','REQUEST_ACCEPTED_BY_GATEWAY','RECONCILING','OBSERVED_UNATTRIBUTED','AMBIGUOUS_UNRESOLVED_EXPOSURE');
ALTER TABLE sales.refund_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.refund_operations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON sales.refund_operations TO payments_rpc_owner;
GRANT UPDATE(status,attribution_basis,worker_token,lease_until,dispatch_attempted_at,dispatch_count,reconciliation_attempts,next_attempt_at,
  last_evidence_at,last_verification_id,gateway_rejection_status,updated_at) ON sales.refund_operations TO payments_rpc_owner;
DROP POLICY IF EXISTS refund_rpc_read ON sales.refund_operations;
CREATE POLICY refund_rpc_read ON sales.refund_operations FOR SELECT TO payments_rpc_owner USING(true);
DROP POLICY IF EXISTS refund_rpc_insert ON sales.refund_operations;
CREATE POLICY refund_rpc_insert ON sales.refund_operations FOR INSERT TO payments_rpc_owner WITH CHECK(true);
DROP POLICY IF EXISTS refund_rpc_update ON sales.refund_operations;
CREATE POLICY refund_rpc_update ON sales.refund_operations FOR UPDATE TO payments_rpc_owner USING(true) WITH CHECK(true);
GRANT SELECT ON sales.refund_operations TO authenticated;
DROP POLICY IF EXISTS refund_tenant_read ON sales.refund_operations;
CREATE POLICY refund_tenant_read ON sales.refund_operations FOR SELECT TO authenticated USING((SELECT core.user_has_access_to_tenant(tenant_id)));
GRANT SELECT(user_id,tenant_id,role,status) ON core.tenant_memberships TO payments_rpc_owner;
DROP POLICY IF EXISTS payment_membership_read ON core.tenant_memberships;
CREATE POLICY payment_membership_read ON core.tenant_memberships FOR SELECT TO payments_rpc_owner USING(true);

CREATE TABLE IF NOT EXISTS sales.external_refund_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payment_id uuid NOT NULL REFERENCES sales.payments(id),operation_id uuid REFERENCES sales.refund_operations(id),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id),verification_id uuid,inbox_event_id uuid REFERENCES sales.payment_inbox_events(id),
  prior_book_cents bigint NOT NULL CHECK(prior_book_cents>=0),observed_total_refunded_cents bigint NOT NULL CHECK(observed_total_refunded_cents>=0),
  technically_attributed_delta_cents bigint NOT NULL DEFAULT 0 CHECK(technically_attributed_delta_cents=0),
  administratively_attributed_delta_cents bigint NOT NULL DEFAULT 0 CHECK(administratively_attributed_delta_cents>=0),
  unattributed_delta_cents bigint NOT NULL CHECK(unattributed_delta_cents>=0),
  attribution_basis text CHECK(attribution_basis IN('PROVIDER_REFUND_ID','ADMINISTRATIVE_ATTESTATION','EXTERNAL_OBSERVATION')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(prior_book_cents+technically_attributed_delta_cents+administratively_attributed_delta_cents+unattributed_delta_cents=observed_total_refunded_cents),
  CHECK((verification_id IS NOT NULL)::int+(inbox_event_id IS NOT NULL)::int=1),
  UNIQUE(verification_id),UNIQUE(inbox_event_id)
);
ALTER TABLE sales.external_refund_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.external_refund_observations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON sales.external_refund_observations TO payments_rpc_owner;
DROP POLICY IF EXISTS refund_observations_read ON sales.external_refund_observations;
CREATE POLICY refund_observations_read ON sales.external_refund_observations FOR SELECT TO payments_rpc_owner USING(true);
DROP POLICY IF EXISTS refund_observations_insert ON sales.external_refund_observations;
CREATE POLICY refund_observations_insert ON sales.external_refund_observations FOR INSERT TO payments_rpc_owner WITH CHECK(true);

CREATE OR REPLACE FUNCTION sales.reject_payment_ledger_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Append-only record' USING ERRCODE='FZ900'; END $$;
DROP TRIGGER IF EXISTS payment_anomalies_immutable ON sales.payment_anomalies;
CREATE TRIGGER payment_anomalies_immutable BEFORE UPDATE OR DELETE ON sales.payment_anomalies FOR EACH ROW EXECUTE FUNCTION sales.reject_payment_ledger_mutation();
DROP TRIGGER IF EXISTS refund_observations_immutable ON sales.external_refund_observations;
CREATE TRIGGER refund_observations_immutable BEFORE UPDATE OR DELETE ON sales.external_refund_observations FOR EACH ROW EXECUTE FUNCTION sales.reject_payment_ledger_mutation();

CREATE OR REPLACE FUNCTION sales.guard_refund_operation_transition() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF ROW(NEW.id,NEW.payment_id,NEW.order_id,NEW.tenant_id,NEW.provider_order_id,NEW.environment,NEW.amount_cents,NEW.baseline_refunded_cents,
    NEW.intention,NEW.requested_by,NEW.compensation_obligation_id,NEW.idempotency_key,NEW.request_hash,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.payment_id,OLD.order_id,OLD.tenant_id,OLD.provider_order_id,OLD.environment,OLD.amount_cents,OLD.baseline_refunded_cents,
    OLD.intention,OLD.requested_by,OLD.compensation_obligation_id,OLD.idempotency_key,OLD.request_hash,OLD.created_at) THEN RAISE EXCEPTION 'Refund identity immutable' USING ERRCODE='FZ124'; END IF;
  IF OLD.dispatch_attempted_at IS NOT NULL AND NEW.dispatch_attempted_at IS DISTINCT FROM OLD.dispatch_attempted_at THEN RAISE EXCEPTION 'Dispatch cannot be repeated' USING ERRCODE='FZ050'; END IF;
  IF NEW.dispatch_count<OLD.dispatch_count THEN RAISE EXCEPTION 'Dispatch count cannot decrease' USING ERRCODE='FZ050'; END IF;
  IF NEW.status=OLD.status THEN RETURN NEW; END IF;
  IF (OLD.status='PENDING' AND NEW.status='DISPATCHING')
    OR (OLD.status='DISPATCHING' AND NEW.status IN('REQUEST_ACCEPTED_BY_GATEWAY','AMBIGUOUS_UNRESOLVED_EXPOSURE','FAILED_GATEWAY_REJECTED'))
    OR (OLD.status='REQUEST_ACCEPTED_BY_GATEWAY' AND NEW.status IN('RECONCILING','AMBIGUOUS_UNRESOLVED_EXPOSURE'))
    OR (OLD.status='RECONCILING' AND NEW.status IN('REQUEST_ACCEPTED_BY_GATEWAY','CLOSED_BY_OBSERVED_COVERAGE','OBSERVED_UNATTRIBUTED','AMBIGUOUS_UNRESOLVED_EXPOSURE'))
    OR (OLD.status IN('AMBIGUOUS_UNRESOLVED_EXPOSURE','OBSERVED_UNATTRIBUTED') AND NEW.status IN('FAILED_BY_ADMIN_ATTESTATION','CLOSED_BY_ADMIN_RESOLUTION','ADMINISTRATIVE_LOSS_WRITE_OFF')) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Illegal refund transition' USING ERRCODE='FZ050';
END $$;
DROP TRIGGER IF EXISTS refund_operation_transition ON sales.refund_operations;
CREATE TRIGGER refund_operation_transition BEFORE UPDATE ON sales.refund_operations FOR EACH ROW EXECUTE FUNCTION sales.guard_refund_operation_transition();

DROP POLICY IF EXISTS payments_outbox_insert ON core.outbox_events;
DROP POLICY IF EXISTS payments_outbox_insert ON core.outbox_events;
CREATE POLICY payments_outbox_insert ON core.outbox_events FOR INSERT TO payments_rpc_owner WITH CHECK (
  (aggregate_type='Payment' AND event_type IN('sales.payment.completed','sales.payment.checkout_expired','sales.payment.late_payment','sales.payment.refund_observed')
    AND EXISTS(SELECT 1 FROM sales.payments p WHERE p.id=aggregate_id AND p.tenant_id=outbox_events.tenant_id))
  OR (aggregate_type='RefundOperation' AND event_type IN('sales.refund.requested','sales.refund.resolution_proposed','sales.refund.resolution_approved')
    AND EXISTS(SELECT 1 FROM sales.refund_operations r WHERE r.id=aggregate_id AND r.tenant_id=outbox_events.tenant_id))
);

CREATE OR REPLACE FUNCTION sales.create_refund_operation(p_payment_id uuid,p_tenant_id uuid,p_amount_cents integer,
  p_idempotency_key text,p_intention text,p_actor_user_id uuid,p_obligation_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales,core AS $$
DECLARE pay sales.payments%ROWTYPE; existing sales.refund_operations%ROWTYPE; fingerprint text; operation uuid:=gen_random_uuid();
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM core.system_flags WHERE name='payments_v41_writers_enabled' AND enabled) THEN RAISE EXCEPTION 'Writers disabled' USING ERRCODE='FZ121'; END IF;
  SET LOCAL lock_timeout='5s';
  IF p_intention IS NULL OR p_intention NOT IN('CUSTOMER_REQUEST','ADMIN_REQUEST','LATE_PAYMENT_COMPENSATION') THEN RAISE EXCEPTION 'Invalid refund intention' USING ERRCODE='FZ047'; END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Invalid idempotency key' USING ERRCODE='FZ043'; END IF;
  SELECT * INTO pay FROM sales.payments p WHERE p.id=p_payment_id AND p.tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not authorized' USING ERRCODE='FZ044'; END IF;
  IF p_intention='CUSTOMER_REQUEST' AND NOT EXISTS(SELECT 1 FROM sales.customers c WHERE c.id=pay.customer_id AND c.tenant_id=pay.tenant_id AND c.global_auth_id=p_actor_user_id) THEN RAISE EXCEPTION 'Refund not authorized' USING ERRCODE='FZ044'; END IF;
  IF p_intention='ADMIN_REQUEST' AND NOT EXISTS(SELECT 1 FROM core.tenant_memberships m WHERE m.user_id=p_actor_user_id AND m.tenant_id=pay.tenant_id AND m.status='active' AND m.role IN('OWNER','ADMIN')) THEN RAISE EXCEPTION 'Refund not authorized' USING ERRCODE='FZ044'; END IF;
  IF p_intention='LATE_PAYMENT_COMPENSATION' AND NOT EXISTS(SELECT 1 FROM sales.compensation_obligations c WHERE c.id=p_obligation_id AND c.payment_id=pay.id AND c.tenant_id=pay.tenant_id AND c.status='OPEN') THEN RAISE EXCEPTION 'Compensation obligation mismatch' USING ERRCODE='FZ045'; END IF;
  fingerprint:=encode(extensions.digest(convert_to(jsonb_build_object('payment_id',p_payment_id,'tenant_id',p_tenant_id,'amount_cents',p_amount_cents,
    'intention',p_intention,'actor',p_actor_user_id,'obligation',p_obligation_id)::text,'UTF8'),'sha256'),'hex');
  SELECT * INTO existing FROM sales.refund_operations r WHERE r.tenant_id=p_tenant_id AND r.idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF existing.request_hash<>fingerprint THEN RAISE EXCEPTION 'Idempotency payload mismatch' USING ERRCODE='FZ043'; END IF;
    RETURN existing.id;
  END IF;
  IF pay.environment='legacy_unclassified' OR pay.gateway<>'lemon_squeezy' OR pay.gateway_transaction_id IS NULL
    OR pay.status NOT IN('completed','partially_refunded','late_payment_pending_compensation') THEN RAISE EXCEPTION 'Payment not refundable' USING ERRCODE='FZ040'; END IF;
  IF EXISTS(SELECT 1 FROM sales.refund_operations r WHERE r.payment_id=pay.id AND r.status='ADMINISTRATIVE_LOSS_WRITE_OFF') THEN RAISE EXCEPTION 'Written-off refund blocks dispatch' USING ERRCODE='FZ046'; END IF;
  IF p_amount_cents IS NULL OR p_amount_cents<=0 OR p_amount_cents>pay.amount_cents-pay.refunded_amount_cents THEN RAISE EXCEPTION 'Refund exceeds balance' USING ERRCODE='FZ041'; END IF;
  IF EXISTS(SELECT 1 FROM sales.refund_operations r WHERE r.payment_id=pay.id AND r.status IN('PENDING','DISPATCHING','REQUEST_ACCEPTED_BY_GATEWAY','RECONCILING','OBSERVED_UNATTRIBUTED','AMBIGUOUS_UNRESOLVED_EXPOSURE')) THEN RAISE EXCEPTION 'Open refund operation exists' USING ERRCODE='FZ042'; END IF;
  INSERT INTO sales.refund_operations(id,payment_id,order_id,tenant_id,provider_order_id,environment,amount_cents,baseline_refunded_cents,
    intention,requested_by,compensation_obligation_id,idempotency_key,request_hash)
    VALUES(operation,pay.id,pay.order_id,pay.tenant_id,pay.gateway_transaction_id,pay.environment,p_amount_cents,pay.refunded_amount_cents,
      p_intention,p_actor_user_id,p_obligation_id,p_idempotency_key,fingerprint);
  INSERT INTO core.outbox_events(id,tenant_id,aggregate_type,aggregate_id,event_type,payload)
    VALUES(gen_random_uuid(),pay.tenant_id,'RefundOperation',operation,'sales.refund.requested',jsonb_build_object('operationId',operation,'paymentId',pay.id,'tenantId',pay.tenant_id));
  RETURN operation;
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO existing FROM sales.refund_operations r WHERE r.tenant_id=p_tenant_id AND r.idempotency_key=p_idempotency_key;
  IF FOUND AND existing.request_hash=fingerprint THEN RETURN existing.id; END IF;
  RAISE EXCEPTION 'Idempotency payload mismatch' USING ERRCODE='FZ043';
END $$;

CREATE OR REPLACE FUNCTION sales.claim_and_mark_dispatching(p_worker_token uuid)
RETURNS TABLE(operation_id uuid,payment_id uuid,provider_order_id text,environment text,amount_cents integer,store_id text,currency text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales,core AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_worker_token IS NULL THEN RAISE EXCEPTION 'Invalid worker token' USING ERRCODE='FZ002'; END IF;
  IF NOT EXISTS(SELECT 1 FROM core.system_flags WHERE name='payments_v41_writers_enabled' AND enabled) THEN RETURN; END IF;
  RETURN QUERY UPDATE sales.refund_operations r SET status='DISPATCHING',worker_token=p_worker_token,lease_until=clock_timestamp()+interval '30 seconds',
    dispatch_attempted_at=clock_timestamp(),dispatch_count=1,updated_at=clock_timestamp()
    WHERE r.id=(SELECT c.id FROM sales.refund_operations c WHERE c.status='PENDING' AND c.dispatch_count=0 AND c.next_attempt_at<=clock_timestamp()
      ORDER BY c.created_at,c.id FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING r.id,r.payment_id,r.provider_order_id,r.environment,r.amount_cents::integer,
      (SELECT p.store_id FROM sales.payments p WHERE p.id=r.payment_id),(SELECT p.currency FROM sales.payments p WHERE p.id=r.payment_id);
END $$;

CREATE OR REPLACE FUNCTION sales.mark_refund_submitted(p_operation_id uuid,p_worker_token uuid,p_response_order_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales AS $$
DECLARE operation sales.refund_operations%ROWTYPE;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO operation FROM sales.refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND OR operation.status<>'DISPATCHING' THEN RAISE EXCEPTION 'Invalid refund state' USING ERRCODE='FZ050'; END IF;
  IF operation.worker_token IS DISTINCT FROM p_worker_token OR p_worker_token IS NULL OR operation.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Stale refund lease' USING ERRCODE='FZ003'; END IF;
  IF operation.provider_order_id IS DISTINCT FROM p_response_order_id THEN RAISE EXCEPTION 'Response order mismatch' USING ERRCODE='FZ051'; END IF;
  UPDATE sales.refund_operations SET status='REQUEST_ACCEPTED_BY_GATEWAY',worker_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+interval '5 seconds',updated_at=clock_timestamp() WHERE id=p_operation_id;
END $$;

CREATE OR REPLACE FUNCTION sales.mark_refund_ambiguous_on_timeout(p_operation_id uuid,p_worker_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales AS $$
DECLARE operation sales.refund_operations%ROWTYPE;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO operation FROM sales.refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND OR operation.status<>'DISPATCHING' THEN RAISE EXCEPTION 'Invalid refund state' USING ERRCODE='FZ050'; END IF;
  IF operation.worker_token IS DISTINCT FROM p_worker_token OR p_worker_token IS NULL THEN RAISE EXCEPTION 'Stale refund lease' USING ERRCODE='FZ003'; END IF;
  UPDATE sales.refund_operations SET status='AMBIGUOUS_UNRESOLVED_EXPOSURE',worker_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+interval '15 minutes',updated_at=clock_timestamp() WHERE id=p_operation_id;
  PERFORM sales.record_payment_anomaly('WORKER','HIGH','REFUND_DISPATCH_AMBIGUOUS',jsonb_build_object('operationId',p_operation_id),operation.payment_id);
END $$;

CREATE OR REPLACE FUNCTION sales.mark_refund_failed_from_gateway(p_operation_id uuid,p_worker_token uuid,p_http_status integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales AS $$
DECLARE operation sales.refund_operations%ROWTYPE;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO operation FROM sales.refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND OR operation.status<>'DISPATCHING' THEN RAISE EXCEPTION 'Invalid refund state' USING ERRCODE='FZ050'; END IF;
  IF operation.worker_token IS DISTINCT FROM p_worker_token OR p_worker_token IS NULL OR operation.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Stale refund lease' USING ERRCODE='FZ003'; END IF;
  IF p_http_status IS NULL OR p_http_status NOT IN(400,401,403,404,422) THEN RAISE EXCEPTION 'Rejection is not definitive' USING ERRCODE='FZ052'; END IF;
  UPDATE sales.refund_operations SET status='FAILED_GATEWAY_REJECTED',gateway_rejection_status=p_http_status,worker_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=p_operation_id;
END $$;

ALTER FUNCTION sales.record_payment_anomaly(text,text,text,jsonb,uuid) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.create_refund_operation(uuid,uuid,integer,text,text,uuid,uuid) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.claim_and_mark_dispatching(uuid) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.mark_refund_submitted(uuid,uuid,text) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.mark_refund_ambiguous_on_timeout(uuid,uuid) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.mark_refund_failed_from_gateway(uuid,uuid,integer) OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.reject_payment_ledger_mutation() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.guard_refund_operation_transition() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sales.reject_payment_ledger_mutation() TO payments_rpc_owner;
GRANT EXECUTE ON FUNCTION sales.guard_refund_operation_transition() TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.record_payment_anomaly(text,text,text,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.create_refund_operation(uuid,uuid,integer,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.claim_and_mark_dispatching(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.mark_refund_submitted(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.mark_refund_ambiguous_on_timeout(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.mark_refund_failed_from_gateway(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sales.record_payment_anomaly(text,text,text,jsonb,uuid) TO payment_worker_role,payment_ingestion_role,payment_reconciliation_role,payment_egress_role,payment_admin_proxy_role,payment_retention_role,payment_order_domain_role;
GRANT EXECUTE ON FUNCTION sales.create_refund_operation(uuid,uuid,integer,text,text,uuid,uuid) TO payment_worker_role;
GRANT EXECUTE ON FUNCTION sales.claim_and_mark_dispatching(uuid) TO payment_worker_role;
GRANT EXECUTE ON FUNCTION sales.mark_refund_submitted(uuid,uuid,text) TO payment_worker_role;
GRANT EXECUTE ON FUNCTION sales.mark_refund_ambiguous_on_timeout(uuid,uuid) TO payment_worker_role;
GRANT EXECUTE ON FUNCTION sales.mark_refund_failed_from_gateway(uuid,uuid,integer) TO payment_worker_role;
GRANT USAGE ON SCHEMA sales TO payment_egress_role,payment_admin_proxy_role,payment_retention_role;
REVOKE CREATE ON SCHEMA sales FROM payments_rpc_owner;
REVOKE payments_rpc_owner FROM CURRENT_USER;
COMMIT;
