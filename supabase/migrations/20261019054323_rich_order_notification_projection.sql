-- Read-only, tenant-scoped projection for the restricted notification worker.
-- Existing recipient and delivery functions retain their signatures and authorization.
GRANT notification_rpc_owner TO current_user;
GRANT CREATE ON SCHEMA core TO notification_rpc_owner;
GRANT SELECT (slug, logo_url, contact_email, base_currency) ON core.tenants TO notification_rpc_owner;
GRANT SELECT (name) ON sales.customers TO notification_rpc_owner;
GRANT SELECT (created_at, subtotal_cents, tax_amount_cents, discount_amount_cents,
  shipping_cost_cents, total_amount_cents, shipping_address_street, shipping_address_city,
  shipping_address_state, shipping_address_zip_code, shipping_address_country)
  ON sales.orders TO notification_rpc_owner;
GRANT SELECT (id, product_name, sku, quantity, unit_price_cents, subtotal_cents)
  ON sales.order_items TO notification_rpc_owner;
GRANT SELECT (image_url) ON catalog.products TO notification_rpc_owner;

CREATE OR REPLACE FUNCTION core.read_order_notification_details(p_tenant_id uuid, p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp AS $$
DECLARE details jsonb;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized notification worker' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'orderId', o.id, 'tenantSlug', t.slug, 'logoUrl', t.logo_url, 'contactEmail', t.contact_email,
    'customerName', c.name, 'createdAt', o.created_at, 'currency', t.base_currency,
    'subtotalCents', o.subtotal_cents, 'taxAmountCents', o.tax_amount_cents,
    'discountAmountCents', o.discount_amount_cents, 'shippingCostCents', o.shipping_cost_cents,
    'totalAmountCents', o.total_amount_cents,
    'shippingAddress', concat_ws(', ', o.shipping_address_street, o.shipping_address_city,
      o.shipping_address_state, o.shipping_address_zip_code, o.shipping_address_country),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', i.product_name, 'sku', i.sku, 'quantity', i.quantity,
      'unitPriceCents', i.unit_price_cents, 'subtotalCents', i.subtotal_cents,
      'imageUrl', p.image_url) ORDER BY i.id)
      FROM sales.order_items i
      LEFT JOIN catalog.products p ON p.id = i.product_id AND p.tenant_id = o.tenant_id
      WHERE i.order_id = o.id), '[]'::jsonb)) INTO details
  FROM sales.orders o
  JOIN core.tenants t ON t.id = o.tenant_id
  JOIN sales.customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
  WHERE o.id = p_order_id AND o.tenant_id = p_tenant_id;
  RETURN details;
END;
$$;
ALTER FUNCTION core.read_order_notification_details(uuid, uuid) OWNER TO notification_rpc_owner;
REVOKE ALL ON FUNCTION core.read_order_notification_details(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.read_order_notification_details(uuid, uuid) TO notification_worker_role;
REVOKE CREATE ON SCHEMA core FROM notification_rpc_owner;
REVOKE notification_rpc_owner FROM current_user;
