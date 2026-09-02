-- ==========================================
-- PERMISSIONS AND GRANTS
-- ==========================================

GRANT USAGE ON SCHEMA core TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA catalog TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA sales TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA core TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA catalog TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA sales TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sales GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ==========================================
-- SECURE RLS POLICIES (MULTI-TENANCY)
-- ==========================================

-- CORE
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON core.tenants;
CREATE POLICY "Enable read/write for authenticated users" ON core.tenants FOR ALL TO authenticated USING (id = (select auth.jwt()->>'app_tenant_id')::uuid) WITH CHECK (id = (select auth.jwt()->>'app_tenant_id')::uuid);

-- CATALOG
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON catalog.categories;
CREATE POLICY "Enable read/write for authenticated users" ON catalog.categories FOR ALL TO authenticated USING (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid) WITH CHECK (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid);

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON catalog.products;
CREATE POLICY "Enable read/write for authenticated users" ON catalog.products FOR ALL TO authenticated USING (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid) WITH CHECK (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid);

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON catalog.product_variants;
CREATE POLICY "Enable read/write for authenticated users" ON catalog.product_variants FOR ALL TO authenticated USING (product_id IN (SELECT id FROM catalog.products WHERE tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid)) WITH CHECK (product_id IN (SELECT id FROM catalog.products WHERE tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid));

-- SALES
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.customers;
CREATE POLICY "Enable read/write for authenticated users" ON sales.customers FOR ALL TO authenticated USING (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid) WITH CHECK (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid);

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.carts;
CREATE POLICY "Enable read/write for authenticated users" ON sales.carts FOR ALL TO authenticated USING (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid) WITH CHECK (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid);

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.cart_items;
CREATE POLICY "Enable read/write for authenticated users" ON sales.cart_items FOR ALL TO authenticated USING (cart_id IN (SELECT id FROM sales.carts WHERE tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid)) WITH CHECK (cart_id IN (SELECT id FROM sales.carts WHERE tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid));

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.orders;
CREATE POLICY "Enable read/write for authenticated users" ON sales.orders FOR ALL TO authenticated USING (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid) WITH CHECK (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid);

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.order_items;
CREATE POLICY "Enable read/write for authenticated users" ON sales.order_items FOR ALL TO authenticated USING (order_id IN (SELECT id FROM sales.orders WHERE tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid)) WITH CHECK (order_id IN (SELECT id FROM sales.orders WHERE tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid));

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.payments;
CREATE POLICY "Enable read/write for authenticated users" ON sales.payments FOR ALL TO authenticated USING (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid) WITH CHECK (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid);
