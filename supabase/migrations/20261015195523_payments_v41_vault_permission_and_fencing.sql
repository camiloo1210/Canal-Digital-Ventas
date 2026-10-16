-- Cloud validation proved that SELECT on vault.decrypted_secrets alone is insufficient.
-- This grant is only for the NOLOGIN, NOBYPASSRLS owner; never for a runtime or API role.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='payments_rpc_owner'
    AND NOT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper AND NOT rolcreaterole) THEN
    RAISE EXCEPTION 'Unsafe or missing payments owner';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) TO payments_rpc_owner;
GRANT payments_rpc_owner TO CURRENT_USER;
CREATE OR REPLACE FUNCTION sales.claim_inbox_events(p_worker_token uuid,p_event_name text)
RETURNS TABLE(event_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,sales,core AS $$
BEGIN
  IF (p_event_name = 'order_created' AND NOT pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER'))
    OR (p_event_name = 'order_refunded' AND NOT pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER'))
    OR p_event_name IS NULL OR p_event_name NOT IN ('order_created','order_refunded') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_worker_token IS NULL THEN RAISE EXCEPTION 'Worker token required' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM core.system_flags f WHERE f.name='payments_v41_writers_enabled' AND f.enabled) THEN
    RETURN;
  END IF;
  UPDATE sales.payment_inbox_events i SET status='DEAD',worker_token=NULL,lease_until=NULL
    WHERE i.event_name=p_event_name AND i.attempt_count>=5 AND
      (i.status='FAILED' OR (i.status='PROCESSING' AND i.lease_until<clock_timestamp()));
  RETURN QUERY UPDATE sales.payment_inbox_events i SET status='PROCESSING',worker_token=p_worker_token,
    lease_until=clock_timestamp()+interval '30 seconds',attempt_count=i.attempt_count+1
    WHERE i.id = (SELECT c.id FROM sales.payment_inbox_events c WHERE c.event_name=p_event_name AND c.attempt_count<5
      AND ((c.status IN ('PENDING','FAILED') AND c.next_attempt_at<=clock_timestamp()) OR (c.status='PROCESSING' AND c.lease_until<clock_timestamp()))
      ORDER BY c.created_at,c.id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING i.id;
END $$;

CREATE OR REPLACE FUNCTION sales.mark_inbox_event_failed(p_event_id uuid,p_worker_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,sales AS $$
BEGIN
  IF NOT (pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER') OR pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE sales.payment_inbox_events i SET status=CASE WHEN i.attempt_count>=5 THEN 'DEAD' ELSE 'FAILED' END,
    worker_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+make_interval(secs => least(3600,5*(2^i.attempt_count)::int))
    WHERE i.id=p_event_id AND i.status='PROCESSING' AND i.worker_token=p_worker_token AND i.lease_until>clock_timestamp();
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION sales.sync_payment_success_transition(p_event_id uuid,p_worker_token uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,sales,core AS $$
DECLARE inbox sales.payment_inbox_events%ROWTYPE; body jsonb; target_payment uuid; target_order uuid;
  pay sales.payments%ROWTYPE; ord record; is_late boolean; result text; obligation uuid;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SET LOCAL lock_timeout='5s';
  IF NOT EXISTS (SELECT 1 FROM core.system_flags f WHERE f.name='payments_v41_writers_enabled' AND f.enabled) THEN
    RAISE EXCEPTION 'Writers disabled' USING ERRCODE='FZ121';
  END IF;
  SELECT * INTO inbox FROM sales.payment_inbox_events i WHERE i.id=p_event_id AND i.status='PROCESSING'
    AND i.worker_token=p_worker_token AND i.lease_until>clock_timestamp() AND i.event_name='order_created' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stale inbox lease' USING ERRCODE='FZ003'; END IF;
  body := convert_from(inbox.payload,'UTF8')::jsonb;
  IF body #>> '{data,attributes,status}' IS DISTINCT FROM 'paid' THEN RAISE EXCEPTION 'Provider order not paid' USING ERRCODE='FZ021'; END IF;
  BEGIN target_payment := (body #>> '{meta,custom_data,payment_id}')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Missing payment correlation' USING ERRCODE='FZ022'; END;
  SELECT p.order_id INTO target_order FROM sales.payments p WHERE p.id=target_payment;
  IF target_order IS NULL THEN RAISE EXCEPTION 'Missing payment' USING ERRCODE='FZ023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('canaldigital:order:'||target_order::text,0));
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Unsupported isolation' USING ERRCODE='25001'; END IF;
  SELECT * INTO pay FROM sales.payments p WHERE p.id=target_payment FOR UPDATE;
  IF pay.order_id<>target_order THEN RAISE EXCEPTION 'Payment identity changed' USING ERRCODE='FZ022'; END IF;
  IF pay.status IN ('completed','partially_refunded','refunded','late_payment_pending_compensation') THEN
    IF pay.gateway_transaction_id IS DISTINCT FROM inbox.provider_order_id THEN RAISE EXCEPTION 'Different provider transaction' USING ERRCODE='FZ024'; END IF;
    UPDATE sales.payment_inbox_events i SET status='COMPLETED',worker_token=NULL,lease_until=NULL WHERE i.id=p_event_id;
    RETURN 'ALREADY_PROCESSED';
  END IF;
  IF pay.status NOT IN ('pending','expired_unpaid_awaiting_reconciliation') THEN RAISE EXCEPTION 'Invalid payment state' USING ERRCODE='FZ025'; END IF;
  SELECT o.id,o.tenant_id,o.status,o.total_amount_cents INTO ord FROM sales.orders o WHERE o.id=pay.order_id;
  IF NOT FOUND OR ord.tenant_id<>pay.tenant_id OR pay.gateway<>'lemon_squeezy'
    OR pay.tenant_id::text IS DISTINCT FROM body #>> '{meta,custom_data,tenant_id}'
    OR pay.order_id::text IS DISTINCT FROM body #>> '{meta,custom_data,order_id}'
    OR pay.environment IS DISTINCT FROM inbox.environment
    OR pay.store_id IS DISTINCT FROM body #>> '{data,attributes,store_id}'
    OR pay.currency IS DISTINCT FROM body #>> '{data,attributes,currency}'
    OR pay.environment='legacy_unclassified'
    OR (pay.environment='test') IS DISTINCT FROM (body #>> '{data,attributes,test_mode}')::boolean
    OR pay.amount_cents::text IS DISTINCT FROM body #>> '{data,attributes,total}'
    OR ord.total_amount_cents<>pay.amount_cents THEN
    RAISE EXCEPTION 'Financial correlation mismatch' USING ERRCODE='FZ026';
  END IF;
  is_late := pay.status<>'pending' OR ord.status<>'confirmed';
  IF is_late THEN
    INSERT INTO sales.compensation_obligations(payment_id,order_id,tenant_id,amount_cents)
      VALUES(pay.id,pay.order_id,pay.tenant_id,pay.amount_cents) ON CONFLICT(payment_id) DO NOTHING;
    SELECT c.id INTO obligation FROM sales.compensation_obligations c WHERE c.payment_id=pay.id;
  END IF;
  UPDATE sales.payments p SET status=CASE WHEN is_late THEN 'late_payment_pending_compensation' ELSE 'completed' END,
    gateway_transaction_id=inbox.provider_order_id,version=p.version+1,updated_at=clock_timestamp() WHERE p.id=pay.id;
  INSERT INTO core.outbox_events(id,tenant_id,aggregate_type,aggregate_id,event_type,payload)
    VALUES(gen_random_uuid(),pay.tenant_id,'Payment',pay.id,CASE WHEN is_late THEN 'sales.payment.late_payment' ELSE 'sales.payment.completed' END,
      jsonb_build_object('paymentId',pay.id,'orderId',pay.order_id,'tenantId',pay.tenant_id,'providerOrderId',inbox.provider_order_id,'obligationId',obligation));
  UPDATE sales.payment_inbox_events i SET status='COMPLETED',worker_token=NULL,lease_until=NULL WHERE i.id=p_event_id;
  RETURN CASE WHEN is_late THEN 'LATE_PAYMENT' ELSE 'COMPLETED' END;
END $$;

CREATE OR REPLACE FUNCTION sales.execute_checkout_timeout_transition(p_payment_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,sales,core AS $$
DECLARE pay sales.payments%ROWTYPE; target_order uuid; target_payment uuid;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SET LOCAL lock_timeout='5s';
  IF NOT EXISTS (SELECT 1 FROM core.system_flags f WHERE f.name='payments_v41_writers_enabled' AND f.enabled) THEN RETURN false; END IF;
  SELECT p.id,p.order_id INTO target_payment,target_order FROM sales.payments p
    WHERE (p_payment_id IS NULL OR p.id=p_payment_id) AND p.status='pending'
      AND p.environment<>'legacy_unclassified' AND p.checkout_expires_at+interval '5 minutes'<clock_timestamp()
    ORDER BY p.checkout_expires_at,p.id LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('canaldigital:order:'||target_order::text,0));
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Unsupported isolation' USING ERRCODE='25001'; END IF;
  SELECT * INTO pay FROM sales.payments p WHERE p.id=target_payment FOR UPDATE;
  IF pay.order_id<>target_order OR pay.status<>'pending' OR pay.checkout_expires_at+interval '5 minutes'>=clock_timestamp() THEN RETURN false; END IF;
  UPDATE sales.payments p SET status='expired_unpaid_awaiting_reconciliation',version=p.version+1,updated_at=clock_timestamp() WHERE p.id=pay.id;
  INSERT INTO core.outbox_events(id,tenant_id,aggregate_type,aggregate_id,event_type,payload)
    VALUES(gen_random_uuid(),pay.tenant_id,'Payment',pay.id,'sales.payment.checkout_expired',
      jsonb_build_object('paymentId',pay.id,'orderId',pay.order_id,'tenantId',pay.tenant_id));
  RETURN true;
END $$;

ALTER FUNCTION sales.claim_inbox_events(uuid,text) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.mark_inbox_event_failed(uuid,uuid) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.sync_payment_success_transition(uuid,uuid) OWNER TO payments_rpc_owner;
ALTER FUNCTION sales.execute_checkout_timeout_transition(uuid) OWNER TO payments_rpc_owner;
REVOKE ALL ON FUNCTION sales.claim_inbox_events(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.mark_inbox_event_failed(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.sync_payment_success_transition(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sales.execute_checkout_timeout_transition(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA sales TO payment_worker_role,payment_reconciliation_role;
GRANT EXECUTE ON FUNCTION sales.claim_inbox_events(uuid,text) TO payment_worker_role,payment_reconciliation_role;
GRANT EXECUTE ON FUNCTION sales.mark_inbox_event_failed(uuid,uuid) TO payment_worker_role,payment_reconciliation_role;
GRANT EXECUTE ON FUNCTION sales.sync_payment_success_transition(uuid,uuid) TO payment_worker_role;
GRANT EXECUTE ON FUNCTION sales.execute_checkout_timeout_transition(uuid) TO payment_reconciliation_role;
REVOKE payments_rpc_owner FROM CURRENT_USER;
COMMIT;
