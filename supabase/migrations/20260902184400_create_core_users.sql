CREATE TABLE IF NOT EXISTS core.users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    email VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    first_name VARCHAR,
    last_name VARCHAR,
    permissions TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    version INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON core.users(tenant_id);

ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read/write for authenticated users on core.users" ON core.users;
CREATE POLICY "Enable read/write for authenticated users on core.users" ON core.users FOR ALL TO authenticated USING (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid) WITH CHECK (tenant_id = (select auth.jwt()->>'app_tenant_id')::uuid);
