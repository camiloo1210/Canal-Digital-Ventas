-- Audit fixes after the membership hardening migration.
--
-- D1 A product can only reference a category of its own tenant, enforced by the engine.
-- D2 check_last_owner: the whole tenant may be deleted (cascade), the last ACTIVE owner can not be
--    suspended, and the tenant of a membership can never change.
-- D3 sync_business_account_access evaluates the GLOBAL membership state of the account, also on
--    INSERT, and only lifts bans it set itself.
-- D4 core.revoke_user_sessions: a narrow function to drop the sessions of a business account AFTER
--    the (external) password change, outside of any application transaction.
--
-- Earlier migrations are left untouched: everything here is CREATE OR REPLACE / DROP IF EXISTS.
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- D1. Category integrity at engine level.
-- catalog.products.category_id is NOT NULL, so the composite foreign key below is always fully
-- checked. (Had the column been nullable, the default MATCH SIMPLE would skip the check whenever
-- category_id IS NULL, which is the wanted behaviour for an optional category.)
-- The single column foreign key from the initial schema is kept: it is implied by the composite one
-- but harmless. The migration FAILS SAFE, changing nothing, if cross-tenant rows already exist.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_cross_tenant bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO v_cross_tenant
  FROM catalog.products p
  JOIN catalog.categories c ON c.id = p.category_id
  WHERE c.tenant_id <> p.tenant_id;
  IF v_cross_tenant > 0 THEN
    RAISE EXCEPTION
      'Cannot enforce category integrity: % product(s) reference a category of another tenant. Fix or remove them, then run this migration again.',
      v_cross_tenant
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER TABLE catalog.products
  DROP CONSTRAINT IF EXISTS products_category_same_tenant_fkey;
ALTER TABLE catalog.categories
  DROP CONSTRAINT IF EXISTS uq_categories_tenant_id_id;
ALTER TABLE catalog.categories
  ADD CONSTRAINT uq_categories_tenant_id_id UNIQUE (tenant_id, id);
ALTER TABLE catalog.products
  ADD CONSTRAINT products_category_same_tenant_fkey
  FOREIGN KEY (tenant_id, category_id) REFERENCES catalog.categories (tenant_id, id);

-- ---------------------------------------------------------------------------------------------
-- D2. Last owner protection.
-- Whole tenant deletion: DELETE FROM core.tenants removes the tenant row first; the ON DELETE
-- CASCADE of core.tenant_memberships then runs as an AFTER trigger of that statement, i.e. after the
-- parent row is deleted and with a fresh command id, so the BEFORE DELETE row trigger below sees no
-- core.tenants row for OLD.tenant_id and lets the cascade through. Deleting a user that is the sole
-- OWNER of a tenant that still exists keeps being blocked, because that tenant row is still there.
-- Fallback for that visibility reasoning (it was never executed against a live server by the author):
-- a BEFORE DELETE trigger on core.tenants marks the tenant id in a transaction-local setting before
-- the row goes away, and the cascade is also accepted for that exact tenant id. The setting could be
-- forged only by a session able to run arbitrary SQL, which API roles are not on Supabase.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.mark_tenant_deletion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_catalog.set_config('core.tenant_being_deleted', OLD.id::text, true);
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION core.mark_tenant_deletion()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.mark_tenant_deletion() TO postgres;

DROP TRIGGER IF EXISTS mark_tenant_deletion ON core.tenants;
CREATE TRIGGER mark_tenant_deletion
  BEFORE DELETE ON core.tenants
  FOR EACH ROW EXECUTE FUNCTION core.mark_tenant_deletion();

CREATE OR REPLACE FUNCTION core.check_last_owner()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_other_owners integer;
  v_other_active_owners integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role <> 'OWNER' THEN
      RETURN OLD;
    END IF;
    -- Cascade of a tenant deletion: the tenant row is already gone in this snapshot (see above).
    IF NOT EXISTS (SELECT 1 FROM core.tenants t WHERE t.id = OLD.tenant_id)
       OR pg_catalog.current_setting('core.tenant_being_deleted', true) = OLD.tenant_id::text THEN
      RETURN OLD;
    END IF;
    -- Direct delete of an OWNER row: another OWNER row must remain.
    SELECT pg_catalog.count(*) INTO v_other_owners
    FROM (
      SELECT 1 FROM core.tenant_memberships m
      WHERE m.tenant_id = OLD.tenant_id AND m.role = 'OWNER' AND m.id <> OLD.id
      FOR UPDATE
    ) owners;
    IF v_other_owners < 1 THEN
      RAISE EXCEPTION 'No se puede eliminar o degradar al último OWNER del tenant.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE. A membership never moves to another tenant, whoever writes it.
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id of a membership can not be changed' USING ERRCODE = '42501';
  END IF;

  IF OLD.role = 'OWNER' AND NEW.role <> 'OWNER' THEN
    -- Demotion: another OWNER row must remain.
    SELECT pg_catalog.count(*) INTO v_other_owners
    FROM (
      SELECT 1 FROM core.tenant_memberships m
      WHERE m.tenant_id = OLD.tenant_id AND m.role = 'OWNER' AND m.id <> OLD.id
      FOR UPDATE
    ) owners;
    IF v_other_owners < 1 THEN
      RAISE EXCEPTION 'No se puede eliminar o degradar al último OWNER del tenant.';
    END IF;
  END IF;

  -- Suspending (or otherwise deactivating) an active OWNER: another ACTIVE owner must remain.
  IF OLD.role = 'OWNER' AND OLD.status = 'active' AND NEW.status <> 'active' THEN
    SELECT pg_catalog.count(*) INTO v_other_active_owners
    FROM (
      SELECT 1 FROM core.tenant_memberships m
      WHERE m.tenant_id = OLD.tenant_id AND m.role = 'OWNER' AND m.status = 'active'
        AND m.id <> OLD.id
      FOR UPDATE
    ) owners;
    IF v_other_active_owners < 1 THEN
      RAISE EXCEPTION 'No se puede suspender al último OWNER activo del tenant.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION core.check_last_owner()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.check_last_owner() TO postgres;

-- The trigger prevent_last_owner_removal (BEFORE DELETE OR UPDATE ON core.tenant_memberships) already
-- exists from the hardening migration and calls this function; it is recreated to be explicit.
DROP TRIGGER IF EXISTS prevent_last_owner_removal ON core.tenant_memberships;
CREATE TRIGGER prevent_last_owner_removal
  BEFORE DELETE OR UPDATE ON core.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION core.check_last_owner();

-- ---------------------------------------------------------------------------------------------
-- D3. Ban state of business accounts from the GLOBAL membership state.
-- PRIVILEGES: this function writes auth.users and deletes from auth.sessions and
-- auth.refresh_tokens. Its OWNER must therefore be a role allowed to do so (on Supabase: postgres,
-- or supabase_auth_admin). It must NOT be owned by authenticated, anon or service_role. Run
-- supabase/tests/auth-permissions-smoke.sql on staging to prove it; if the owner lacks the
-- privileges, do the ban / sign-out from the server through the Auth admin API instead.
--
-- Desired state after any membership INSERT, status UPDATE or DELETE of a business account:
--   banned  when it has a suspended membership in a tenant that manages it, or no active membership
--   usable  otherwise
-- A ban is only lifted when it is the long ban set by this function (more than 50 years ahead), so
-- a shorter ban put by someone else stays.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.sync_business_account_access()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_ban boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
  ELSE
    v_user := NEW.user_id;
  END IF;

  IF NOT core.is_business_account(v_user) THEN
    RETURN NULL;
  END IF;

  v_ban := EXISTS (
    SELECT 1 FROM core.tenant_memberships m
    WHERE m.user_id = v_user AND m.status = 'suspended'
      AND core.is_business_account(v_user, m.tenant_id)
  ) OR NOT EXISTS (
    SELECT 1 FROM core.tenant_memberships m
    WHERE m.user_id = v_user AND m.status = 'active'
  );

  IF v_ban THEN
    UPDATE auth.users
    SET banned_until = pg_catalog.now() + interval '100 years'
    WHERE id = v_user
      AND (banned_until IS NULL OR banned_until < pg_catalog.now() + interval '50 years');
    DELETE FROM auth.refresh_tokens WHERE user_id::text = v_user::text;
    DELETE FROM auth.sessions WHERE user_id = v_user;
  ELSE
    UPDATE auth.users
    SET banned_until = NULL
    WHERE id = v_user
      AND banned_until >= pg_catalog.now() + interval '50 years';
  END IF;
  RETURN NULL;
END;
$$;
ALTER FUNCTION core.sync_business_account_access() OWNER TO postgres;
REVOKE ALL ON FUNCTION core.sync_business_account_access()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.sync_business_account_access() TO postgres;

DROP TRIGGER IF EXISTS sync_business_account_access_insert ON core.tenant_memberships;
CREATE TRIGGER sync_business_account_access_insert
  AFTER INSERT ON core.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION core.sync_business_account_access();

DROP TRIGGER IF EXISTS sync_business_account_access_status ON core.tenant_memberships;
CREATE TRIGGER sync_business_account_access_status
  AFTER UPDATE OF status ON core.tenant_memberships
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION core.sync_business_account_access();

DROP TRIGGER IF EXISTS sync_business_account_access_delete ON core.tenant_memberships;
CREATE TRIGGER sync_business_account_access_delete
  AFTER DELETE ON core.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION core.sync_business_account_access();

-- ---------------------------------------------------------------------------------------------
-- D4. Session revocation after a password reset. The application changes the password through the
-- Auth admin API first (never inside a database transaction) and only then calls this function in
-- its own statement. Only business accounts, only the web server login (postgres). Same privilege
-- requirement as the function above: the OWNER must be able to delete from auth.sessions and
-- auth.refresh_tokens.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.revoke_user_sessions(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NOT core.is_business_account(p_user_id) THEN
    RAISE EXCEPTION 'Sessions can only be revoked for business accounts' USING ERRCODE = '42501';
  END IF;
  DELETE FROM auth.refresh_tokens WHERE user_id::text = p_user_id::text;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
END;
$$;
ALTER FUNCTION core.revoke_user_sessions(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION core.revoke_user_sessions(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.revoke_user_sessions(uuid) TO postgres;

COMMIT;
