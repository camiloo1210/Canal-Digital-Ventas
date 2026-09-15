-- ==========================================
-- RPCs FOR TRANSACTIONAL UPDATES (OPTIMISTIC LOCKING)
-- ==========================================

CREATE OR REPLACE FUNCTION upsert_tenant_transactional(tenant_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_version int;
    v_existing_version int;
BEGIN
    v_id := (tenant_data->>'id')::uuid;
    v_version := (tenant_data->>'version')::int;

    -- Check if tenant exists
    SELECT version INTO v_existing_version
    FROM core.tenants
    WHERE id = v_id;

    IF FOUND THEN
        -- Optimistic locking check
        IF v_existing_version >= v_version THEN
            RAISE EXCEPTION 'Optimistic locking failed' USING ERRCODE = 'P0001';
        END IF;

        UPDATE core.tenants
        SET
            name = (tenant_data->>'name'),
            slug = (tenant_data->>'slug'),
            contact_email = (tenant_data->>'contact_email'),
            base_currency = (tenant_data->>'base_currency'),
            status = (tenant_data->>'status'),
            updated_at = NOW(),
            version = v_version
        WHERE id = v_id;
    ELSE
        INSERT INTO core.tenants (
            id, name, slug, contact_email, base_currency, status, created_at, updated_at, version
        )
        VALUES (
            v_id,
            (tenant_data->>'name'),
            (tenant_data->>'slug'),
            (tenant_data->>'contact_email'),
            (tenant_data->>'base_currency'),
            (tenant_data->>'status'),
            NOW(),
            NOW(),
            v_version
        );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_user_transactional(user_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_version int;
    v_existing_version int;
    v_permissions text[];
BEGIN
    v_id := (user_data->>'id')::uuid;
    v_version := (user_data->>'version')::int;

    IF user_data ? 'permissions' AND jsonb_array_length(user_data->'permissions') > 0 THEN
        SELECT array_agg(x::text) INTO v_permissions
        FROM jsonb_array_elements_text(user_data->'permissions') x;
    ELSE
        v_permissions := ARRAY[]::text[];
    END IF;

    -- Check if user exists
    SELECT version INTO v_existing_version
    FROM core.users
    WHERE id = v_id;

    IF FOUND THEN
        -- Optimistic locking check
        IF v_existing_version >= v_version THEN
            RAISE EXCEPTION 'Optimistic locking failed' USING ERRCODE = 'P0001';
        END IF;

        UPDATE core.users
        SET
            tenant_id = (user_data->>'tenant_id')::uuid,
            email = (user_data->>'email'),
            role = (user_data->>'role'),
            status = (user_data->>'status'),
            first_name = (user_data->>'first_name'),
            last_name = (user_data->>'last_name'),
            permissions = v_permissions,
            updated_at = NOW(),
            version = v_version
        WHERE id = v_id;
    ELSE
        INSERT INTO core.users (
            id, tenant_id, email, role, status, first_name, last_name, permissions, created_at, updated_at, version
        )
        VALUES (
            v_id,
            (user_data->>'tenant_id')::uuid,
            (user_data->>'email'),
            (user_data->>'role'),
            (user_data->>'status'),
            (user_data->>'first_name'),
            (user_data->>'last_name'),
            v_permissions,
            NOW(),
            NOW(),
            v_version
        );
    END IF;
END;
$$;
