-- Migration: outbox_pattern (Fix)
-- Description: Updates the onboarding RPC to insert into the EXISTING outbox_events table to prevent dual-write bugs.

-- Update the RPC to insert into Outbox atomically
CREATE OR REPLACE FUNCTION core.onboard_tenant_transactional(
    p_idempotency_key uuid,
    p_user_id uuid,
    p_tenant_data jsonb,
    p_user_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id uuid;
    v_existing_tenant uuid;
BEGIN
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
