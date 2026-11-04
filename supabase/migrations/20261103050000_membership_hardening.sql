-- Membership hardening, deactivation sync and the single business-account rule.
--
-- H1 Membership writes from API roles (authenticated / anon) are only accepted from an ACTIVE
--    OWNER or ADMIN of that exact tenant, with anti-escalation rules. Enforced twice: tightened RLS
--    policies and a BEFORE trigger. The server's own postgres login is not an API role and is
--    unaffected.
-- H3 A trigger on core.tenant_memberships (same transaction as the application write) bans or
--    unbans the sign-in account of business accounts and revokes their sessions.
-- H4 core.is_business_account is the one place that decides whether an account belongs to a
--    business; core.accept_invitation uses it. No SQL depends on the generated email suffix.
--
-- Earlier migrations are left untouched: everything here is CREATE OR REPLACE / DROP IF EXISTS.
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- H4. Single central business rule.
-- An account is a business account when its auth app_metadata (writable only with the service role
-- key, so end users cannot forge it) or core.users.managed_by_tenant_id (guarded against API roles)
-- names a tenant. With p_tenant_id the account must belong to that very tenant.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.is_business_account(p_user_id uuid, p_tenant_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = p_user_id
      AND NULLIF(au.raw_app_meta_data ->> 'managed_by_tenant', '') IS NOT NULL
      AND (p_tenant_id IS NULL
           OR au.raw_app_meta_data ->> 'managed_by_tenant' = p_tenant_id::text)
  ) OR EXISTS (
    SELECT 1 FROM core.users cu
    WHERE cu.id = p_user_id
      AND cu.managed_by_tenant_id IS NOT NULL
      AND (p_tenant_id IS NULL OR cu.managed_by_tenant_id = p_tenant_id)
  );
$$;
REVOKE ALL ON FUNCTION core.is_business_account(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.is_business_account(uuid, uuid) TO postgres;

-- Atomic invitation acceptance: same signature, grants and behaviour as before. The only change is
-- that business ownership is decided by core.is_business_account (GENERATED_EMAIL invitation AND
-- app_metadata.managed_by_tenant equal to the invitation tenant): no email pattern, no age window.
CREATE OR REPLACE FUNCTION core.accept_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_consent boolean,
  p_age_range text,
  p_gender text,
  p_province text,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL
)
RETURNS TABLE (tenant_id uuid, role_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_inv core.tenant_invitations%ROWTYPE;
  v_manage boolean;
BEGIN
  SELECT * INTO v_inv FROM core.tenant_invitations i
  WHERE i.token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not usable' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.revoked_at IS NOT NULL OR v_inv.expires_at <= pg_catalog.now()
     OR v_inv.use_count >= v_inv.max_uses THEN
    RAISE EXCEPTION 'Invitation not usable' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM core.tenant_memberships m
             WHERE m.user_id = p_user_id AND m.tenant_id = v_inv.tenant_id) THEN
    RAISE EXCEPTION 'Already a member' USING ERRCODE = 'P0002';
  END IF;

  v_manage := v_inv.account_mode = 'GENERATED_EMAIL'
    AND core.is_business_account(p_user_id, v_inv.tenant_id);

  INSERT INTO core.users (id, email, status, first_name, last_name, created_at, updated_at, version)
  SELECT u.id, u.email, 'active', COALESCE(p_first_name, ''), COALESCE(p_last_name, ''),
         pg_catalog.now(), pg_catalog.now(), 1
  FROM auth.users u WHERE u.id = p_user_id
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(p_first_name, core.users.first_name),
    last_name = COALESCE(p_last_name, core.users.last_name),
    updated_at = pg_catalog.now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown user' USING ERRCODE = 'P0003';
  END IF;

  IF v_manage THEN
    UPDATE core.users SET managed_by_tenant_id = v_inv.tenant_id
    WHERE id = p_user_id AND managed_by_tenant_id IS NULL;
  END IF;

  -- Consent is a global flag: accepting an invitation may grant it but never withdraws it.
  IF COALESCE(p_consent, false) THEN
    UPDATE core.users
    SET demographic_consent_at = CASE WHEN NOT demographic_consent
                                      THEN pg_catalog.now() ELSE demographic_consent_at END,
        demographic_consent = true
    WHERE id = p_user_id;
  END IF;

  INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status, custom_role_id)
  VALUES (p_user_id, v_inv.tenant_id, 'MEMBER', 'active', v_inv.role_id);

  UPDATE core.tenant_invitations SET use_count = use_count + 1 WHERE id = v_inv.id;

  -- Unlinked sample: no user id, no email, month-truncated date only.
  IF COALESCE(p_consent, false) THEN
    INSERT INTO analytics.demographic_samples (tenant_id, age_range, gender, province, sample_month)
    VALUES (v_inv.tenant_id, p_age_range, p_gender, p_province,
            pg_catalog.date_trunc('month', pg_catalog.now())::date);
  END IF;

  RETURN QUERY SELECT v_inv.tenant_id, v_inv.role_id;
END;
$$;
REVOKE ALL ON FUNCTION core.accept_invitation(text, uuid, boolean, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
-- Only the privileged web database login (the owner role) may execute it.
GRANT EXECUTE ON FUNCTION core.accept_invitation(text, uuid, boolean, text, text, text, text, text)
  TO postgres;

-- ---------------------------------------------------------------------------------------------
-- H1. Membership writes.
-- A custom role must belong to the very tenant of the membership. A composite foreign key states it
-- for every writer (a trigger could not read core.tenant_roles on behalf of API roles, which have no
-- privileges on it). The migration fails, and changes nothing, if cross-tenant rows already exist.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE core.tenant_memberships
  DROP CONSTRAINT IF EXISTS tenant_memberships_custom_role_same_tenant_fkey;
ALTER TABLE core.tenant_roles
  DROP CONSTRAINT IF EXISTS uq_tenant_roles_id_tenant;
ALTER TABLE core.tenant_roles
  ADD CONSTRAINT uq_tenant_roles_id_tenant UNIQUE (id, tenant_id);
ALTER TABLE core.tenant_memberships
  ADD CONSTRAINT tenant_memberships_custom_role_same_tenant_fkey
  FOREIGN KEY (custom_role_id, tenant_id) REFERENCES core.tenant_roles (id, tenant_id);

-- Keep the last-owner invariant, with two fixes: a BEFORE DELETE trigger must return OLD (returning
-- NEW, which is NULL on DELETE, silently cancels the delete), and the owner count must see every
-- owner row whatever the caller's RLS (SECURITY DEFINER) while serialising concurrent demotions.
CREATE OR REPLACE FUNCTION core.check_last_owner()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  owner_count integer;
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'OWNER')
     OR (TG_OP = 'UPDATE' AND OLD.role = 'OWNER' AND NEW.role <> 'OWNER') THEN
    SELECT pg_catalog.count(*) INTO owner_count
    FROM (
      SELECT 1 FROM core.tenant_memberships m
      WHERE m.tenant_id = OLD.tenant_id AND m.role = 'OWNER'
      FOR UPDATE
    ) owners;
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'No se puede eliminar o degradar al último OWNER del tenant.';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION core.check_last_owner()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.check_last_owner() TO postgres;

-- Rejects membership writes coming from API roles unless the requester is an ACTIVE OWNER or ADMIN of
-- that exact tenant. SECURITY INVOKER on purpose: current_user is then the role that really executes
-- the statement, so writes made by SECURITY DEFINER functions (onboarding, accept_invitation) and by
-- the server's postgres login pass through untouched. Requester roles are read through the existing
-- SECURITY DEFINER helper core.user_has_role_in_tenant (no RLS recursion).
CREATE OR REPLACE FUNCTION core.guard_membership_write()
RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_tenant uuid;
  v_is_owner boolean;
  v_is_admin boolean;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Membership changes require an authenticated user' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'tenant_id of a membership can not be changed' USING ERRCODE = '42501';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'user_id of a membership can not be changed' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_tenant := NEW.tenant_id;
  ELSE
    v_tenant := OLD.tenant_id;
  END IF;

  v_is_owner := core.user_has_role_in_tenant(v_tenant, ARRAY['OWNER']::core.tenant_role[]);
  v_is_admin := core.user_has_role_in_tenant(v_tenant, ARRAY['ADMIN']::core.tenant_role[]);
  IF NOT (v_is_owner OR v_is_admin) THEN
    RAISE EXCEPTION 'Only an active owner or admin of the tenant can change its memberships'
      USING ERRCODE = '42501';
  END IF;

  -- Only an OWNER may create, modify or delete OWNER rows (or make one): owners are unrestricted
  -- here, the last owner stays protected by core.check_last_owner.
  IF v_is_owner THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- An ADMIN only manages MEMBER rows and never its own row.
  IF TG_OP IN ('INSERT', 'UPDATE') AND (NEW.role <> 'MEMBER' OR NEW.user_id = v_actor) THEN
    RAISE EXCEPTION 'An admin can only manage other members' USING ERRCODE = '42501';
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND (OLD.role <> 'MEMBER' OR OLD.user_id = v_actor) THEN
    RAISE EXCEPTION 'An admin can only manage other members' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION core.guard_membership_write()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.guard_membership_write() TO postgres;

-- Fires before prevent_last_owner_removal (alphabetical order).
DROP TRIGGER IF EXISTS guard_membership_write ON core.tenant_memberships;
CREATE TRIGGER guard_membership_write
  BEFORE INSERT OR UPDATE OR DELETE ON core.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION core.guard_membership_write();

DROP TRIGGER IF EXISTS prevent_last_owner_removal ON core.tenant_memberships;
CREATE TRIGGER prevent_last_owner_removal
  BEFORE DELETE OR UPDATE ON core.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION core.check_last_owner();

-- Tightened policies (same names as the originals). OWNER: any row of its tenant. ADMIN: MEMBER rows
-- of its tenant, never its own.
DROP POLICY IF EXISTS "OWNER and ADMIN can insert memberships" ON core.tenant_memberships;
CREATE POLICY "OWNER and ADMIN can insert memberships"
ON core.tenant_memberships FOR INSERT TO authenticated
WITH CHECK (
  (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['OWNER']::core.tenant_role[]))
  OR (
    (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['ADMIN']::core.tenant_role[]))
    AND role = 'MEMBER'
    AND user_id <> (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "OWNER and ADMIN can update memberships" ON core.tenant_memberships;
CREATE POLICY "OWNER and ADMIN can update memberships"
ON core.tenant_memberships FOR UPDATE TO authenticated
USING (
  (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['OWNER']::core.tenant_role[]))
  OR (
    (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['ADMIN']::core.tenant_role[]))
    AND role = 'MEMBER'
    AND user_id <> (SELECT auth.uid())
  )
)
WITH CHECK (
  (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['OWNER']::core.tenant_role[]))
  OR (
    (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['ADMIN']::core.tenant_role[]))
    AND role = 'MEMBER'
    AND user_id <> (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "OWNER and ADMIN can delete memberships" ON core.tenant_memberships;
CREATE POLICY "OWNER and ADMIN can delete memberships"
ON core.tenant_memberships FOR DELETE TO authenticated
USING (
  (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['OWNER']::core.tenant_role[]))
  OR (
    (SELECT core.user_has_role_in_tenant(tenant_id, ARRAY['ADMIN']::core.tenant_role[]))
    AND role = 'MEMBER'
    AND user_id <> (SELECT auth.uid())
  )
);

-- ---------------------------------------------------------------------------------------------
-- H3. Deactivation sync, in the same transaction as the membership change. The application only
-- updates core.tenant_memberships.status or deletes the row. For a business account (H4) with no
-- OTHER active membership, suspending or unlinking bans the sign-in account and drops its sessions;
-- reactivating clears the ban. Any error rolls the whole transaction back.
-- NOTE: writing auth.users from here depends on the privileges of the function owner on Supabase.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.sync_business_account_access()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_tenant uuid;
  v_active boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    v_tenant := OLD.tenant_id;
    v_active := false;
  ELSE
    v_user := NEW.user_id;
    v_tenant := NEW.tenant_id;
    v_active := NEW.status = 'active';
  END IF;

  IF NOT core.is_business_account(v_user) THEN
    RETURN NULL;
  END IF;

  IF v_active THEN
    UPDATE auth.users SET banned_until = NULL WHERE id = v_user;
    RETURN NULL;
  END IF;

  -- Another active membership keeps the account usable.
  IF EXISTS (
    SELECT 1 FROM core.tenant_memberships m
    WHERE m.user_id = v_user AND m.tenant_id <> v_tenant AND m.status = 'active'
  ) THEN
    RETURN NULL;
  END IF;

  UPDATE auth.users
  SET banned_until = pg_catalog.now() + interval '100 years'
  WHERE id = v_user;
  DELETE FROM auth.refresh_tokens WHERE user_id::text = v_user::text;
  DELETE FROM auth.sessions WHERE user_id = v_user;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION core.sync_business_account_access()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.sync_business_account_access() TO postgres;

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

COMMIT;
