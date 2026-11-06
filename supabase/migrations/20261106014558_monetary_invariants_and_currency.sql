-- Align persisted monetary invariants with the commercial int4 limit in Core.
-- Existing monetary figures are never rewritten. NOT VALID checks protect new writes
-- without silently correcting historical data; validate legacy rows after reconciliation.
BEGIN;

ALTER TABLE sales.orders ADD COLUMN currency text;
-- Prefer actual provider evidence for historical orders; otherwise use the store's currency.
UPDATE sales.orders o SET currency = coalesce((
  SELECT p.currency FROM sales.payments p
  WHERE p.order_id = o.id AND p.currency IS NOT NULL AND p.status <> 'failed'
  ORDER BY CASE WHEN p.status IN ('completed','partially_refunded','refunded','late_payment_pending_compensation')
    THEN 0 ELSE 1 END, p.created_at DESC, p.id DESC LIMIT 1
), t.base_currency)
FROM core.tenants t WHERE t.id = o.tenant_id AND o.currency IS NULL;
ALTER TABLE sales.orders ALTER COLUMN currency SET NOT NULL;
ALTER TABLE sales.orders ADD CONSTRAINT orders_currency_supported
  CHECK (currency IN ('USD','EUR','COP','MXN','ARS','BRL','CLP','PEN')) NOT VALID;

ALTER TABLE catalog.products ADD CONSTRAINT products_money_nonnegative
  CHECK (price_cents >= 0 AND cost_cents >= 0 AND wholesale_price_cents >= 0) NOT VALID;
ALTER TABLE catalog.product_variants ADD CONSTRAINT variants_money_nonnegative
  CHECK (price_override_cents IS NULL OR price_override_cents >= 0) NOT VALID;
ALTER TABLE sales.orders ADD CONSTRAINT orders_money_consistent CHECK (
  subtotal_cents >= 0 AND tax_amount_cents >= 0 AND discount_amount_cents >= 0
  AND shipping_cost_cents >= 0 AND total_amount_cents >= 0
  AND total_amount_cents::bigint = subtotal_cents::bigint + tax_amount_cents::bigint
    + shipping_cost_cents::bigint - discount_amount_cents::bigint
) NOT VALID;
ALTER TABLE sales.order_items ADD CONSTRAINT order_items_money_consistent CHECK (
  quantity > 0 AND unit_price_cents >= 0 AND subtotal_cents >= 0
  AND subtotal_cents::bigint = unit_price_cents::bigint * quantity::bigint
) NOT VALID;
ALTER TABLE sales.cart_items ADD CONSTRAINT cart_items_money_consistent CHECK (
  quantity > 0 AND unit_price_cents >= 0 AND subtotal_cents >= 0
  AND subtotal_cents = unit_price_cents::bigint * quantity::bigint
) NOT VALID;

CREATE FUNCTION sales.guard_order_currency_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'Order currency is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION sales.guard_order_currency_snapshot() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sales.guard_order_currency_snapshot() TO postgres;
CREATE TRIGGER order_currency_immutable BEFORE UPDATE OF currency ON sales.orders
  FOR EACH ROW EXECUTE FUNCTION sales.guard_order_currency_snapshot();

CREATE FUNCTION core.guard_tenant_currency() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.base_currency IS DISTINCT FROM OLD.base_currency THEN
    RAISE EXCEPTION 'Store currency is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION core.guard_tenant_currency() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.guard_tenant_currency() TO postgres;
CREATE TRIGGER tenant_currency_immutable BEFORE UPDATE OF base_currency ON core.tenants
  FOR EACH ROW EXECUTE FUNCTION core.guard_tenant_currency();

-- Existing restricted financial/notification readers need the new immutable snapshot.
GRANT SELECT (currency) ON sales.orders TO payments_rpc_owner, notification_rpc_owner;

-- Versioned public projection keeps existing RPC contracts intact.
CREATE FUNCTION public.get_public_products_by_slug_v2(
    p_tenant_slug VARCHAR,
    p_category_slug VARCHAR DEFAULT NULL,
    p_search VARCHAR DEFAULT NULL,
    p_page INT DEFAULT 1,
    p_limit INT DEFAULT 24
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    price_cents INT,
    description VARCHAR,
    category_id UUID,
    sku VARCHAR,
    image_url VARCHAR,
    has_variants BOOLEAN,
    in_stock BOOLEAN,
    availability_status VARCHAR,
    total_count BIGINT,
    wholesale_price_cents INT,
    wholesale_min_quantity INT,
    currency text
)
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_page INT;
    v_limit INT;
    v_offset INT;
    v_tenant_id UUID;
    v_is_b2b_authorized BOOLEAN := FALSE;
BEGIN
    v_page := GREATEST(COALESCE(p_page, 1), 1);
    v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 24);
    v_offset := (v_page - 1) * v_limit;

    -- Resolver Tenant
    SELECT t.id INTO v_tenant_id FROM core.tenants t WHERE t.slug = p_tenant_slug AND t.status = 'active';

    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Resolver Autorizacion B2B
    IF auth.uid() IS NOT NULL THEN
        v_is_b2b_authorized := EXISTS (
            SELECT 1 FROM core.tenant_memberships tm
            WHERE tm.user_id = auth.uid()
              AND tm.tenant_id = v_tenant_id
              AND tm.status = 'active'
        );
    END IF;

    RETURN QUERY
    SELECT 
        p.id, 
        p.name, 
        p.price_cents, 
        p.description, 
        p.category_id, 
        p.sku, 
        p.image_url, 
        p.has_variants, 
        (p.stock > 0) AS in_stock,
        CASE
            WHEN p.stock > 20 THEN 'AVAILABLE'::VARCHAR
            WHEN p.stock >= 1 AND p.stock <= 20 THEN 'LOW_STOCK'::VARCHAR
            WHEN p.stock = 0 THEN 'OUT_OF_STOCK'::VARCHAR
            ELSE 'CHECK_AVAILABILITY'::VARCHAR
        END AS availability_status,
        COUNT(*) OVER() AS total_count,
        CASE WHEN v_is_b2b_authorized AND p.wholesale_price_cents > 0 THEN p.wholesale_price_cents ELSE NULL::int END AS wholesale_price_cents,
        CASE WHEN v_is_b2b_authorized AND p.wholesale_price_cents > 0 THEN p.wholesale_min_quantity ELSE NULL::int END AS wholesale_min_quantity,
        (SELECT t.base_currency::text FROM core.tenants t WHERE t.id = v_tenant_id) AS currency
    FROM catalog.products p
    LEFT JOIN catalog.categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
    WHERE p.tenant_id = v_tenant_id
      AND p.status = 'active'
      AND (p.category_id IS NULL OR c.status = 'active')
      AND (p_category_slug IS NULL OR c.slug = p_category_slug)
      AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%')
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit
    OFFSET v_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_products_by_slug_v2(varchar,varchar,varchar,integer,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_products_by_slug_v2(varchar,varchar,varchar,integer,integer) TO anon, authenticated;

-- Versioned public projection keeps existing RPC contracts intact.
CREATE FUNCTION public.get_public_product_by_id_v2(
  p_tenant_slug VARCHAR,
  p_product_id UUID
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  price_cents integer,
  description VARCHAR,
  category_id UUID,
  sku VARCHAR,
  image_url VARCHAR,
  has_variants boolean,
  in_stock boolean,
  availability_status VARCHAR,
  wholesale_price_cents integer,
  wholesale_min_quantity integer,
    currency text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_tenant_id UUID;
    v_is_b2b_authorized BOOLEAN := FALSE;
BEGIN
    -- Resolver Tenant
    SELECT t.id INTO v_tenant_id FROM core.tenants t WHERE t.slug = p_tenant_slug AND t.status = 'active';

    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Resolver Autorizacion B2B
    IF auth.uid() IS NOT NULL THEN
        v_is_b2b_authorized := EXISTS (
            SELECT 1 FROM core.tenant_memberships tm
            WHERE tm.user_id = auth.uid()
              AND tm.tenant_id = v_tenant_id
              AND tm.status = 'active'
        );
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.price_cents,
        p.description,
        p.category_id,
        p.sku,
        p.image_url,
        p.has_variants,
        (p.stock > 0) AS in_stock,
        CASE
            WHEN p.stock > 20 THEN 'AVAILABLE'::VARCHAR
            WHEN p.stock >= 1 AND p.stock <= 20 THEN 'LOW_STOCK'::VARCHAR
            WHEN p.stock = 0 THEN 'OUT_OF_STOCK'::VARCHAR
            ELSE 'CHECK_AVAILABILITY'::VARCHAR
        END AS availability_status,
        CASE WHEN v_is_b2b_authorized AND p.wholesale_price_cents > 0 THEN p.wholesale_price_cents ELSE NULL::int END AS wholesale_price_cents,
        CASE WHEN v_is_b2b_authorized AND p.wholesale_price_cents > 0 THEN p.wholesale_min_quantity ELSE NULL::int END AS wholesale_min_quantity,
        (SELECT t.base_currency::text FROM core.tenants t WHERE t.id = v_tenant_id) AS currency
    FROM catalog.products p
    WHERE p.tenant_id = v_tenant_id
      AND p.id = p_product_id
      AND p.status = 'active';
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_product_by_id_v2(varchar,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_product_by_id_v2(varchar,uuid) TO anon, authenticated;

CREATE FUNCTION core.kivi_sync_get_product_with_offset_v4(p_tenant_id uuid, p_product_id uuid)
RETURNS TABLE (id uuid, tenant_id uuid, name text, price_cents integer, description text,
               stock integer, status text, version integer, kivi_version_offset integer,
               wholesale_price_cents integer, wholesale_min_quantity integer, image_urls text[], currency text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.tenant_id, p.name::text, p.price_cents, p.description::text,
           p.stock, p.status::text, p.version, COALESCE(o.version_offset, 0),
           p.wholesale_price_cents, p.wholesale_min_quantity,
           COALESCE((
             SELECT array_agg(x.u ORDER BY x.first_pos)
             FROM (
               SELECT t.u, min(t.pos) AS first_pos
               FROM unnest(p.gallery_urls || CASE WHEN p.image_url IS NULL THEN '{}'::text[] ELSE ARRAY[p.image_url::text] END)
                    WITH ORDINALITY AS t(u, pos)
               WHERE t.u ~ '^https://[^[:space:]]+$' AND length(t.u) <= 2048
               GROUP BY t.u
               ORDER BY min(t.pos)
               LIMIT 5
             ) x
           ), '{}'::text[]), tenant.base_currency::text
    FROM catalog.products p
    JOIN core.tenants tenant ON tenant.id = p.tenant_id
    JOIN core.kivi_connections c ON c.tenant_id = p.tenant_id AND c.status <> 'unlinked'
    LEFT JOIN core.kivi_product_version_offsets o
      ON o.tenant_id = p.tenant_id AND o.product_id = p.id
    WHERE p.tenant_id = p_tenant_id AND p.id = p_product_id;
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_get_product_with_offset_v4(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_get_product_with_offset_v4(uuid,uuid) TO kivi_sync_worker_role;

CREATE FUNCTION core.kivi_sync_list_products_with_offset_v4(p_tenant_id uuid, p_after_id uuid, p_limit integer)
RETURNS TABLE (id uuid, tenant_id uuid, name text, price_cents integer, description text,
               stock integer, status text, version integer, kivi_version_offset integer,
               wholesale_price_cents integer, wholesale_min_quantity integer, image_urls text[], currency text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'kivi_sync_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized worker access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.tenant_id, p.name::text, p.price_cents, p.description::text,
           p.stock, p.status::text, p.version, COALESCE(o.version_offset, 0),
           p.wholesale_price_cents, p.wholesale_min_quantity,
           COALESCE((
             SELECT array_agg(x.u ORDER BY x.first_pos)
             FROM (
               SELECT t.u, min(t.pos) AS first_pos
               FROM unnest(p.gallery_urls || CASE WHEN p.image_url IS NULL THEN '{}'::text[] ELSE ARRAY[p.image_url::text] END)
                    WITH ORDINALITY AS t(u, pos)
               WHERE t.u ~ '^https://[^[:space:]]+$' AND length(t.u) <= 2048
               GROUP BY t.u
               ORDER BY min(t.pos)
               LIMIT 5
             ) x
           ), '{}'::text[]), tenant.base_currency::text
    FROM catalog.products p
    JOIN core.tenants tenant ON tenant.id = p.tenant_id
    JOIN core.kivi_connections c ON c.tenant_id = p.tenant_id AND c.status <> 'unlinked'
    LEFT JOIN core.kivi_product_version_offsets o
      ON o.tenant_id = p.tenant_id AND o.product_id = p.id
    WHERE p.tenant_id = p_tenant_id AND (p_after_id IS NULL OR p.id > p_after_id)
    ORDER BY p.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$$;
REVOKE ALL ON FUNCTION core.kivi_sync_list_products_with_offset_v4(uuid,uuid,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.kivi_sync_list_products_with_offset_v4(uuid,uuid,integer) TO kivi_sync_worker_role;

-- Preserve all payment fences; choose currency from the order snapshot.
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
  SELECT ord.id,ord.tenant_id,ord.customer_id,ord.status,ord.total_amount_cents,ord.currency INTO o
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
    SELECT o.currency AS base_currency INTO c FROM core.tenants t WHERE t.id = o.tenant_id AND t.status = 'active';
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
REVOKE ALL ON FUNCTION sales.create_pending_payment(uuid,uuid,text,text,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sales.create_pending_payment(uuid,uuid,text,text,integer) TO payment_checkout_role;

CREATE OR REPLACE FUNCTION core.read_order_notification_details(p_tenant_id uuid, p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp AS $$
DECLARE details jsonb;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized notification worker' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'orderId', o.id, 'tenantSlug', t.slug, 'logoUrl', t.logo_url, 'contactEmail', t.contact_email,
    'customerName', c.name, 'createdAt', o.created_at, 'currency', o.currency,
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
REVOKE ALL ON FUNCTION core.read_order_notification_details(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.read_order_notification_details(uuid,uuid) TO notification_worker_role;

COMMIT;
