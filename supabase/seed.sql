-- Seed data for testing products

-- Insert a tenant
INSERT INTO core.tenants (id, name, slug, contact_email, base_currency, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Tenant', 'demo-tenant', 'demo@example.com', 'USD', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert a category
INSERT INTO catalog.categories (id, name, tenant_id, description, status)
VALUES ('22222222-2222-2222-2222-222222222222', 'Electronics', '11111111-1111-1111-1111-111111111111', 'Electronic devices and gadgets', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert products
INSERT INTO catalog.products (id, name, price_cents, cost_cents, wholesale_price_cents, description, stock, category_id, status, sku, tenant_id, has_variants, is_vat_exempt)
VALUES 
('33333333-3333-3333-3333-333333333333', 'Smartphone X', 99900, 60000, 80000, 'The latest smartphone model.', 50, '22222222-2222-2222-2222-222222222222', 'active', 'SKU-SMART-X', '11111111-1111-1111-1111-111111111111', false, false),
('44444444-4444-4444-4444-444444444444', 'Wireless Headphones', 19900, 10000, 15000, 'Noise cancelling wireless headphones.', 100, '22222222-2222-2222-2222-222222222222', 'active', 'SKU-HEAD-W', '11111111-1111-1111-1111-111111111111', false, false)
ON CONFLICT (id) DO NOTHING;
