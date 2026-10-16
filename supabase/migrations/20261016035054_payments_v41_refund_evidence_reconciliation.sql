BEGIN;
GRANT payments_rpc_owner TO CURRENT_USER;
GRANT USAGE,CREATE ON SCHEMA sales TO payments_rpc_owner;
-- Receipt time must be the actual insert time, including inside a longer transaction.
ALTER TABLE sales.payment_inbox_events ALTER COLUMN created_at SET DEFAULT clock_timestamp();
CREATE TABLE IF NOT EXISTS sales.payment_api_egress_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),operation_id uuid REFERENCES sales.refund_operations(id),
  payment_id uuid NOT NULL REFERENCES sales.payments(id),tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  provider_order_id text NOT NULL CHECK(provider_order_id ~ '^[1-9][0-9]*$'),
  url text NOT NULL CHECK(url ~ '^https://api\.lemonsqueezy\.com/v1/orders/[1-9][0-9]*$'),
  worker_token uuid NOT NULL,expires_at timestamptz NOT NULL,consumed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sales.payment_api_egress_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.payment_api_egress_tickets FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON sales.payment_api_egress_tickets TO payments_rpc_owner;
GRANT UPDATE(consumed_at) ON sales.payment_api_egress_tickets TO payments_rpc_owner;
DROP POLICY IF EXISTS payment_tickets_read ON sales.payment_api_egress_tickets;
CREATE POLICY payment_tickets_read ON sales.payment_api_egress_tickets FOR SELECT TO payments_rpc_owner USING(true);
DROP POLICY IF EXISTS payment_tickets_insert ON sales.payment_api_egress_tickets;
CREATE POLICY payment_tickets_insert ON sales.payment_api_egress_tickets FOR INSERT TO payments_rpc_owner WITH CHECK(true);
DROP POLICY IF EXISTS payment_tickets_update ON sales.payment_api_egress_tickets;
CREATE POLICY payment_tickets_update ON sales.payment_api_egress_tickets FOR UPDATE TO payments_rpc_owner USING(true) WITH CHECK(true);
CREATE TABLE IF NOT EXISTS sales.payment_api_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL UNIQUE REFERENCES sales.payment_api_egress_tickets(id),
  operation_id uuid REFERENCES sales.refund_operations(id),payment_id uuid NOT NULL REFERENCES sales.payments(id),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id),provider_order_id text NOT NULL,
  environment text NOT NULL CHECK(environment IN('test','production')),store_id text NOT NULL,currency text NOT NULL,
  worker_token uuid NOT NULL,http_status integer NOT NULL CHECK(http_status=200),url text NOT NULL,
  payload bytea NOT NULL CHECK(octet_length(payload) BETWEEN 1 AND 1048576),body_hash text NOT NULL CHECK(body_hash ~ '^[a-f0-9]{64}$'),
  response_headers jsonb NOT NULL CHECK(octet_length(response_headers::text)<=65536),
  observed_refunded_cents bigint CHECK(observed_refunded_cents BETWEEN 0 AND 9007199254740991),
  refunded_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),purged_at timestamptz
);
ALTER TABLE sales.payment_api_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.payment_api_verifications FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON sales.payment_api_verifications TO payments_rpc_owner;
DROP POLICY IF EXISTS payment_verifications_read ON sales.payment_api_verifications;
CREATE POLICY payment_verifications_read ON sales.payment_api_verifications FOR SELECT TO payments_rpc_owner USING(true);
DROP POLICY IF EXISTS payment_verifications_insert ON sales.payment_api_verifications;
CREATE POLICY payment_verifications_insert ON sales.payment_api_verifications FOR INSERT TO payments_rpc_owner WITH CHECK(true);
DROP TRIGGER IF EXISTS payment_verifications_immutable ON sales.payment_api_verifications;
CREATE TRIGGER payment_verifications_immutable BEFORE UPDATE OR DELETE ON sales.payment_api_verifications FOR EACH ROW EXECUTE FUNCTION sales.reject_payment_ledger_mutation();
CREATE TABLE IF NOT EXISTS sales.payment_verification_applications (
  verification_id uuid PRIMARY KEY REFERENCES sales.payment_api_verifications(id),payment_id uuid NOT NULL REFERENCES sales.payments(id),
  operation_id uuid REFERENCES sales.refund_operations(id),created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sales.payment_verification_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales.payment_verification_applications FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON sales.payment_verification_applications TO payments_rpc_owner;
DROP POLICY IF EXISTS payment_applications_read ON sales.payment_verification_applications;
CREATE POLICY payment_applications_read ON sales.payment_verification_applications FOR SELECT TO payments_rpc_owner USING(true);
DROP POLICY IF EXISTS payment_applications_insert ON sales.payment_verification_applications;
CREATE POLICY payment_applications_insert ON sales.payment_verification_applications FOR INSERT TO payments_rpc_owner WITH CHECK(true);
DROP TRIGGER IF EXISTS payment_applications_immutable ON sales.payment_verification_applications;
CREATE TRIGGER payment_applications_immutable BEFORE UPDATE OR DELETE ON sales.payment_verification_applications FOR EACH ROW EXECUTE FUNCTION sales.reject_payment_ledger_mutation();
GRANT UPDATE(refunded_amount_cents) ON sales.payments TO payments_rpc_owner;
GRANT UPDATE(status) ON sales.compensation_obligations TO payments_rpc_owner;
DROP POLICY IF EXISTS payments_obligation_update ON sales.compensation_obligations;
CREATE POLICY payments_obligation_update ON sales.compensation_obligations FOR UPDATE TO payments_rpc_owner USING(true) WITH CHECK(true);

CREATE OR REPLACE FUNCTION sales.claim_refunds_for_reconciliation(p_worker_token uuid,p_mode text)
RETURNS TABLE(operation_id uuid,payment_id uuid,provider_order_id text,environment text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales,core AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_worker_token IS NULL THEN RAISE EXCEPTION 'Invalid worker token' USING ERRCODE='FZ002'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN('SETTLEMENT','EVIDENCE') THEN RAISE EXCEPTION 'Invalid reconciliation mode' USING ERRCODE='FZ050'; END IF;
  IF NOT EXISTS(SELECT 1 FROM core.system_flags WHERE name='payments_v41_writers_enabled' AND enabled) THEN RETURN; END IF;
  RETURN QUERY UPDATE sales.refund_operations r SET status=CASE WHEN p_mode='SETTLEMENT' THEN 'RECONCILING' ELSE r.status END,
    worker_token=p_worker_token,lease_until=clock_timestamp()+interval '30 seconds',reconciliation_attempts=r.reconciliation_attempts+1,
    next_attempt_at=clock_timestamp()+interval '15 minutes',updated_at=clock_timestamp()
    WHERE r.id=(SELECT c.id FROM sales.refund_operations c WHERE c.next_attempt_at<=clock_timestamp()
      AND (c.lease_until IS NULL OR c.lease_until<clock_timestamp())
      AND ((p_mode='SETTLEMENT' AND c.status='REQUEST_ACCEPTED_BY_GATEWAY') OR
        (p_mode='EVIDENCE' AND c.status IN('AMBIGUOUS_UNRESOLVED_EXPOSURE','OBSERVED_UNATTRIBUTED')))
      ORDER BY c.next_attempt_at,c.id FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING r.id,r.payment_id,r.provider_order_id,r.environment;
END $$;

CREATE OR REPLACE FUNCTION sales.issue_egress_ticket(p_payment_id uuid,p_operation_id uuid,p_worker_token uuid)
RETURNS TABLE(ticket_id uuid,url text,environment text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales,core AS $$
DECLARE pay sales.payments%ROWTYPE; operation sales.refund_operations%ROWTYPE; ticket uuid:=gen_random_uuid(); endpoint text;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_worker_token IS NULL THEN RAISE EXCEPTION 'Invalid worker token' USING ERRCODE='FZ002'; END IF;
  IF NOT EXISTS(SELECT 1 FROM core.system_flags WHERE name='payments_v41_writers_enabled' AND enabled) THEN RAISE EXCEPTION 'Writers disabled' USING ERRCODE='FZ121'; END IF;
  SELECT * INTO pay FROM sales.payments WHERE id=p_payment_id;
  IF NOT FOUND OR pay.environment='legacy_unclassified' OR pay.gateway<>'lemon_squeezy' OR pay.gateway_transaction_id IS NULL OR pay.gateway_transaction_id !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Invalid provider order' USING ERRCODE='FZ070'; END IF;
  IF p_operation_id IS NOT NULL THEN
    SELECT * INTO operation FROM sales.refund_operations WHERE id=p_operation_id AND payment_id=pay.id;
    IF NOT FOUND OR operation.status NOT IN('RECONCILING','AMBIGUOUS_UNRESOLVED_EXPOSURE','OBSERVED_UNATTRIBUTED') OR
      operation.worker_token IS DISTINCT FROM p_worker_token OR operation.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Stale refund lease' USING ERRCODE='FZ003'; END IF;
  ELSIF EXISTS(SELECT 1 FROM sales.refund_operations WHERE payment_id=pay.id AND status IN('PENDING','DISPATCHING','REQUEST_ACCEPTED_BY_GATEWAY','RECONCILING','AMBIGUOUS_UNRESOLVED_EXPOSURE','OBSERVED_UNATTRIBUTED')) THEN
    RAISE EXCEPTION 'Open refund blocks external reconciliation' USING ERRCODE='FZ087';
  END IF;
  endpoint:='https://api.lemonsqueezy.com/v1/orders/'||pay.gateway_transaction_id;
  INSERT INTO sales.payment_api_egress_tickets(id,operation_id,payment_id,tenant_id,provider_order_id,url,worker_token,expires_at)
    VALUES(ticket,p_operation_id,pay.id,pay.tenant_id,pay.gateway_transaction_id,endpoint,p_worker_token,clock_timestamp()+interval '30 seconds');
  RETURN QUERY SELECT ticket,endpoint,pay.environment;
END $$;

CREATE OR REPLACE FUNCTION sales.record_api_verification(p_ticket_id uuid,p_worker_token uuid,p_url text,p_http_status integer,
  p_payload bytea,p_sha256 text,p_response_headers jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales,core AS $$
DECLARE ticket sales.payment_api_egress_tickets%ROWTYPE; pay sales.payments%ROWTYPE; operation sales.refund_operations%ROWTYPE;
  body jsonb; attrs jsonb; observed bigint; observed_at timestamptz; verification uuid:=gen_random_uuid(); headers jsonb;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_egress_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_http_status IS DISTINCT FROM 200 THEN RAISE EXCEPTION 'Evidence requires HTTP 200' USING ERRCODE='FZ069'; END IF;
  SELECT * INTO ticket FROM sales.payment_api_egress_tickets WHERE id=p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Egress ticket not found' USING ERRCODE='FZ060'; END IF;
  IF ticket.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'Egress ticket already consumed' USING ERRCODE='FZ061'; END IF;
  IF ticket.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Egress ticket expired' USING ERRCODE='FZ062'; END IF;
  IF ticket.worker_token IS DISTINCT FROM p_worker_token OR p_worker_token IS NULL THEN RAISE EXCEPTION 'Egress worker mismatch' USING ERRCODE='FZ063'; END IF;
  IF ticket.url IS DISTINCT FROM p_url OR p_url !~ '^https://api\.lemonsqueezy\.com/v1/orders/[1-9][0-9]*$' THEN RAISE EXCEPTION 'Egress URL mismatch' USING ERRCODE='FZ064'; END IF;
  IF p_payload IS NULL OR octet_length(p_payload) NOT BETWEEN 1 AND 1048576 OR p_sha256 IS DISTINCT FROM encode(extensions.digest(p_payload,'sha256'),'hex') THEN RAISE EXCEPTION 'Evidence checksum mismatch' USING ERRCODE='FZ066'; END IF;
  SELECT * INTO pay FROM sales.payments WHERE id=ticket.payment_id;
  IF NOT FOUND OR pay.environment='legacy_unclassified' OR pay.gateway<>'lemon_squeezy' OR pay.gateway_transaction_id IS DISTINCT FROM ticket.provider_order_id THEN RAISE EXCEPTION 'Evidence provider order mismatch' USING ERRCODE='FZ071'; END IF;
  IF ticket.operation_id IS NOT NULL THEN
    SELECT * INTO operation FROM sales.refund_operations WHERE id=ticket.operation_id;
    IF operation.worker_token IS DISTINCT FROM p_worker_token OR operation.lease_until<=clock_timestamp() OR operation.status NOT IN('RECONCILING','AMBIGUOUS_UNRESOLVED_EXPOSURE','OBSERVED_UNATTRIBUTED') THEN RAISE EXCEPTION 'Stale refund lease' USING ERRCODE='FZ003'; END IF;
  END IF;
  BEGIN body:=convert_from(p_payload,'UTF8')::jsonb;
    IF body #>> '{data,type}' IS DISTINCT FROM 'orders' THEN RAISE EXCEPTION 'Evidence resource mismatch' USING ERRCODE='FZ065'; END IF;
    IF body #>> '{data,id}' IS DISTINCT FROM ticket.provider_order_id THEN RAISE EXCEPTION 'Evidence resource id mismatch' USING ERRCODE='FZ068'; END IF;
    attrs:=body #> '{data,attributes}';
    IF jsonb_typeof(attrs->'test_mode') IS DISTINCT FROM 'boolean' OR (attrs->>'test_mode')::boolean IS DISTINCT FROM (pay.environment='test') THEN RAISE EXCEPTION 'Evidence environment mismatch' USING ERRCODE='FZ072'; END IF;
    IF attrs->>'currency' IS DISTINCT FROM pay.currency OR attrs->>'store_id' IS DISTINCT FROM pay.store_id OR attrs->>'total' IS DISTINCT FROM pay.amount_cents::text THEN RAISE EXCEPTION 'Evidence required financial field missing or mismatched' USING ERRCODE='FZ073'; END IF;
    IF attrs ? 'refunded_amount' AND attrs->'refunded_amount'<>'null'::jsonb THEN
      IF jsonb_typeof(attrs->'refunded_amount')<>'number' OR attrs->>'refunded_amount' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Invalid observed refund amount' USING ERRCODE='FZ073'; END IF;
      observed:=(attrs->>'refunded_amount')::bigint;
      IF observed>9007199254740991 THEN RAISE EXCEPTION 'Invalid observed refund amount' USING ERRCODE='FZ073'; END IF;
    END IF;
    IF attrs->>'refunded_at' IS NOT NULL THEN observed_at:=(attrs->>'refunded_at')::timestamptz; END IF;
    SELECT coalesce(jsonb_object_agg(h.key,h.value),'{}'::jsonb) INTO headers FROM jsonb_each(p_response_headers) h
      WHERE h.key IN('date','etag','content-type','x-request-id','request-id');
    IF octet_length(headers::text)>65536 THEN RAISE EXCEPTION 'Evidence headers too large' USING ERRCODE='FZ067'; END IF;
  EXCEPTION WHEN data_exception THEN RAISE EXCEPTION 'Malformed evidence' USING ERRCODE='FZ067'; END;
  INSERT INTO sales.payment_api_verifications(id,ticket_id,operation_id,payment_id,tenant_id,provider_order_id,environment,store_id,currency,
    worker_token,http_status,url,payload,body_hash,response_headers,observed_refunded_cents,refunded_at,created_at)
    VALUES(verification,ticket.id,ticket.operation_id,pay.id,pay.tenant_id,ticket.provider_order_id,pay.environment,pay.store_id,pay.currency,
      p_worker_token,200,p_url,p_payload,p_sha256,headers,observed,observed_at,clock_timestamp());
  UPDATE sales.payment_api_egress_tickets SET consumed_at=clock_timestamp() WHERE id=ticket.id;
  RETURN verification;
END $$;

CREATE OR REPLACE FUNCTION sales.confirm_refund_operation_settlement(p_operation_id uuid,p_verification_id uuid,p_worker_token uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales,core AS $$
DECLARE operation sales.refund_operations%ROWTYPE; pay sales.payments%ROWTYPE; evidence sales.payment_api_verifications%ROWTYPE;
  target_payment uuid; observed bigint; expected bigint; signed_count integer; corroborated boolean;
  next_state text; anomaly text; consume_evidence boolean:=false; book_after integer;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM core.system_flags WHERE name='payments_v41_writers_enabled' AND enabled) THEN RAISE EXCEPTION 'Writers disabled' USING ERRCODE='FZ121'; END IF;
  SET LOCAL lock_timeout='5s';
  SELECT payment_id INTO target_payment FROM sales.refund_operations WHERE id=p_operation_id;
  SELECT * INTO pay FROM sales.payments WHERE id=target_payment FOR UPDATE;
  SELECT * INTO operation FROM sales.refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND OR operation.status<>'RECONCILING' THEN RAISE EXCEPTION 'Invalid state for refund confirmation' USING ERRCODE='FZ083'; END IF;
  IF operation.worker_token IS DISTINCT FROM p_worker_token OR p_worker_token IS NULL OR operation.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Stale refund lease' USING ERRCODE='FZ003'; END IF;
  SELECT * INTO evidence FROM sales.payment_api_verifications WHERE id=p_verification_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verification evidence not found' USING ERRCODE='FZ080'; END IF;
  IF evidence.operation_id IS DISTINCT FROM operation.id OR evidence.payment_id<>pay.id OR evidence.worker_token IS DISTINCT FROM p_worker_token THEN RAISE EXCEPTION 'Evidence operation mismatch' USING ERRCODE='FZ081'; END IF;
  IF evidence.created_at<clock_timestamp()-interval '5 minutes' OR evidence.created_at<operation.dispatch_attempted_at THEN RAISE EXCEPTION 'Stale verification evidence' USING ERRCODE='FZ082'; END IF;
  IF EXISTS(SELECT 1 FROM sales.payment_verification_applications WHERE verification_id=evidence.id) THEN RAISE EXCEPTION 'Evidence already applied' USING ERRCODE='FZ088'; END IF;
  observed:=evidence.observed_refunded_cents;expected:=operation.baseline_refunded_cents::bigint+operation.amount_cents;book_after:=pay.refunded_amount_cents;
  SELECT count(*)::integer,coalesce(bool_or(i.body #>> '{data,attributes,refunded_amount}'=observed::text),false)
    INTO signed_count,corroborated FROM (
      SELECT convert_from(e.payload,'UTF8')::jsonb AS body,e.created_at FROM sales.payment_inbox_events e
      WHERE e.event_name='order_refunded' AND e.provider_order_id=pay.gateway_transaction_id AND e.environment=pay.environment
    ) i WHERE i.created_at>=operation.dispatch_attempted_at
      AND i.body #>> '{data,attributes,store_id}'=pay.store_id AND i.body #>> '{data,attributes,currency}'=pay.currency
      AND i.body #>> '{data,attributes,total}'=pay.amount_cents::text
      AND i.body #>> '{data,attributes,refunded_amount}' ~ '^[0-9]+$'
      AND (i.body #>> '{data,attributes,refunded_amount}')::numeric>operation.baseline_refunded_cents;
  IF observed IS NULL THEN next_state:='AMBIGUOUS_UNRESOLVED_EXPOSURE';anomaly:='EVIDENCE_AMOUNT_MISSING';
  ELSIF observed<pay.refunded_amount_cents THEN next_state:='AMBIGUOUS_UNRESOLVED_EXPOSURE';anomaly:='PROVIDER_REFUND_DECREASED';
  ELSIF NOT corroborated OR observed=operation.baseline_refunded_cents THEN
    IF evidence.created_at-operation.dispatch_attempted_at>=interval '24 hours' THEN next_state:='AMBIGUOUS_UNRESOLVED_EXPOSURE';anomaly:='UNCORROBORATED_OBSERVATION_TIMEOUT';
    ELSE next_state:='REQUEST_ACCEPTED_BY_GATEWAY'; END IF;
  ELSE
    consume_evidence:=true;book_after:=least(observed,pay.amount_cents)::integer;
    IF observed>expected THEN next_state:='OBSERVED_UNATTRIBUTED';anomaly:=CASE WHEN observed>pay.amount_cents THEN 'BOOKS_CAPPED_AT_PAYMENT_AMOUNT' ELSE 'COVERAGE_EXCEEDED' END;
    ELSIF observed<expected THEN next_state:='OBSERVED_UNATTRIBUTED';anomaly:='PARTIAL_COVERAGE_OBSERVED';
    ELSIF pay.refunded_amount_cents<>operation.baseline_refunded_cents THEN next_state:='AMBIGUOUS_UNRESOLVED_EXPOSURE';anomaly:='BOOKS_BASELINE_DRIFT';
    ELSIF signed_count<>1 THEN next_state:='AMBIGUOUS_UNRESOLVED_EXPOSURE';anomaly:='MULTIPLE_REFUND_EVENTS_AFTER_DISPATCH';
    ELSIF evidence.refunded_at IS NULL OR evidence.refunded_at<operation.dispatch_attempted_at-interval '15 seconds' OR evidence.refunded_at>evidence.created_at+interval '5 seconds' THEN next_state:='AMBIGUOUS_UNRESOLVED_EXPOSURE';anomaly:='TIMESTAMP_OUT_OF_WINDOW';
    ELSE next_state:='CLOSED_BY_OBSERVED_COVERAGE'; END IF;
  END IF;
  IF consume_evidence THEN
    INSERT INTO sales.payment_verification_applications(verification_id,payment_id,operation_id) VALUES(evidence.id,pay.id,operation.id);
    INSERT INTO sales.external_refund_observations(payment_id,operation_id,tenant_id,verification_id,prior_book_cents,observed_total_refunded_cents,unattributed_delta_cents,attribution_basis)
      VALUES(pay.id,operation.id,pay.tenant_id,evidence.id,pay.refunded_amount_cents,observed,observed-pay.refunded_amount_cents,'EXTERNAL_OBSERVATION');
    IF book_after>pay.refunded_amount_cents THEN
      UPDATE sales.payments SET refunded_amount_cents=book_after,status=CASE WHEN book_after=amount_cents THEN 'refunded' ELSE 'partially_refunded' END,version=version+1,updated_at=clock_timestamp() WHERE id=pay.id;
      INSERT INTO core.outbox_events(id,tenant_id,aggregate_type,aggregate_id,event_type,payload) VALUES(gen_random_uuid(),pay.tenant_id,'Payment',pay.id,'sales.payment.refund_observed',
        jsonb_build_object('paymentId',pay.id,'orderId',pay.order_id,'tenantId',pay.tenant_id,'refundedAmountCents',book_after,'fullyRefunded',book_after=pay.amount_cents,'operationId',operation.id));
    END IF;
    IF next_state='CLOSED_BY_OBSERVED_COVERAGE' AND book_after=pay.amount_cents THEN UPDATE sales.compensation_obligations SET status='CLOSED' WHERE payment_id=pay.id AND status='OPEN'; END IF;
  END IF;
  UPDATE sales.refund_operations SET status=next_state,worker_token=NULL,lease_until=NULL,last_verification_id=evidence.id,last_evidence_at=evidence.created_at,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,5*(2^least(operation.reconciliation_attempts,9))::integer)),updated_at=clock_timestamp() WHERE id=operation.id;
  IF anomaly IS NOT NULL THEN PERFORM sales.record_payment_anomaly('RECONCILIATION',CASE WHEN anomaly IN('PROVIDER_REFUND_DECREASED','COVERAGE_EXCEEDED','BOOKS_CAPPED_AT_PAYMENT_AMOUNT') THEN 'CRITICAL' ELSE 'HIGH' END,
    anomaly,jsonb_build_object('operationId',operation.id,'observedCents',observed,'bookBeforeCents',pay.refunded_amount_cents),pay.id); END IF;
  RETURN next_state;
END $$;

CREATE OR REPLACE FUNCTION sales.reconcile_external_refund_delta(p_payment_id uuid,p_verification_id uuid,p_event_id uuid,p_worker_token uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales,core AS $$
DECLARE pay sales.payments%ROWTYPE; evidence sales.payment_api_verifications%ROWTYPE; inbox sales.payment_inbox_events%ROWTYPE;
  target_payment uuid; body jsonb; observed bigint; operation uuid:=gen_random_uuid(); book_after integer; correlated boolean; source_key text;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM core.system_flags WHERE name='payments_v41_writers_enabled' AND enabled) THEN RAISE EXCEPTION 'Writers disabled' USING ERRCODE='FZ121'; END IF;
  IF (p_verification_id IS NOT NULL)::integer+(p_event_id IS NOT NULL)::integer<>1 THEN RAISE EXCEPTION 'One evidence source required' USING ERRCODE='FZ081'; END IF;
  SET LOCAL lock_timeout='5s';
  IF p_event_id IS NOT NULL THEN
    SELECT * INTO inbox FROM sales.payment_inbox_events WHERE id=p_event_id AND event_name='order_refunded' AND status='PROCESSING'
      AND worker_token=p_worker_token AND lease_until>clock_timestamp() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stale inbox lease' USING ERRCODE='FZ003'; END IF;
    SELECT id INTO target_payment FROM sales.payments WHERE gateway='lemon_squeezy' AND gateway_transaction_id=inbox.provider_order_id AND environment=inbox.environment;
  ELSE
    SELECT * INTO evidence FROM sales.payment_api_verifications WHERE id=p_verification_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Verification evidence not found' USING ERRCODE='FZ080'; END IF;
    IF evidence.operation_id IS NOT NULL OR evidence.worker_token IS DISTINCT FROM p_worker_token THEN RAISE EXCEPTION 'Evidence operation mismatch' USING ERRCODE='FZ081'; END IF;
    IF evidence.created_at<clock_timestamp()-interval '5 minutes' THEN RAISE EXCEPTION 'Stale verification evidence' USING ERRCODE='FZ082'; END IF;
    IF EXISTS(SELECT 1 FROM sales.payment_verification_applications WHERE verification_id=evidence.id) THEN RAISE EXCEPTION 'Evidence already applied' USING ERRCODE='FZ088'; END IF;
    target_payment:=evidence.payment_id;
  END IF;
  IF target_payment IS NULL OR (p_payment_id IS NOT NULL AND target_payment<>p_payment_id) THEN RAISE EXCEPTION 'Evidence operation mismatch' USING ERRCODE='FZ081'; END IF;
  SELECT * INTO pay FROM sales.payments WHERE id=target_payment FOR UPDATE;
  IF pay.status NOT IN('completed','partially_refunded','refunded','late_payment_pending_compensation') THEN RAISE EXCEPTION 'Payment not refundable' USING ERRCODE='FZ040'; END IF;
  IF EXISTS(SELECT 1 FROM sales.refund_operations WHERE payment_id=pay.id AND status IN('PENDING','DISPATCHING','REQUEST_ACCEPTED_BY_GATEWAY','RECONCILING','AMBIGUOUS_UNRESOLVED_EXPOSURE','OBSERVED_UNATTRIBUTED')) THEN
    IF p_event_id IS NULL THEN RAISE EXCEPTION 'Open refund blocks external reconciliation' USING ERRCODE='FZ087'; END IF;
    UPDATE sales.payment_inbox_events SET status='PENDING',worker_token=NULL,lease_until=NULL,attempt_count=greatest(attempt_count-1,0),next_attempt_at=clock_timestamp()+interval '1 minute' WHERE id=inbox.id;
    RETURN 'DEFERRED_OPEN_OPERATION';
  END IF;
  IF p_event_id IS NOT NULL THEN
    BEGIN
      body:=convert_from(inbox.payload,'UTF8')::jsonb;
      IF body #>> '{data,attributes,store_id}' IS DISTINCT FROM pay.store_id OR body #>> '{data,attributes,currency}' IS DISTINCT FROM pay.currency
        OR body #>> '{data,attributes,total}' IS DISTINCT FROM pay.amount_cents::text OR body #>> '{data,attributes,refunded_amount}' IS NULL
        OR jsonb_typeof(body #> '{data,attributes,refunded_amount}') IS DISTINCT FROM 'number' OR body #>> '{data,attributes,refunded_amount}' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Financial refund correlation mismatch' USING ERRCODE='FZ026'; END IF;
      observed:=(body #>> '{data,attributes,refunded_amount}')::bigint;
      IF observed>9007199254740991 THEN RAISE EXCEPTION 'Invalid observed refund amount' USING ERRCODE='FZ073'; END IF;
    EXCEPTION WHEN data_exception THEN RAISE EXCEPTION 'Malformed refund payload' USING ERRCODE='FZ031'; END;
    source_key:='external:inbox:'||inbox.id::text;
  ELSE
    observed:=evidence.observed_refunded_cents;
    SELECT EXISTS(SELECT 1 FROM sales.payment_inbox_events i WHERE i.event_name='order_refunded' AND i.provider_order_id=pay.gateway_transaction_id AND i.environment=pay.environment
      AND convert_from(i.payload,'UTF8')::jsonb #>> '{data,attributes,refunded_amount}'=observed::text
      AND convert_from(i.payload,'UTF8')::jsonb #>> '{data,attributes,currency}'=pay.currency
      AND convert_from(i.payload,'UTF8')::jsonb #>> '{data,attributes,store_id}'=pay.store_id) INTO correlated;
    IF observed IS NULL OR NOT correlated THEN RETURN 'UNCORROBORATED'; END IF;
    source_key:='external:verification:'||evidence.id::text;
  END IF;
  IF observed<=pay.refunded_amount_cents THEN
    IF p_event_id IS NOT NULL THEN UPDATE sales.payment_inbox_events SET status='COMPLETED',worker_token=NULL,lease_until=NULL WHERE id=inbox.id; END IF;
    RETURN 'NO_DELTA';
  END IF;
  book_after:=least(observed,pay.amount_cents)::integer;
  IF EXISTS(SELECT 1 FROM sales.refund_operations r WHERE r.payment_id=pay.id AND r.intention<>'EXTERNAL_PROVIDER_DASHBOARD' AND r.status IN('CLOSED_BY_OBSERVED_COVERAGE','CLOSED_BY_ADMIN_RESOLUTION','FAILED_BY_ADMIN_ATTESTATION','FAILED_GATEWAY_REJECTED','ADMINISTRATIVE_LOSS_WRITE_OFF')) THEN
    PERFORM sales.record_payment_anomaly('RECONCILIATION','CRITICAL','LATE_REFUND_EVENT_AFTER_CLOSURE',jsonb_build_object('observedCents',observed,'bookBeforeCents',pay.refunded_amount_cents),pay.id);
  END IF;
  INSERT INTO sales.refund_operations(id,payment_id,order_id,tenant_id,provider_order_id,environment,amount_cents,baseline_refunded_cents,
    intention,idempotency_key,request_hash,status,attribution_basis)
    VALUES(operation,pay.id,pay.order_id,pay.tenant_id,pay.gateway_transaction_id,pay.environment,observed-pay.refunded_amount_cents,pay.refunded_amount_cents,
      'EXTERNAL_PROVIDER_DASHBOARD',source_key,encode(extensions.digest(convert_to(source_key,'UTF8'),'sha256'),'hex'),'EXTERNAL_SETTLED_OBSERVED','EXTERNAL_OBSERVATION');
  IF p_verification_id IS NOT NULL THEN INSERT INTO sales.payment_verification_applications(verification_id,payment_id,operation_id) VALUES(evidence.id,pay.id,operation); END IF;
  INSERT INTO sales.external_refund_observations(payment_id,operation_id,tenant_id,verification_id,inbox_event_id,prior_book_cents,observed_total_refunded_cents,unattributed_delta_cents,attribution_basis)
    VALUES(pay.id,operation,pay.tenant_id,p_verification_id,p_event_id,pay.refunded_amount_cents,observed,observed-pay.refunded_amount_cents,'EXTERNAL_OBSERVATION');
  UPDATE sales.payments SET refunded_amount_cents=book_after,status=CASE WHEN book_after=amount_cents THEN 'refunded' ELSE 'partially_refunded' END,version=version+1,updated_at=clock_timestamp() WHERE id=pay.id;
  IF book_after=pay.amount_cents THEN UPDATE sales.compensation_obligations SET status='CLOSED' WHERE payment_id=pay.id AND status='OPEN'; END IF;
  IF observed>pay.amount_cents THEN PERFORM sales.record_payment_anomaly('RECONCILIATION','CRITICAL','BOOKS_CAPPED_AT_PAYMENT_AMOUNT',jsonb_build_object('observedCents',observed),pay.id); END IF;
  IF book_after>pay.refunded_amount_cents THEN INSERT INTO core.outbox_events(id,tenant_id,aggregate_type,aggregate_id,event_type,payload)
    VALUES(gen_random_uuid(),pay.tenant_id,'Payment',pay.id,'sales.payment.refund_observed',jsonb_build_object('paymentId',pay.id,'orderId',pay.order_id,'tenantId',pay.tenant_id,'refundedAmountCents',book_after,'fullyRefunded',book_after=pay.amount_cents,'operationId',operation)); END IF;
  IF p_event_id IS NOT NULL THEN UPDATE sales.payment_inbox_events SET status='COMPLETED',worker_token=NULL,lease_until=NULL WHERE id=inbox.id; END IF;
  RETURN 'EXTERNAL_SETTLED_OBSERVED';
END $$;

CREATE OR REPLACE FUNCTION sales.recover_abandoned_leases()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales AS $$
DECLARE operation record; recovered integer:=0;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  FOR operation IN SELECT r.id,r.payment_id FROM sales.refund_operations r WHERE r.status='DISPATCHING' AND r.lease_until<clock_timestamp() ORDER BY r.id FOR UPDATE SKIP LOCKED LIMIT 100 LOOP
    UPDATE sales.refund_operations SET status='AMBIGUOUS_UNRESOLVED_EXPOSURE',worker_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=operation.id;
    PERFORM sales.record_payment_anomaly('RECONCILIATION','HIGH','REFUND_DISPATCH_AMBIGUOUS',jsonb_build_object('operationId',operation.id),operation.payment_id);
    recovered:=recovered+1;
  END LOOP;
  WITH recovered_operations AS (UPDATE sales.refund_operations SET status='REQUEST_ACCEPTED_BY_GATEWAY',worker_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE id IN(SELECT r.id FROM sales.refund_operations r WHERE r.status='RECONCILING' AND r.lease_until<clock_timestamp() FOR UPDATE SKIP LOCKED LIMIT 100) RETURNING id)
    SELECT recovered+count(*)::integer INTO recovered FROM recovered_operations;
  RETURN recovered;
END $$;

ALTER FUNCTION sales.claim_refunds_for_reconciliation(uuid,text) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.issue_egress_ticket(uuid,uuid,uuid) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.record_api_verification(uuid,uuid,text,integer,bytea,text,jsonb) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.confirm_refund_operation_settlement(uuid,uuid,uuid) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.reconcile_external_refund_delta(uuid,uuid,uuid,uuid) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.recover_abandoned_leases() OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.claim_refunds_for_reconciliation(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.issue_egress_ticket(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.record_api_verification(uuid,uuid,text,integer,bytea,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.confirm_refund_operation_settlement(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.reconcile_external_refund_delta(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.recover_abandoned_leases() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sales.claim_refunds_for_reconciliation(uuid,text) TO payment_reconciliation_role;
GRANT EXECUTE ON FUNCTION sales.issue_egress_ticket(uuid,uuid,uuid) TO payment_reconciliation_role;
GRANT EXECUTE ON FUNCTION sales.record_api_verification(uuid,uuid,text,integer,bytea,text,jsonb) TO payment_egress_role;
GRANT EXECUTE ON FUNCTION sales.confirm_refund_operation_settlement(uuid,uuid,uuid) TO payment_reconciliation_role;
GRANT EXECUTE ON FUNCTION sales.reconcile_external_refund_delta(uuid,uuid,uuid,uuid) TO payment_reconciliation_role;
GRANT EXECUTE ON FUNCTION sales.recover_abandoned_leases() TO payment_reconciliation_role;
REVOKE CREATE ON SCHEMA sales FROM payments_rpc_owner;
REVOKE payments_rpc_owner FROM CURRENT_USER;
COMMIT;
