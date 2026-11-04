-- Business-managed accounts.
-- An account created by a GENERATED_EMAIL invitation belongs to the business that invited the person:
-- its owner may rename it, reset its password, deactivate it and unlink it. Every other account
-- (Google, the person's own email, pre-existing buyers) is PERSONAL: the business can only unlink it.
-- Existing rows are intentionally left NULL (personal): ownership can not be proven retroactively.
BEGIN;

ALTER TABLE core.users
  ADD COLUMN IF NOT EXISTS managed_by_tenant_id uuid NULL REFERENCES core.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_managed_by_tenant ON core.users (managed_by_tenant_id)
  WHERE managed_by_tenant_id IS NOT NULL;

-- API roles (PostgREST) must never write the ownership marker; only server-side definers may.
CREATE OR REPLACE FUNCTION core.guard_user_managed_by()
RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_changed := NEW.managed_by_tenant_id IS NOT NULL;
  ELSE
    v_changed := NEW.managed_by_tenant_id IS DISTINCT FROM OLD.managed_by_tenant_id;
  END IF;
  IF v_changed AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'managed_by_tenant_id can not be changed by API roles' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION core.guard_user_managed_by()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.guard_user_managed_by() TO postgres;

DROP TRIGGER IF EXISTS guard_user_managed_by ON core.users;
CREATE TRIGGER guard_user_managed_by
  BEFORE INSERT OR UPDATE OF managed_by_tenant_id ON core.users
  FOR EACH ROW EXECUTE FUNCTION core.guard_user_managed_by();

-- Atomic invitation acceptance (same signature and behaviour as before) that additionally records
-- ownership of accounts created by this very flow.
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

  -- The business owns the account only when this acceptance created it: a generated-email
  -- invitation, a brand new non deliverable login, no membership anywhere and no previous owner.
  -- An existing personal account can never be taken over.
  v_manage := v_inv.account_mode = 'GENERATED_EMAIL'
    AND NOT EXISTS (SELECT 1 FROM core.tenant_memberships pm WHERE pm.user_id = p_user_id)
    AND NOT EXISTS (SELECT 1 FROM core.users pu
                    WHERE pu.id = p_user_id AND pu.managed_by_tenant_id IS NOT NULL)
    AND EXISTS (SELECT 1 FROM auth.users au
                WHERE au.id = p_user_id
                  AND au.email LIKE '%.staff.invalid'
                  AND au.created_at > pg_catalog.now() - interval '1 hour');

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

COMMIT;
