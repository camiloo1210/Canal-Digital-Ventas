-- Bind legacy RPC actors and close browser aggregate mutation bypasses.
-- Existing Node use cases retain their transaction boundaries; public read projections remain available.
BEGIN;

-- Legacy names remain for existing adapters. Creation belongs to authenticated onboarding.
CREATE OR REPLACE FUNCTION public.upsert_tenant_transactional(tenant_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_id uuid := (tenant_data->>'id')::uuid; v_version integer := (tenant_data->>'version')::integer;
BEGIN
  IF auth.uid() IS NULL OR NOT core.member_has_permission(auth.uid(),v_id,ARRAY['MANAGE_STORE']::text[])
     OR (tenant_data ? 'status' AND (tenant_data->>'status') IS DISTINCT FROM (SELECT t.status FROM core.tenants t WHERE t.id=v_id)) THEN
    RAISE EXCEPTION 'Store access denied' USING ERRCODE='42501';
  END IF;
  IF v_version IS NULL OR v_version<1 THEN RAISE EXCEPTION 'Optimistic locking failed' USING ERRCODE='P0001'; END IF;
  -- Only the fields owned by Tenant.customizeStore; no lifecycle, currency or ownership changes.
  UPDATE core.tenants SET name=tenant_data->>'name',slug=tenant_data->>'slug',
    logo_url=tenant_data->>'logo_url',banner_url=tenant_data->>'banner_url',description=tenant_data->>'description',
    updated_at=pg_catalog.now(),version=v_version
  WHERE id=v_id AND version=v_version-1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Optimistic locking failed' USING ERRCODE='P0001'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_user_transactional(user_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_id uuid := (user_data->>'id')::uuid; v_version integer := (user_data->>'version')::integer;
BEGIN
  IF auth.uid() IS NULL OR v_id IS DISTINCT FROM auth.uid()
     OR (user_data->>'email') IS DISTINCT FROM (SELECT u.email FROM auth.users u WHERE u.id=auth.uid())
     OR (user_data->>'status') IS DISTINCT FROM (SELECT u.status FROM core.users u WHERE u.id=auth.uid()) THEN
    RAISE EXCEPTION 'Profile access denied' USING ERRCODE='42501';
  END IF;
  IF v_version IS NULL OR v_version<1 THEN RAISE EXCEPTION 'Optimistic locking failed' USING ERRCODE='P0001'; END IF;
  UPDATE core.users SET email=user_data->>'email',first_name=user_data->>'first_name',last_name=user_data->>'last_name',
    updated_at=pg_catalog.now(),version=v_version
  WHERE id=v_id AND version=v_version-1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Optimistic locking failed' USING ERRCODE='P0001'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION core.onboard_tenant_transactional(
    p_idempotency_key uuid,
    p_user_id uuid,
    p_tenant_data jsonb,
    p_user_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_tenant_id uuid;
    v_existing_tenant uuid;
BEGIN
    IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()
       OR (p_user_data->>'email') IS DISTINCT FROM (SELECT u.email FROM auth.users u WHERE u.id=auth.uid()) THEN
      RAISE EXCEPTION 'Onboarding actor mismatch' USING ERRCODE = '42501';
    END IF;
    -- 1. Idempotency Check
    SELECT tenant_id INTO v_existing_tenant
    FROM core.onboarding_requests
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
        RETURN v_existing_tenant;
    END IF;

    -- 2. Atomic Transaction
    v_tenant_id := (p_tenant_data->>'id')::uuid;

    -- Create Tenant
    INSERT INTO core.tenants (id, name, slug, contact_email, base_currency, status, created_at, updated_at, version)
    VALUES (
        v_tenant_id,
        (p_tenant_data->>'name'),
        (p_tenant_data->>'slug'),
        (p_tenant_data->>'contact_email'),
        (p_tenant_data->>'base_currency'),
        (p_tenant_data->>'status'),
        NOW(), NOW(), 1
    );

    -- Create or Update User Profile
    INSERT INTO core.users (id, email, status, first_name, last_name, created_at, updated_at, version)
    VALUES (
        p_user_id,
        (p_user_data->>'email'),
        'active',
        (p_user_data->>'first_name'),
        (p_user_data->>'last_name'),
        NOW(), NOW(), 1
    )
    ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = NOW();

    -- Assign OWNER Membership
    INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status)
    VALUES (p_user_id, v_tenant_id, 'OWNER', 'active');

    -- Record completed request
    INSERT INTO core.onboarding_requests (user_id, idempotency_key, tenant_id)
    VALUES (p_user_id, p_idempotency_key, v_tenant_id);

    -- ATOMIC OUTBOX INSERT: UserRegisteredEvent payload
    -- Ensures the background worker will update raw_app_meta_data later with 100% guarantee
    INSERT INTO core.outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (
        v_tenant_id,
        'User',
        p_user_id,
        'UserRegisteredEvent',
        jsonb_build_object(
            'id', p_user_id,
            'tenantId', v_tenant_id,
            'email', (p_user_data->>'email'),
            'role', 'OWNER'
        )
    );

    -- ATOMIC OUTBOX INSERT: TenantCreatedEvent payload (If needed elsewhere)
    INSERT INTO core.outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (
        v_tenant_id,
        'Tenant',
        v_tenant_id,
        'TenantCreatedEvent',
        jsonb_build_object(
            'tenantId', v_tenant_id
        )
    );

    RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_tenant_transactional(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.upsert_tenant_transactional(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_user_transactional(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.upsert_user_transactional(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION core.onboard_tenant_transactional(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION core.onboard_tenant_transactional(uuid,uuid,jsonb,jsonb) TO authenticated;

-- Accept only the current authenticated identity; never expose the arbitrary-user permission helper.
CREATE OR REPLACE FUNCTION core.current_member_has_permission(p_tenant_id uuid, p_permissions text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND core.member_has_permission(auth.uid(),p_tenant_id,p_permissions);
$$;
REVOKE ALL ON FUNCTION core.current_member_has_permission(uuid,text[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION core.current_member_has_permission(uuid,text[]) TO authenticated;

-- Writes to business aggregates must go through authorized Node use cases, not PostgREST DML.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON
  core.tenants,core.users,core.tenant_memberships,
  catalog.categories,catalog.products,catalog.product_variants,
  sales.customers,sales.orders,sales.order_items,sales.payments,sales.carts,sales.cart_items
  FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA core,catalog,sales REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON catalog.categories;
DROP POLICY IF EXISTS "Enable read for authorized users" ON catalog.categories;
DROP POLICY IF EXISTS "Enable all for authorized users" ON catalog.categories;
CREATE POLICY permission_scoped_read ON catalog.categories FOR SELECT TO authenticated USING (core.current_member_has_permission(tenant_id,ARRAY['VIEW_CATALOG','MANAGE_CATALOG']::text[]));

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON catalog.products;
DROP POLICY IF EXISTS "Enable read for authorized users" ON catalog.products;
DROP POLICY IF EXISTS "Enable all for authorized users" ON catalog.products;
CREATE POLICY permission_scoped_read ON catalog.products FOR SELECT TO authenticated USING (core.current_member_has_permission(tenant_id,ARRAY['VIEW_CATALOG','MANAGE_CATALOG']::text[]));

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON catalog.product_variants;
DROP POLICY IF EXISTS "Enable read for authorized users" ON catalog.product_variants;
DROP POLICY IF EXISTS "Enable all for authorized users" ON catalog.product_variants;
CREATE POLICY permission_scoped_read ON catalog.product_variants FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM catalog.products p WHERE p.id=product_id AND core.current_member_has_permission(p.tenant_id,ARRAY['VIEW_CATALOG','MANAGE_CATALOG']::text[])));

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.customers;
DROP POLICY IF EXISTS "Enable read for authorized users" ON sales.customers;
DROP POLICY IF EXISTS "Enable all for authorized users" ON sales.customers;
CREATE POLICY permission_scoped_read ON sales.customers FOR SELECT TO authenticated USING (core.current_member_has_permission(tenant_id,ARRAY['VIEW_ORDERS','MANAGE_ORDERS']::text[]));

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.orders;
DROP POLICY IF EXISTS "Enable read for authorized users" ON sales.orders;
DROP POLICY IF EXISTS "Enable all for authorized users" ON sales.orders;
CREATE POLICY permission_scoped_read ON sales.orders FOR SELECT TO authenticated USING (core.current_member_has_permission(tenant_id,ARRAY['VIEW_ORDERS','MANAGE_ORDERS']::text[]));

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.order_items;
DROP POLICY IF EXISTS "Enable read for authorized users" ON sales.order_items;
DROP POLICY IF EXISTS "Enable all for authorized users" ON sales.order_items;
CREATE POLICY permission_scoped_read ON sales.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sales.orders o WHERE o.id=order_id AND core.current_member_has_permission(o.tenant_id,ARRAY['VIEW_ORDERS','MANAGE_ORDERS']::text[])));

DROP POLICY IF EXISTS "Tenant-Isolated Uploads" ON storage.objects;
CREATE POLICY "Tenant-Isolated Uploads" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='products' AND EXISTS (
    SELECT 1 FROM core.tenant_memberships m
    WHERE m.user_id=auth.uid() AND m.status='active'
      AND m.tenant_id::text=(storage.foldername(name))[1]
      AND core.current_member_has_permission(m.tenant_id,ARRAY['MANAGE_CATALOG']::text[])
  )
);
-- Financial evidence and worker leases have no browser consumer. Keep them behind server ports.
REVOKE SELECT ON sales.payments,sales.refund_operations,sales.compensation_obligations FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS payments_tenant_read ON sales.payments;
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.payments;
DROP POLICY IF EXISTS refund_tenant_read ON sales.refund_operations;

DROP POLICY IF EXISTS "Store branding manager upload" ON storage.objects;
CREATE POLICY "Store branding manager upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='store-branding' AND EXISTS (
  SELECT 1 FROM core.tenant_memberships m WHERE m.user_id=auth.uid() AND m.status='active'
    AND m.tenant_id::text=(storage.foldername(name))[1]
    AND core.current_member_has_permission(m.tenant_id,ARRAY['MANAGE_STORE']::text[])
));
DROP POLICY IF EXISTS "Store branding manager cleanup" ON storage.objects;
CREATE POLICY "Store branding manager cleanup" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='store-branding' AND EXISTS (
  SELECT 1 FROM core.tenant_memberships m WHERE m.user_id=auth.uid() AND m.status='active'
    AND m.tenant_id::text=(storage.foldername(name))[1]
    AND core.current_member_has_permission(m.tenant_id,ARRAY['MANAGE_STORE']::text[])
));
COMMIT;
