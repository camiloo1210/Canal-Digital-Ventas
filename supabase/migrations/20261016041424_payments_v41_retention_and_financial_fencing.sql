BEGIN;
GRANT payments_rpc_owner TO CURRENT_USER;
GRANT USAGE,CREATE ON SCHEMA sales TO payments_rpc_owner;

-- Retain accounting correlation and evidence hashes; discard contact and payment instrument data.
CREATE OR REPLACE FUNCTION sales.redact_payment_payload(p_payload bytea) RETURNS bytea
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE body jsonb; attrs jsonb; kept jsonb:='{}'::jsonb; field text; val jsonb; result jsonb;
BEGIN
  body:=convert_from(p_payload,'UTF8')::jsonb; attrs:=body #> '{data,attributes}';
  FOREACH field IN ARRAY ARRAY['store_id','total','refunded_amount'] LOOP
    val:=attrs->field;
    IF jsonb_typeof(val)='number' AND val::text ~ '^[0-9]{1,16}$' THEN kept:=kept||jsonb_build_object(field,val); END IF;
  END LOOP;
  IF attrs->>'currency' ~ '^[A-Z]{3}$' THEN kept:=kept||jsonb_build_object('currency',attrs->'currency'); END IF;
  IF jsonb_typeof(attrs->'test_mode')='boolean' THEN kept:=kept||jsonb_build_object('test_mode',attrs->'test_mode'); END IF;
  FOREACH field IN ARRAY ARRAY['created_at','updated_at','refunded_at'] LOOP
    IF attrs->>field ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' THEN kept:=kept||jsonb_build_object(field,attrs->field); END IF;
  END LOOP;
  IF attrs->>'status' IN('paid','refunded','partial_refund','pending','failed','fraudulent') THEN kept:=kept||jsonb_build_object('status',attrs->'status'); END IF;
  result:=jsonb_build_object('data',jsonb_build_object('type','orders','attributes',kept));
  IF body #>> '{data,id}' ~ '^[1-9][0-9]{0,19}$' THEN result:=jsonb_set(result,'{data,id}',body #> '{data,id}'); END IF;
  FOREACH field IN ARRAY ARRAY['payment_id','order_id','tenant_id'] LOOP
    IF body #>> ARRAY['meta','custom_data',field] ~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$' THEN
      result:=result||jsonb_build_object('meta',coalesce(result->'meta','{}'::jsonb)||jsonb_build_object('custom_data',coalesce(result #> '{meta,custom_data}','{}'::jsonb)||jsonb_build_object(field,body #> ARRAY['meta','custom_data',field])));
    END IF;
  END LOOP;
  RETURN convert_to(result::text,'UTF8');
END $$;
ALTER FUNCTION sales.redact_payment_payload(bytea) OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.redact_payment_payload(bytea) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sales.redact_payment_payload(bytea) TO payments_rpc_owner;

ALTER TABLE sales.payment_inbox_events ADD COLUMN IF NOT EXISTS purged_at timestamptz;
GRANT UPDATE(payload,purged_at) ON sales.payment_inbox_events TO payments_rpc_owner;
GRANT UPDATE(payload,response_headers,purged_at) ON sales.payment_api_verifications TO payments_rpc_owner;
DROP POLICY IF EXISTS payment_verifications_retention ON sales.payment_api_verifications;
CREATE POLICY payment_verifications_retention ON sales.payment_api_verifications FOR UPDATE TO payments_rpc_owner USING(true) WITH CHECK(true);

CREATE OR REPLACE FUNCTION sales.guard_payment_evidence_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,sales AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Append-only record' USING ERRCODE='FZ900'; END IF;
  IF current_user='payments_rpc_owner' AND pg_catalog.pg_has_role(session_user,'payment_retention_role','MEMBER')
    AND current_setting('app.payment_pii_purge',true)='active' AND OLD.purged_at IS NULL
    AND OLD.created_at<=clock_timestamp()-interval '30 days' AND NEW.purged_at IS NOT NULL
    AND NEW.payload=sales.redact_payment_payload(OLD.payload) THEN
    IF TG_TABLE_NAME='payment_api_verifications' THEN
      IF (to_jsonb(NEW)-ARRAY['payload','response_headers','purged_at'])=(to_jsonb(OLD)-ARRAY['payload','response_headers','purged_at']) AND NEW.response_headers='{}'::jsonb THEN RETURN NEW; END IF;
    ELSE
      IF OLD.status IN('COMPLETED','DEAD') AND (to_jsonb(NEW)-ARRAY['payload','purged_at'])=(to_jsonb(OLD)-ARRAY['payload','purged_at']) THEN RETURN NEW; END IF;
    END IF;
  END IF;
  -- Inbox processing metadata can change; the signed body and its identity cannot.
  IF TG_TABLE_NAME='payment_inbox_events' AND ROW(NEW.id,NEW.environment,NEW.event_name,NEW.provider_order_id,NEW.payload,NEW.body_hash,NEW.signature,NEW.created_at,NEW.purged_at)
    IS NOT DISTINCT FROM ROW(OLD.id,OLD.environment,OLD.event_name,OLD.provider_order_id,OLD.payload,OLD.body_hash,OLD.signature,OLD.created_at,OLD.purged_at) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Append-only record' USING ERRCODE='FZ900';
END $$;
ALTER FUNCTION sales.guard_payment_evidence_mutation() OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.guard_payment_evidence_mutation() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sales.guard_payment_evidence_mutation() TO payments_rpc_owner;
DROP TRIGGER IF EXISTS payment_verifications_immutable ON sales.payment_api_verifications;
CREATE TRIGGER payment_verifications_immutable BEFORE UPDATE OR DELETE ON sales.payment_api_verifications FOR EACH ROW EXECUTE FUNCTION sales.guard_payment_evidence_mutation();
DROP TRIGGER IF EXISTS payment_inbox_evidence_immutable ON sales.payment_inbox_events;
CREATE TRIGGER payment_inbox_evidence_immutable BEFORE UPDATE OR DELETE ON sales.payment_inbox_events FOR EACH ROW EXECUTE FUNCTION sales.guard_payment_evidence_mutation();

CREATE OR REPLACE FUNCTION sales.purge_payment_pii(p_retention_days integer DEFAULT 30,p_batch_size integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales AS $$
DECLARE affected integer; total integer;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_retention_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_retention_days IS NULL OR p_retention_days<30 OR p_retention_days>3650 OR p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid retention parameters' USING ERRCODE='FZ090'; END IF;
  PERFORM set_config('app.payment_pii_purge','active',true);
  WITH candidates AS (SELECT id FROM sales.payment_inbox_events WHERE purged_at IS NULL AND status IN('COMPLETED','DEAD') AND created_at<=clock_timestamp()-make_interval(days=>p_retention_days) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT p_batch_size)
    UPDATE sales.payment_inbox_events i SET payload=sales.redact_payment_payload(i.payload),purged_at=clock_timestamp() FROM candidates c WHERE i.id=c.id;
  GET DIAGNOSTICS total=ROW_COUNT;
  WITH candidates AS (SELECT id FROM sales.payment_api_verifications WHERE purged_at IS NULL AND created_at<=clock_timestamp()-make_interval(days=>p_retention_days) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT p_batch_size)
    UPDATE sales.payment_api_verifications v SET payload=sales.redact_payment_payload(v.payload),response_headers='{}'::jsonb,purged_at=clock_timestamp() FROM candidates c WHERE v.id=c.id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  PERFORM set_config('app.payment_pii_purge','',true);
  RETURN total+affected;
END $$;
ALTER FUNCTION sales.purge_payment_pii(integer,integer) OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.purge_payment_pii(integer,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sales.purge_payment_pii(integer,integer) TO payment_retention_role;

-- Close the old API write surface before enabling the new financial writers.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON sales.payments FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE field record; BEGIN
  FOR field IN SELECT attname FROM pg_attribute WHERE attrelid='sales.payments'::regclass AND attnum>0 AND NOT attisdropped LOOP
    EXECUTE format('REVOKE INSERT(%I),UPDATE(%I),REFERENCES(%I) ON sales.payments FROM PUBLIC,anon,authenticated,service_role',field.attname,field.attname,field.attname);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.payments;
DROP POLICY IF EXISTS payments_tenant_read ON sales.payments;
CREATE POLICY payments_tenant_read ON sales.payments FOR SELECT TO authenticated USING((SELECT core.user_has_access_to_tenant(tenant_id)));

CREATE OR REPLACE FUNCTION sales.guard_payment_financial_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF OLD.gateway_transaction_id IS NOT NULL AND NEW.gateway_transaction_id IS DISTINCT FROM OLD.gateway_transaction_id THEN RAISE EXCEPTION 'Payment identity is immutable' USING ERRCODE='FZ124'; END IF;
  IF OLD.environment='legacy_unclassified' THEN RETURN NEW; END IF;
  IF ROW(NEW.status,NEW.refunded_amount_cents,NEW.gateway_transaction_id) IS NOT DISTINCT FROM ROW(OLD.status,OLD.refunded_amount_cents,OLD.gateway_transaction_id) THEN RETURN NEW; END IF;
  IF current_user<>'payments_rpc_owner' THEN RAISE EXCEPTION 'Financial writes require payment RPC' USING ERRCODE='42501'; END IF;
  IF NEW.status<>OLD.status AND NOT (
    (OLD.status='pending' AND NEW.status IN('completed','failed','expired_unpaid_awaiting_reconciliation','late_payment_pending_compensation')) OR
    (OLD.status='expired_unpaid_awaiting_reconciliation' AND NEW.status='late_payment_pending_compensation') OR
    (OLD.status IN('completed','late_payment_pending_compensation') AND NEW.status IN('partially_refunded','refunded')) OR
    (OLD.status='partially_refunded' AND NEW.status='refunded')) THEN RAISE EXCEPTION 'Illegal payment transition' USING ERRCODE='FZ050'; END IF;
  IF (NEW.status='refunded' AND NEW.refunded_amount_cents<>NEW.amount_cents) OR
    (NEW.status='partially_refunded' AND NEW.refunded_amount_cents NOT BETWEEN 1 AND NEW.amount_cents-1) OR
    (NEW.status NOT IN('refunded','partially_refunded') AND NEW.refunded_amount_cents<>0) THEN RAISE EXCEPTION 'Payment refund book mismatch' USING ERRCODE='FZ125'; END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION sales.guard_payment_financial_transition() OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.guard_payment_financial_transition() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sales.guard_payment_financial_transition() TO payments_rpc_owner;
DROP TRIGGER IF EXISTS payment_financial_transition ON sales.payments;
CREATE TRIGGER payment_financial_transition BEFORE UPDATE ON sales.payments FOR EACH ROW EXECUTE FUNCTION sales.guard_payment_financial_transition();
-- Operational projections intentionally use the NOLOGIN owner and fixed columns. Invoker views
-- would require granting the worker the underlying financial tables; no API role can read these.
GRANT SELECT(updated_at) ON sales.orders TO payments_rpc_owner;
CREATE OR REPLACE VIEW sales.payment_order_repair_candidates WITH(security_barrier=true) AS
  SELECT p.id AS payment_id,p.order_id,p.tenant_id,
    CASE WHEN p.status IN('expired_unpaid_awaiting_reconciliation','late_payment_pending_compensation') THEN 'EXPIRE'
      WHEN p.status='refunded' THEN 'REFUND' ELSE 'PAID' END AS operation
  FROM sales.payments p JOIN sales.orders o ON o.id=p.order_id AND o.tenant_id=p.tenant_id
  WHERE p.environment<>'legacy_unclassified' AND p.gateway='lemon_squeezy'
    AND EXISTS(SELECT 1 FROM core.system_flags WHERE name='payments_v41_writers_enabled' AND enabled)
    AND NOT EXISTS(SELECT 1 FROM sales.order_automation_exclusions x WHERE x.order_id=p.order_id)
    AND p.updated_at<clock_timestamp()-interval '15 minutes'
    AND ((o.status='confirmed' AND p.status IN('completed','partially_refunded','expired_unpaid_awaiting_reconciliation','late_payment_pending_compensation'))
      OR (o.status IN('confirmed','paid','processing','shipped','delivered') AND p.status='refunded'));
ALTER VIEW sales.payment_order_repair_candidates OWNER TO payments_rpc_owner;
REVOKE ALL ON sales.payment_order_repair_candidates FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON sales.payment_order_repair_candidates TO payment_order_domain_role;
CREATE OR REPLACE VIEW sales.payment_compensation_candidates WITH(security_barrier=true) AS
  SELECT c.id AS obligation_id,p.id AS payment_id,p.tenant_id,p.amount_cents-p.refunded_amount_cents AS remaining_cents
  FROM sales.compensation_obligations c JOIN sales.payments p ON p.id=c.payment_id AND p.tenant_id=c.tenant_id
  WHERE c.status='OPEN' AND p.environment<>'legacy_unclassified' AND p.gateway='lemon_squeezy'
    AND p.status IN('late_payment_pending_compensation','partially_refunded') AND p.amount_cents>p.refunded_amount_cents
    AND NOT EXISTS(SELECT 1 FROM sales.refund_operations r WHERE r.compensation_obligation_id=c.id)
    AND NOT EXISTS(SELECT 1 FROM sales.refund_operations r WHERE r.payment_id=p.id AND r.status IN('PENDING','DISPATCHING','REQUEST_ACCEPTED_BY_GATEWAY','RECONCILING','AMBIGUOUS_UNRESOLVED_EXPOSURE','OBSERVED_UNATTRIBUTED','ADMINISTRATIVE_LOSS_WRITE_OFF'))
    AND EXISTS(SELECT 1 FROM core.system_flags WHERE name='payments_v41_writers_enabled' AND enabled);
ALTER VIEW sales.payment_compensation_candidates OWNER TO payments_rpc_owner;
REVOKE ALL ON sales.payment_compensation_candidates FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON sales.payment_compensation_candidates TO payment_worker_role;
-- Recover financial leases without retrying a refund POST. Administrative/MFA proposals are outside this MVP.
CREATE OR REPLACE FUNCTION sales.claim_inbox_events(p_worker_token uuid,p_event_name text)
RETURNS TABLE(event_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales,core AS $$
DECLARE exhausted record;
BEGIN
  IF (p_event_name='order_created' AND NOT pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER'))
    OR (p_event_name='order_refunded' AND NOT pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER'))
    OR p_event_name IS NULL OR p_event_name NOT IN('order_created','order_refunded') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_worker_token IS NULL THEN RAISE EXCEPTION 'Invalid worker token' USING ERRCODE='FZ002'; END IF;
  IF NOT EXISTS(SELECT 1 FROM core.system_flags WHERE name='payments_v41_writers_enabled' AND enabled) THEN RETURN; END IF;
  FOR exhausted IN SELECT i.id FROM sales.payment_inbox_events i WHERE i.event_name=p_event_name AND i.attempt_count>=5 AND
    (i.status='FAILED' OR (i.status='PROCESSING' AND i.lease_until<clock_timestamp())) ORDER BY i.id FOR UPDATE SKIP LOCKED LIMIT 100 LOOP
    UPDATE sales.payment_inbox_events SET status='DEAD',worker_token=NULL,lease_until=NULL WHERE id=exhausted.id;
    PERFORM sales.record_payment_anomaly('WORKER','CRITICAL','PAYMENT_INBOX_EXHAUSTED',jsonb_build_object('eventId',exhausted.id),NULL);
  END LOOP;
  RETURN QUERY UPDATE sales.payment_inbox_events i SET status='PROCESSING',worker_token=p_worker_token,
    lease_until=clock_timestamp()+interval '30 seconds',attempt_count=i.attempt_count+1
    WHERE i.id=(SELECT c.id FROM sales.payment_inbox_events c WHERE c.event_name=p_event_name AND c.attempt_count<5
      AND ((c.status IN('PENDING','FAILED') AND c.next_attempt_at<=clock_timestamp()) OR (c.status='PROCESSING' AND c.lease_until<clock_timestamp()))
      ORDER BY c.created_at,c.id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING i.id;
END $$;
ALTER FUNCTION sales.claim_inbox_events(uuid,text) OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.claim_inbox_events(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sales.claim_inbox_events(uuid,text) TO payment_worker_role,payment_reconciliation_role;
CREATE OR REPLACE FUNCTION sales.mark_inbox_event_failed(p_event_id uuid,p_worker_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sales AS $$
DECLARE outcome text;
BEGIN
  IF NOT (pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER') OR pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  UPDATE sales.payment_inbox_events i SET status=CASE WHEN i.attempt_count>=5 THEN 'DEAD' ELSE 'FAILED' END,
    worker_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,5*(2^i.attempt_count)::int))
    WHERE i.id=p_event_id AND i.status='PROCESSING' AND i.worker_token=p_worker_token AND i.lease_until>clock_timestamp() RETURNING i.status INTO outcome;
  IF NOT FOUND THEN RETURN false; END IF;
  IF outcome='DEAD' THEN PERFORM sales.record_payment_anomaly('WORKER','CRITICAL','PAYMENT_INBOX_EXHAUSTED',jsonb_build_object('eventId',p_event_id),NULL); END IF;
  RETURN true;
END $$;
ALTER FUNCTION sales.mark_inbox_event_failed(uuid,uuid) OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.mark_inbox_event_failed(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sales.mark_inbox_event_failed(uuid,uuid) TO payment_worker_role,payment_reconciliation_role;
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
ALTER FUNCTION sales.recover_abandoned_leases() OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.recover_abandoned_leases() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sales.recover_abandoned_leases() TO payment_reconciliation_role;
REVOKE CREATE ON SCHEMA sales FROM payments_rpc_owner;
INSERT INTO core.outbox_relay_routes(worker_role,aggregate_type,event_type) VALUES
  ('outbox_worker_role','Payment','sales.payment.refund_observed'),
  ('outbox_worker_role','Payment','sales.payment.late_payment') ON CONFLICT DO NOTHING;
REVOKE payments_rpc_owner FROM CURRENT_USER;
COMMIT;
