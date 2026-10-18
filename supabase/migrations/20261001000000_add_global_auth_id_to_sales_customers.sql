-- Add global_auth_id mapping Auth identity to CRM Customer
ALTER TABLE sales.customers
ADD COLUMN global_auth_id UUID NULL;

-- Strict constraint for concurrent checkouts (if present)
ALTER TABLE sales.customers
ADD CONSTRAINT uq_tenant_global_auth UNIQUE (tenant_id, global_auth_id);
