-- Migration: initial_schema
-- Description: Creates the core, catalog, and sales schemas along with all domain entities.

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS sales;

-- ==========================================
-- CORE SCHEMA
-- ==========================================

-- 1. Tenants Table (Aggregate Root)
CREATE TABLE core.tenants (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    slug VARCHAR NOT NULL UNIQUE,
    contact_email VARCHAR NOT NULL,
    base_currency VARCHAR NOT NULL,
    status VARCHAR NOT NULL CHECK (status IN ('pending_setup', 'active', 'suspended', 'archived')),
    tax_id VARCHAR,
    custom_domain VARCHAR UNIQUE,
    logo_url VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    version INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_tenants_slug ON core.tenants(slug);

ALTER TABLE core.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for authenticated users" ON core.tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- CATALOG SCHEMA
-- ==========================================

-- 2. Categories Table (Aggregate Root)
CREATE TABLE catalog.categories (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    description TEXT NOT NULL,
    status VARCHAR NOT NULL CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    version INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_categories_tenant_id ON catalog.categories(tenant_id);

ALTER TABLE catalog.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for authenticated users" ON catalog.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 3. Products Table (Aggregate Root)
CREATE TABLE catalog.products (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    price_cents INTEGER NOT NULL,
    cost_cents INTEGER NOT NULL,
    wholesale_price_cents INTEGER NOT NULL,
    description VARCHAR(200) NOT NULL,
    stock INTEGER NOT NULL CHECK (stock >= 0),
    category_id UUID NOT NULL REFERENCES catalog.categories(id),
    expiration_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR NOT NULL CHECK (status IN ('active', 'inactive', 'out_of_stock', 'archived')),
    sku VARCHAR NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    season_ids UUID[],
    image_path VARCHAR,
    image_url VARCHAR,
    has_variants BOOLEAN NOT NULL DEFAULT false,
    is_vat_exempt BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    version INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_products_tenant_id ON catalog.products(tenant_id);
CREATE INDEX idx_products_category_id ON catalog.products(category_id);

ALTER TABLE catalog.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for authenticated users" ON catalog.products FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 4. Product Variants Table (Child Entity)
CREATE TABLE catalog.product_variants (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    sku VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    price_override_cents INTEGER,
    stock INTEGER NOT NULL CHECK (stock >= 0),
    status VARCHAR NOT NULL CHECK (status IN ('active', 'inactive', 'out_of_stock', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_product_variants_product_id ON catalog.product_variants(product_id);

ALTER TABLE catalog.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for authenticated users" ON catalog.product_variants FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ==========================================
-- SALES SCHEMA
-- ==========================================

-- 5. Customers Table (Aggregate Root)
CREATE TABLE sales.customers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    name VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    phone VARCHAR NOT NULL,
    document_id VARCHAR NOT NULL,
    status VARCHAR NOT NULL CHECK (status IN ('active', 'inactive', 'suspended')),
    address_street VARCHAR NOT NULL,
    address_city VARCHAR NOT NULL,
    address_state VARCHAR NOT NULL,
    address_zip_code VARCHAR NOT NULL,
    address_country VARCHAR NOT NULL,
    address_reference VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    version INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_tenant_email UNIQUE (tenant_id, email)
);

CREATE INDEX idx_customers_tenant_id ON sales.customers(tenant_id);

ALTER TABLE sales.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for authenticated users" ON sales.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 6. Carts Table (Aggregate Root)
CREATE TABLE sales.carts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    customer_id UUID REFERENCES sales.customers(id),
    status VARCHAR NOT NULL CHECK (status IN ('active', 'abandoned', 'converted')),
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    version INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_carts_tenant_id ON sales.carts(tenant_id);

ALTER TABLE sales.carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for authenticated users" ON sales.carts FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 7. Cart Items Table (Child Entity)
CREATE TABLE sales.cart_items (
    id UUID PRIMARY KEY,
    cart_id UUID NOT NULL REFERENCES sales.carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES catalog.products(id),
    product_name VARCHAR NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL,
    variant_id UUID REFERENCES catalog.product_variants(id),
    sku VARCHAR NOT NULL,
    subtotal_cents INTEGER NOT NULL
);

CREATE INDEX idx_cart_items_cart_id ON sales.cart_items(cart_id);

ALTER TABLE sales.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for authenticated users" ON sales.cart_items FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 8. Orders Table (Aggregate Root)
CREATE TABLE sales.orders (
    id UUID PRIMARY KEY,
    order_number VARCHAR NOT NULL,
    customer_id UUID NOT NULL REFERENCES sales.customers(id),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    status VARCHAR NOT NULL CHECK (status IN ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    subtotal_cents INTEGER NOT NULL,
    tax_amount_cents INTEGER NOT NULL,
    discount_amount_cents INTEGER NOT NULL,
    shipping_cost_cents INTEGER NOT NULL,
    total_amount_cents INTEGER NOT NULL,
    shipping_address_street VARCHAR NOT NULL,
    shipping_address_city VARCHAR NOT NULL,
    shipping_address_state VARCHAR NOT NULL,
    shipping_address_zip_code VARCHAR NOT NULL,
    shipping_address_country VARCHAR NOT NULL,
    shipping_address_reference VARCHAR,
    payment_gateway_id VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    version INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_tenant_order_number UNIQUE (tenant_id, order_number)
);

CREATE INDEX idx_orders_tenant_id ON sales.orders(tenant_id);
CREATE INDEX idx_orders_customer_id ON sales.orders(customer_id);
CREATE INDEX idx_orders_order_number ON sales.orders(order_number);

ALTER TABLE sales.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for authenticated users" ON sales.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 9. Order Items Table (Child Entity)
CREATE TABLE sales.order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES sales.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES catalog.products(id),
    product_name VARCHAR NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL,
    variant_id UUID REFERENCES catalog.product_variants(id),
    sku VARCHAR NOT NULL,
    subtotal_cents INTEGER NOT NULL
);

CREATE INDEX idx_order_items_order_id ON sales.order_items(order_id);

ALTER TABLE sales.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for authenticated users" ON sales.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 10. Payments Table (Aggregate Root)
CREATE TABLE sales.payments (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES sales.orders(id),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    customer_id UUID NOT NULL REFERENCES sales.customers(id),
    status VARCHAR NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    gateway VARCHAR NOT NULL CHECK (gateway IN ('lemon_squeezy', 'stripe', 'paypal', 'mercadopago', 'bank_transfer', 'cash')),
    amount_cents INTEGER NOT NULL,
    gateway_transaction_id VARCHAR,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    version INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_payments_order_id ON sales.payments(order_id);
CREATE INDEX idx_payments_tenant_id ON sales.payments(tenant_id);

ALTER TABLE sales.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for authenticated users" ON sales.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
