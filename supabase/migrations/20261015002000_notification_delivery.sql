DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'notification_worker_role') THEN
    CREATE ROLE notification_worker_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'notification_rpc_owner') THEN
    CREATE ROLE notification_rpc_owner NOLOGIN;
  END IF;
  GRANT notification_rpc_owner TO current_user;
END;
$$;
GRANT USAGE, CREATE ON SCHEMA core TO notification_rpc_owner;
GRANT USAGE ON SCHEMA sales TO notification_rpc_owner;
GRANT USAGE ON SCHEMA core TO notification_worker_role;
GRANT SELECT (id, tenant_id, aggregate_type, aggregate_id, event_type) ON core.outbox_events TO notification_rpc_owner;
CREATE POLICY notification_outbox_read ON core.outbox_events FOR SELECT TO notification_rpc_owner USING (true);
GRANT SELECT (id, tenant_id, customer_id, order_number) ON sales.orders TO notification_rpc_owner;
-- Personal data: this role reads customer emails only to address notifications, through core.read_order_notification.
GRANT SELECT (id, tenant_id, email) ON sales.customers TO notification_rpc_owner;
GRANT SELECT (id, name) ON core.tenants TO notification_rpc_owner;
GRANT SELECT ON core.outbox_relay_exclusions TO notification_rpc_owner;
CREATE POLICY notification_exclusions_read ON core.outbox_relay_exclusions FOR SELECT TO notification_rpc_owner USING (true);
CREATE POLICY notification_order_read ON sales.orders FOR SELECT TO notification_rpc_owner USING (true);
CREATE POLICY notification_customer_read ON sales.customers FOR SELECT TO notification_rpc_owner USING (true);
CREATE POLICY notification_tenant_read ON core.tenants FOR SELECT TO notification_rpc_owner USING (true);

CREATE TABLE core.notification_deliveries (
  message_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('PROCESSING', 'SENT', 'RETRY', 'DEAD')),
  attempts int NOT NULL DEFAULT 1,
  owner_token uuid,
  lease_until timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'PROCESSING' AND owner_token IS NOT NULL AND lease_until IS NOT NULL)
      OR (status <> 'PROCESSING' AND owner_token IS NULL AND lease_until IS NULL))
);
ALTER TABLE core.notification_deliveries OWNER TO notification_rpc_owner;
ALTER TABLE core.notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.notification_deliveries FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION core.claim_notification_delivery(
  p_message_id uuid, p_tenant_id uuid, p_order_id uuid, p_event_type text, p_owner uuid
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp AS $$
DECLARE v_status text;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized notification worker' USING ERRCODE = '42501';
  END IF;
  IF p_owner IS NULL OR NOT EXISTS (
    SELECT 1 FROM core.outbox_events o
    WHERE o.id = p_message_id AND o.tenant_id = p_tenant_id AND o.aggregate_id = p_order_id
      AND o.aggregate_type = 'Order' AND o.event_type = p_event_type
      AND NOT EXISTS (SELECT 1 FROM core.outbox_relay_exclusions x WHERE x.event_id = o.id)
  ) THEN RETURN 'INVALID'; END IF;

  UPDATE core.notification_deliveries SET status = 'DEAD', owner_token = NULL, lease_until = NULL
  WHERE message_id = p_message_id AND attempts >= 5
    AND (status = 'RETRY' OR (status = 'PROCESSING' AND lease_until <= NOW()));

  INSERT INTO core.notification_deliveries (message_id, tenant_id, order_id, event_type, status, owner_token, lease_until)
  VALUES (p_message_id, p_tenant_id, p_order_id, p_event_type, 'PROCESSING', p_owner, NOW() + INTERVAL '5 minutes')
  ON CONFLICT (message_id) DO UPDATE
    SET status = 'PROCESSING', owner_token = p_owner, lease_until = NOW() + INTERVAL '5 minutes',
        attempts = notification_deliveries.attempts + 1, updated_at = NOW()
    WHERE notification_deliveries.tenant_id = p_tenant_id AND notification_deliveries.order_id = p_order_id
      AND notification_deliveries.event_type = p_event_type AND notification_deliveries.attempts < 5
      AND (notification_deliveries.status = 'RETRY'
           OR (notification_deliveries.status = 'PROCESSING' AND notification_deliveries.lease_until <= NOW()))
  RETURNING status INTO v_status;
  IF FOUND THEN RETURN 'CLAIMED'; END IF;

  SELECT status INTO v_status FROM core.notification_deliveries
  WHERE message_id = p_message_id AND tenant_id = p_tenant_id AND order_id = p_order_id AND event_type = p_event_type;
  IF NOT FOUND THEN RETURN 'INVALID'; END IF;
  IF v_status IN ('SENT', 'DEAD') THEN RETURN v_status; END IF;
  RETURN 'BUSY';
END;
$$;

CREATE FUNCTION core.finish_notification_delivery(p_message_id uuid, p_owner uuid, p_state text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized notification worker' USING ERRCODE = '42501';
  END IF;
  IF p_state NOT IN ('SENT', 'RETRY', 'DEAD') THEN
    RAISE EXCEPTION 'Invalid notification transition' USING ERRCODE = '22023';
  END IF;
  UPDATE core.notification_deliveries
  SET status = p_state, owner_token = NULL, lease_until = NULL, updated_at = NOW(),
      delivered_at = CASE WHEN p_state = 'SENT' THEN NOW() ELSE NULL END
  WHERE message_id = p_message_id AND owner_token = p_owner AND status = 'PROCESSING' AND lease_until > NOW();
  RETURN FOUND;
END;
$$;

CREATE FUNCTION core.read_order_notification(p_tenant_id uuid, p_order_id uuid)
RETURNS TABLE (email varchar, order_number varchar, tenant_name varchar)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized notification worker' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT c.email, o.order_number, t.name
  FROM sales.orders o
  JOIN sales.customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
  JOIN core.tenants t ON t.id = o.tenant_id
  WHERE o.id = p_order_id AND o.tenant_id = p_tenant_id;
END;
$$;

ALTER FUNCTION core.claim_notification_delivery(uuid, uuid, uuid, text, uuid) OWNER TO notification_rpc_owner;
ALTER FUNCTION core.finish_notification_delivery(uuid, uuid, text) OWNER TO notification_rpc_owner;
ALTER FUNCTION core.read_order_notification(uuid, uuid) OWNER TO notification_rpc_owner;
REVOKE ALL ON FUNCTION core.claim_notification_delivery(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION core.finish_notification_delivery(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION core.read_order_notification(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.claim_notification_delivery(uuid, uuid, uuid, text, uuid) TO notification_worker_role;
GRANT EXECUTE ON FUNCTION core.finish_notification_delivery(uuid, uuid, text) TO notification_worker_role;
GRANT EXECUTE ON FUNCTION core.read_order_notification(uuid, uuid) TO notification_worker_role;
REVOKE CREATE ON SCHEMA core FROM notification_rpc_owner;
REVOKE notification_rpc_owner FROM current_user;
