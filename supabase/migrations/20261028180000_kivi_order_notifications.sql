BEGIN;
GRANT notification_rpc_owner TO current_user;
-- Narrow worker projection: identity is fenced against the committed outbox event.
GRANT CREATE ON SCHEMA core TO notification_rpc_owner;
GRANT SELECT (payload) ON core.outbox_events TO notification_rpc_owner;
GRANT SELECT (phone) ON sales.customers TO notification_rpc_owner;
CREATE TABLE core.kivi_notification_payloads (
  message_id uuid PRIMARY KEY REFERENCES core.outbox_events(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  payload_ciphertext text NOT NULL,
  payload_key_version smallint NOT NULL CHECK (payload_key_version >= 1)
);
ALTER TABLE core.kivi_notification_payloads OWNER TO notification_rpc_owner;
ALTER TABLE core.kivi_notification_payloads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.kivi_notification_payloads FROM PUBLIC,anon,authenticated,service_role,notification_worker_role;
CREATE FUNCTION core.read_kivi_order_notification(p_message_id uuid, p_tenant_id uuid, p_order_id uuid, p_event_type text)
RETURNS TABLE(base_url text, connection_id uuid, token_ciphertext text, token_key_version smallint, phone text, order_number text, payload_ciphertext text, payload_key_version smallint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'worker role required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM core.outbox_events e WHERE e.id=p_message_id AND e.tenant_id=p_tenant_id
    AND e.aggregate_id=p_order_id AND e.aggregate_type='Order' AND e.event_type=p_event_type
    AND e.payload->>'orderId'=p_order_id::text AND e.event_type IN
    ('OrderConfirmedEvent','OrderPaidEvent','OrderProcessingEvent','OrderShippedEvent','OrderDeliveredEvent','OrderCancelledEvent')) THEN
    RAISE EXCEPTION 'invalid event' USING ERRCODE='22023';
  END IF;
  RETURN QUERY SELECT k.base_url::text, k.connection_id, k.token_ciphertext, k.token_key_version, c.phone::text, o.order_number::text, p.payload_ciphertext, p.payload_key_version
    FROM core.kivi_connections k JOIN sales.orders o ON o.tenant_id=k.tenant_id AND o.id=p_order_id
    JOIN sales.customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id
    LEFT JOIN core.kivi_notification_payloads p ON p.message_id=p_message_id AND p.tenant_id=p_tenant_id
    WHERE k.tenant_id=p_tenant_id AND k.status <> 'unlinked' AND k.token_ciphertext IS NOT NULL;
END;
$$;
ALTER FUNCTION core.read_kivi_order_notification(uuid,uuid,uuid,text) OWNER TO notification_rpc_owner;
GRANT SELECT ON core.kivi_connections TO notification_rpc_owner;
-- Existing FORCE RLS grants remain in force; the dedicated projection needs an explicit policy.
CREATE POLICY kivi_notification_rpc_read ON core.kivi_connections FOR SELECT TO notification_rpc_owner USING (true);
REVOKE ALL ON FUNCTION core.read_kivi_order_notification(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION core.read_kivi_order_notification(uuid,uuid,uuid,text) TO notification_worker_role;
-- First writer captures encrypted recipient data. This is a narrow idempotency fence,
-- not order business logic; encryption and formatting remain in the Node adapter.
CREATE FUNCTION core.prepare_kivi_order_notification(p_message_id uuid, p_tenant_id uuid, p_order_id uuid, p_event_type text, p_ciphertext text, p_key_version smallint)
RETURNS TABLE(payload_ciphertext text, payload_key_version smallint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,pg_temp AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'worker role required' USING ERRCODE='42501';
  END IF;
  IF p_ciphertext IS NULL OR p_ciphertext !~ '^v[0-9]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' OR p_key_version IS NULL OR p_key_version < 1 THEN
    RAISE EXCEPTION 'invalid encrypted payload' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM core.read_kivi_order_notification(p_message_id,p_tenant_id,p_order_id,p_event_type)) THEN RETURN; END IF;
  INSERT INTO core.kivi_notification_payloads(message_id,tenant_id,payload_ciphertext,payload_key_version)
    VALUES(p_message_id,p_tenant_id,p_ciphertext,p_key_version) ON CONFLICT (message_id) DO NOTHING;
  RETURN QUERY SELECT p.payload_ciphertext,p.payload_key_version FROM core.kivi_notification_payloads p
    WHERE p.message_id=p_message_id AND p.tenant_id=p_tenant_id;
END;
$$;
ALTER FUNCTION core.prepare_kivi_order_notification(uuid,uuid,uuid,text,text,smallint) OWNER TO notification_rpc_owner;
REVOKE ALL ON FUNCTION core.prepare_kivi_order_notification(uuid,uuid,uuid,text,text,smallint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION core.prepare_kivi_order_notification(uuid,uuid,uuid,text,text,smallint) TO notification_worker_role;
REVOKE CREATE ON SCHEMA core FROM notification_rpc_owner;
REVOKE notification_rpc_owner FROM current_user;
COMMIT;
