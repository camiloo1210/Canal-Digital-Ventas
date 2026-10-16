-- Separate receipts for each owner and notification kind. No financial permissions change.
GRANT notification_rpc_owner TO current_user;
GRANT CREATE ON SCHEMA core TO notification_rpc_owner;
GRANT SELECT (id,email,status) ON core.users TO notification_rpc_owner;
GRANT SELECT (user_id,tenant_id,role,status) ON core.tenant_memberships TO notification_rpc_owner;
GRANT SELECT (order_id,product_id) ON sales.order_items TO notification_rpc_owner;
GRANT USAGE ON SCHEMA catalog TO notification_rpc_owner;
GRANT SELECT (id,tenant_id,name,sku,stock,status) ON catalog.products TO notification_rpc_owner;
CREATE POLICY merchant_notification_users_read ON core.users FOR SELECT TO notification_rpc_owner USING (true);
CREATE POLICY merchant_notification_memberships_read ON core.tenant_memberships FOR SELECT TO notification_rpc_owner USING (true);
CREATE POLICY merchant_notification_items_read ON sales.order_items FOR SELECT TO notification_rpc_owner USING (true);
CREATE POLICY merchant_notification_products_read ON catalog.products FOR SELECT TO notification_rpc_owner USING (true);

CREATE TABLE core.merchant_notification_deliveries (
  message_id uuid NOT NULL REFERENCES core.outbox_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('new_order','paid','cancelled','low_stock')),
  status text NOT NULL CHECK (status IN ('PROCESSING','SENT','RETRY','DEAD')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 5),
  owner_token uuid,
  lease_until timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (message_id,user_id,kind),
  CHECK ((status='PROCESSING' AND owner_token IS NOT NULL AND lease_until IS NOT NULL)
    OR (status<>'PROCESSING' AND owner_token IS NULL AND lease_until IS NULL))
);
ALTER TABLE core.merchant_notification_deliveries OWNER TO notification_rpc_owner;
ALTER TABLE core.merchant_notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.merchant_notification_deliveries FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION core.read_merchant_order_notification(p_message_id uuid,p_tenant_id uuid,p_order_id uuid,p_event_type text)
RETURNS TABLE(user_id uuid,email text,order_number text,tenant_name text,stock_items jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,pg_temp AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'notification_worker_role','MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized notification worker' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT u.id,u.email::text,o.order_number::text,t.name::text,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('productId',p.id,'name',p.name,'sku',p.sku,'stock',p.stock) ORDER BY p.id)
      FROM catalog.products p WHERE p.tenant_id=o.tenant_id AND p.status<>'archived'
      AND EXISTS(SELECT 1 FROM sales.order_items i WHERE i.order_id=o.id AND i.product_id=p.id)),'[]'::jsonb)
  FROM core.outbox_events e JOIN sales.orders o ON o.id=e.aggregate_id AND o.tenant_id=e.tenant_id
  JOIN core.tenants t ON t.id=o.tenant_id
  JOIN core.tenant_memberships m ON m.tenant_id=o.tenant_id AND m.role='OWNER' AND m.status='active'
  JOIN core.users u ON u.id=m.user_id AND u.status='active'
  WHERE e.id=p_message_id AND e.tenant_id=p_tenant_id AND o.id=p_order_id
    AND e.aggregate_type='Order' AND e.event_type=p_event_type
    AND e.event_type IN ('OrderConfirmedEvent','OrderPaidEvent','OrderCancelledEvent')
    AND NOT EXISTS(SELECT 1 FROM core.outbox_relay_exclusions x WHERE x.event_id=e.id);
END;
$$;

CREATE FUNCTION core.claim_merchant_notification_delivery(p_message_id uuid,p_user_id uuid,p_kind text,p_owner uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,pg_temp AS $$
DECLARE v_event record; v_state text;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'notification_worker_role','MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized notification worker' USING ERRCODE='42501';
  END IF;
  IF p_owner IS NULL THEN RETURN 'INVALID'; END IF;
  SELECT e.tenant_id,e.aggregate_id,e.event_type INTO v_event FROM core.outbox_events e
    WHERE e.id=p_message_id AND e.aggregate_type='Order'
      AND NOT EXISTS(SELECT 1 FROM core.outbox_relay_exclusions x WHERE x.event_id=e.id);
  IF NOT FOUND THEN RETURN 'INVALID'; END IF;
  IF NOT ((v_event.event_type='OrderConfirmedEvent' AND p_kind IN ('new_order','low_stock'))
    OR (v_event.event_type='OrderPaidEvent' AND p_kind='paid')
    OR (v_event.event_type='OrderCancelledEvent' AND p_kind='cancelled')) THEN RETURN 'INVALID'; END IF;
  IF NOT EXISTS(SELECT 1 FROM core.read_merchant_order_notification(p_message_id,v_event.tenant_id,v_event.aggregate_id,v_event.event_type) r WHERE r.user_id=p_user_id) THEN RETURN 'INVALID'; END IF;
  UPDATE core.merchant_notification_deliveries d SET status='DEAD',owner_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
    WHERE d.message_id=p_message_id AND d.user_id=p_user_id AND d.kind=p_kind AND d.attempts>=5
      AND (d.status='RETRY' OR (d.status='PROCESSING' AND d.lease_until<=clock_timestamp()));
  INSERT INTO core.merchant_notification_deliveries AS d(message_id,user_id,kind,status,owner_token,lease_until)
    VALUES(p_message_id,p_user_id,p_kind,'PROCESSING',p_owner,clock_timestamp()+interval '5 minutes')
    ON CONFLICT(message_id,user_id,kind) DO UPDATE SET status='PROCESSING',owner_token=p_owner,
      lease_until=clock_timestamp()+interval '5 minutes',attempts=d.attempts+1,updated_at=clock_timestamp()
    WHERE d.attempts<5 AND (d.status='RETRY' OR (d.status='PROCESSING' AND d.lease_until<=clock_timestamp()))
    RETURNING d.status INTO v_state;
  IF FOUND THEN RETURN 'CLAIMED'; END IF;
  SELECT d.status INTO v_state FROM core.merchant_notification_deliveries d
    WHERE d.message_id=p_message_id AND d.user_id=p_user_id AND d.kind=p_kind;
  RETURN CASE WHEN v_state='SENT' THEN 'SENT' WHEN v_state='DEAD' THEN 'DEAD' ELSE 'BUSY' END;
END;
$$;

CREATE FUNCTION core.finish_merchant_notification_delivery(p_message_id uuid,p_user_id uuid,p_kind text,p_owner uuid,p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,pg_temp AS $$
DECLARE v_count integer;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user,'notification_worker_role','MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized notification worker' USING ERRCODE='42501';
  END IF;
  IF p_status NOT IN ('SENT','RETRY','DEAD') THEN RETURN false; END IF;
  UPDATE core.merchant_notification_deliveries d SET status=p_status,owner_token=NULL,lease_until=NULL,
    delivered_at=CASE WHEN p_status='SENT' THEN clock_timestamp() ELSE NULL END,updated_at=clock_timestamp()
    WHERE d.message_id=p_message_id AND d.user_id=p_user_id AND d.kind=p_kind AND d.status='PROCESSING'
      AND d.owner_token=p_owner AND d.lease_until>clock_timestamp();
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count=1;
END;
$$;

ALTER FUNCTION core.read_merchant_order_notification(uuid,uuid,uuid,text) OWNER TO notification_rpc_owner;
ALTER FUNCTION core.claim_merchant_notification_delivery(uuid,uuid,text,uuid) OWNER TO notification_rpc_owner;
ALTER FUNCTION core.finish_merchant_notification_delivery(uuid,uuid,text,uuid,text) OWNER TO notification_rpc_owner;
REVOKE ALL ON FUNCTION core.read_merchant_order_notification(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION core.claim_merchant_notification_delivery(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION core.finish_merchant_notification_delivery(uuid,uuid,text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION core.read_merchant_order_notification(uuid,uuid,uuid,text) TO notification_worker_role;
GRANT EXECUTE ON FUNCTION core.claim_merchant_notification_delivery(uuid,uuid,text,uuid) TO notification_worker_role;
GRANT EXECUTE ON FUNCTION core.finish_merchant_notification_delivery(uuid,uuid,text,uuid,text) TO notification_worker_role;
REVOKE CREATE ON SCHEMA core FROM notification_rpc_owner;
REVOKE notification_rpc_owner FROM current_user;
