DROP VIEW IF EXISTS catalog.public_active_products;
DROP VIEW IF EXISTS catalog.public_active_categories;
DROP VIEW IF EXISTS core.public_active_tenants;

CREATE VIEW core.public_active_tenants AS
SELECT id, name, slug, status
FROM core.tenants
WHERE status = 'active';

GRANT SELECT ON core.public_active_tenants TO authenticated, anon;

CREATE VIEW catalog.public_active_categories AS
SELECT id, name, description, tenant_id, status, 0 as version
FROM catalog.categories
WHERE status = 'active';

GRANT SELECT ON catalog.public_active_categories TO authenticated, anon;

CREATE VIEW catalog.public_active_products AS
SELECT id, name, price_cents, 0 as cost_cents, NULL::int as wholesale_price_cents, description, stock, category_id, sku, status, tenant_id, is_vat_exempt, image_url, 0 as version
FROM catalog.products
WHERE status = 'active';

GRANT SELECT ON catalog.public_active_products TO authenticated, anon;
