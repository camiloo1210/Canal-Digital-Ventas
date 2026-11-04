-- Default roles every store starts with.
--
-- The person who creates a store is its OWNER (unchanged). On top of that, every store now carries a
-- small set of ready-made roles the owner can assign right away and EDIT freely (name and
-- permissions). They cannot be deleted, so there is always something to assign.
--
-- They are ordinary rows of core.tenant_roles flagged is_system = true, identified per store by
-- system_key. They are CUSTOM roles: none of them includes user management or integrations (Kivi),
-- which stay OWNER only. The edits of the owner are never overwritten: the seed only inserts a key
-- that the store does not have yet.
--
--   admin          Administrador        every delegable permission
--   seller         Vendedor             view/manage orders, view catalog
--   catalog        Gestor de catálogo   view/manage catalog
--   analyst        Analista             overview, reports, view orders
--
-- core.seed_default_tenant_roles(tenant) is idempotent; the AFTER INSERT trigger on core.tenants
-- seeds every new store (including those created by onboard_tenant_transactional) and the statement
-- at the end backfills the existing ones. A role the store already named the same way is left alone.
-- Deleting a store still removes its roles (ON DELETE CASCADE); the "cannot delete" rule is enforced
-- by the application and by the repository DELETE (AND NOT is_system).
BEGIN;

ALTER TABLE core.tenant_roles
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_roles_tenant_system_key
  ON core.tenant_roles (tenant_id, system_key) WHERE system_key IS NOT NULL;

CREATE OR REPLACE FUNCTION core.seed_default_tenant_roles(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  INSERT INTO core.tenant_roles (tenant_id, name, permissions, is_system, system_key)
  VALUES
    (p_tenant_id, 'Administrador',
      ARRAY['VIEW_OVERVIEW','VIEW_REPORTS','VIEW_ORDERS','MANAGE_ORDERS','VIEW_CATALOG','MANAGE_CATALOG','MANAGE_STORE'],
      true, 'admin'),
    (p_tenant_id, 'Vendedor',
      ARRAY['VIEW_ORDERS','MANAGE_ORDERS','VIEW_CATALOG'], true, 'seller'),
    (p_tenant_id, 'Gestor de catálogo',
      ARRAY['VIEW_CATALOG','MANAGE_CATALOG'], true, 'catalog'),
    (p_tenant_id, 'Analista',
      ARRAY['VIEW_OVERVIEW','VIEW_REPORTS','VIEW_ORDERS'], true, 'analyst')
  ON CONFLICT DO NOTHING;
END;
$$;
ALTER FUNCTION core.seed_default_tenant_roles(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION core.seed_default_tenant_roles(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.seed_default_tenant_roles(uuid) TO postgres;

CREATE OR REPLACE FUNCTION core.seed_default_tenant_roles_trigger()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM core.seed_default_tenant_roles(NEW.id);
  RETURN NEW;
END;
$$;
ALTER FUNCTION core.seed_default_tenant_roles_trigger() OWNER TO postgres;
REVOKE ALL ON FUNCTION core.seed_default_tenant_roles_trigger()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.seed_default_tenant_roles_trigger() TO postgres;

DROP TRIGGER IF EXISTS seed_default_tenant_roles ON core.tenants;
CREATE TRIGGER seed_default_tenant_roles
  AFTER INSERT ON core.tenants
  FOR EACH ROW EXECUTE FUNCTION core.seed_default_tenant_roles_trigger();

SELECT core.seed_default_tenant_roles(id) FROM core.tenants;

COMMIT;
