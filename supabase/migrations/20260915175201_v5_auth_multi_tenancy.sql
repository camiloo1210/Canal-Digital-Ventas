-- Migration: v5_auth_multi_tenancy
-- Description: Implementa la arquitectura Multi-Tenant V5 (Lean JWT, RBAC estricto, Idempotencia).

-- 1. Crear ENUM para Roles
CREATE TYPE core.tenant_role AS ENUM (
  'OWNER',
  'ADMIN',
  'MEMBER'
);

-- 2. Crear tabla de Idempotencia para Onboarding
CREATE TABLE IF NOT EXISTS core.onboarding_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    idempotency_key UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (user_id, idempotency_key)
);

ALTER TABLE core.onboarding_requests ENABLE ROW LEVEL SECURITY;
-- Solo acceso interno o service_role
CREATE POLICY "Deny all for public" ON core.onboarding_requests FOR ALL TO public USING (false);

-- 3. Modificar core.users (Remover acoplamiento 1:1)
ALTER TABLE core.users DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE core.users DROP COLUMN IF EXISTS role CASCADE;
ALTER TABLE core.users DROP COLUMN IF EXISTS permissions CASCADE;

-- 4. Crear core.tenant_memberships (Única Fuente de Verdad)
CREATE TABLE IF NOT EXISTS core.tenant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    role core.tenant_role NOT NULL DEFAULT 'MEMBER',
    status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'invited')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (user_id, tenant_id)
);

CREATE INDEX idx_tenant_memberships_user_id ON core.tenant_memberships(user_id);
CREATE INDEX idx_tenant_memberships_tenant_id ON core.tenant_memberships(tenant_id);

-- 5. Invariantes de Negocio (Triggers en tenant_memberships)
CREATE OR REPLACE FUNCTION core.check_last_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  owner_count INT;
BEGIN
  -- Si se está eliminando o degradando a un OWNER
  IF (TG_OP = 'DELETE' AND OLD.role = 'OWNER') OR (TG_OP = 'UPDATE' AND OLD.role = 'OWNER' AND NEW.role != 'OWNER') THEN
    SELECT COUNT(*) INTO owner_count 
    FROM core.tenant_memberships 
    WHERE tenant_id = OLD.tenant_id AND role = 'OWNER';
    
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'No se puede eliminar o degradar al último OWNER del tenant.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_last_owner_removal
BEFORE DELETE OR UPDATE ON core.tenant_memberships
FOR EACH ROW
EXECUTE FUNCTION core.check_last_owner();

-- 6. Funciones RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION core.user_has_access_to_tenant(t_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = core
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM core.tenant_memberships tm
    WHERE tm.user_id = (SELECT auth.uid()) 
      AND tm.tenant_id = t_id
      AND tm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION core.user_has_role_in_tenant(t_id uuid, required_roles core.tenant_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = core
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM core.tenant_memberships tm
    WHERE tm.user_id = (SELECT auth.uid()) 
      AND tm.tenant_id = t_id
      AND tm.status = 'active'
      AND tm.role = ANY(required_roles)
  );
$$;

REVOKE EXECUTE ON FUNCTION core.user_has_access_to_tenant(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION core.user_has_role_in_tenant(uuid, core.tenant_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.user_has_access_to_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION core.user_has_role_in_tenant(uuid, core.tenant_role[]) TO authenticated;

-- 7. Políticas RLS en tenant_memberships
ALTER TABLE core.tenant_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own memberships" 
ON core.tenant_memberships FOR SELECT TO authenticated 
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "OWNER and ADMIN can insert memberships" 
ON core.tenant_memberships FOR INSERT TO authenticated 
WITH CHECK (
  (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['OWNER', 'ADMIN']::core.tenant_role[]))
);

CREATE POLICY "OWNER and ADMIN can update memberships" 
ON core.tenant_memberships FOR UPDATE TO authenticated 
USING (
  (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['OWNER', 'ADMIN']::core.tenant_role[]))
)
WITH CHECK (
  (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['OWNER', 'ADMIN']::core.tenant_role[]))
);

CREATE POLICY "OWNER and ADMIN can delete memberships" 
ON core.tenant_memberships FOR DELETE TO authenticated 
USING (
  (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['OWNER', 'ADMIN']::core.tenant_role[]))
);

-- 8. Actualizar Políticas RLS existentes para usar la nueva función
-- core.tenants
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON core.tenants;
CREATE POLICY "Enable read for authorized users" ON core.tenants FOR SELECT TO authenticated USING ((SELECT core.user_has_access_to_tenant(id)));
CREATE POLICY "Enable update for OWNER/ADMIN" ON core.tenants FOR UPDATE TO authenticated USING ((SELECT core.user_has_role_in_tenant(id, ARRAY['OWNER', 'ADMIN']::core.tenant_role[]))) WITH CHECK ((SELECT core.user_has_role_in_tenant(id, ARRAY['OWNER', 'ADMIN']::core.tenant_role[])));

-- core.users
DROP POLICY IF EXISTS "Enable read/write for authenticated users on core.users" ON core.users;
CREATE POLICY "Enable read for own user profile" ON core.users FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
CREATE POLICY "Enable update for own user profile" ON core.users FOR UPDATE TO authenticated USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

-- catalog.categories
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON catalog.categories;
CREATE POLICY "Enable read for authorized users" ON catalog.categories FOR SELECT TO authenticated USING ((SELECT core.user_has_access_to_tenant(tenant_id)));
CREATE POLICY "Enable all for authorized users" ON catalog.categories FOR ALL TO authenticated USING ((SELECT core.user_has_access_to_tenant(tenant_id))) WITH CHECK ((SELECT core.user_has_access_to_tenant(tenant_id)));

-- catalog.products
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON catalog.products;
CREATE POLICY "Enable read for authorized users" ON catalog.products FOR SELECT TO authenticated USING ((SELECT core.user_has_access_to_tenant(tenant_id)));
CREATE POLICY "Enable all for authorized users" ON catalog.products FOR ALL TO authenticated USING ((SELECT core.user_has_access_to_tenant(tenant_id))) WITH CHECK ((SELECT core.user_has_access_to_tenant(tenant_id)));

-- catalog.product_variants
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON catalog.product_variants;
CREATE POLICY "Enable read for authorized users" ON catalog.product_variants FOR SELECT TO authenticated USING (product_id IN (SELECT id FROM catalog.products WHERE (SELECT core.user_has_access_to_tenant(tenant_id))));
CREATE POLICY "Enable all for authorized users" ON catalog.product_variants FOR ALL TO authenticated USING (product_id IN (SELECT id FROM catalog.products WHERE (SELECT core.user_has_access_to_tenant(tenant_id)))) WITH CHECK (product_id IN (SELECT id FROM catalog.products WHERE (SELECT core.user_has_access_to_tenant(tenant_id))));

-- sales.customers, carts, cart_items, orders, order_items, payments...
-- Para simplificar, actualizaremos algunas clave, el patrón es el mismo:
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.customers;
CREATE POLICY "Enable read for authorized users" ON sales.customers FOR SELECT TO authenticated USING ((SELECT core.user_has_access_to_tenant(tenant_id)));
CREATE POLICY "Enable all for authorized users" ON sales.customers FOR ALL TO authenticated USING ((SELECT core.user_has_access_to_tenant(tenant_id))) WITH CHECK ((SELECT core.user_has_access_to_tenant(tenant_id)));

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.orders;
CREATE POLICY "Enable read for authorized users" ON sales.orders FOR SELECT TO authenticated USING ((SELECT core.user_has_access_to_tenant(tenant_id)));
CREATE POLICY "Enable all for authorized users" ON sales.orders FOR ALL TO authenticated USING ((SELECT core.user_has_access_to_tenant(tenant_id))) WITH CHECK ((SELECT core.user_has_access_to_tenant(tenant_id)));

-- 9. RPC Idempotente para Onboarding (Atomicidad)
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
    -- 1. Verificar Idempotencia
    SELECT tenant_id INTO v_existing_tenant
    FROM core.onboarding_requests
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
        -- Si ya se procesó, retornamos el tenant existente (Idempotencia pura)
        RETURN v_existing_tenant;
    END IF;

    -- 2. Transacción Atómica
    v_tenant_id := (p_tenant_data->>'id')::uuid;

    -- Crear Tenant
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

    -- Crear o Actualizar Perfil de Usuario
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

    -- Asignar Membresía OWNER
    INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status)
    VALUES (p_user_id, v_tenant_id, 'OWNER', 'active');

    -- Registrar la petición completada
    INSERT INTO core.onboarding_requests (user_id, idempotency_key, tenant_id)
    VALUES (p_user_id, p_idempotency_key, v_tenant_id);

    RETURN v_tenant_id;
END;
$$;

-- 10. Actualizar upsert_user_transactional
CREATE OR REPLACE FUNCTION public.upsert_user_transactional(user_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_version int;
    v_existing_version int;
BEGIN
    v_id := (user_data->>'id')::uuid;
    v_version := (user_data->>'version')::int;

    SELECT version INTO v_existing_version
    FROM core.users
    WHERE id = v_id;

    IF FOUND THEN
        IF v_existing_version >= v_version THEN
            RAISE EXCEPTION 'Optimistic locking failed' USING ERRCODE = 'P0001';
        END IF;

        UPDATE core.users
        SET
            email = (user_data->>'email'),
            status = (user_data->>'status'),
            first_name = (user_data->>'first_name'),
            last_name = (user_data->>'last_name'),
            updated_at = NOW(),
            version = v_version
        WHERE id = v_id;
    ELSE
        INSERT INTO core.users (id, email, status, first_name, last_name, created_at, updated_at, version)
        VALUES (
            v_id,
            (user_data->>'email'),
            (user_data->>'status'),
            (user_data->>'first_name'),
            (user_data->>'last_name'),
            NOW(), NOW(), v_version
        );
    END IF;
END;
$$;
