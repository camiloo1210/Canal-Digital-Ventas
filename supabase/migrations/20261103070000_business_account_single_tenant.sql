-- A business account belongs to exactly ONE company, for ever.
--
-- Business account = created through an invitation link WITHOUT Google and WITHOUT the person's own
-- email (generated login email). core.is_business_account(user) identifies it; with a tenant id it
-- states that this tenant is the one that manages it. Personal accounts (Google / real email) are
-- not affected.
--
-- 1. core.enforce_business_account_single_tenant(): BEFORE INSERT / BEFORE UPDATE OF tenant_id,
--    user_id trigger on core.tenant_memberships. Raises SQLSTATE P0004 when a business account would
--    be linked to any tenant other than its managing one. Being a trigger it binds EVERY writer: API
--    roles, the SECURITY DEFINER functions (onboard_tenant_transactional would make the account OWNER
--    of a brand new tenant; accept_invitation) and the server's postgres login.
-- 2. core.accept_invitation: same signature, grants and behaviour as in 20261103050000, plus an early
--    friendly P0004 check before anything is written.
--
-- ORDER OF TRIGGERS (BEFORE row triggers fire alphabetically): guard_membership_write (API-role
-- authorisation, 42501) < prevent_last_owner_removal < restrict_business_account_* (this one). So an
-- unauthorised API caller gets 42501 first and learns nothing about the target account; every writer
-- that passes the guard meets P0004. sync_business_account_access_* are AFTER triggers: they only run
-- once this check has accepted the row.
--
-- RE-LINKING: after an unlink the account keeps core.users.managed_by_tenant_id / app_metadata, so
-- inserting it again into its OWN tenant still passes (is_business_account(user, tenant) is true).
--
-- DELETED MANAGING TENANT: core.users.managed_by_tenant_id is ON DELETE SET NULL, but the auth
-- app_metadata.managed_by_tenant still names the deleted tenant, so the account stays a business
-- account that matches NO existing tenant: it can be linked nowhere (acceptable by design; it is
-- unusable). Only if the metadata is also gone does it turn into an ordinary account.
-- Existing rows are not re-validated.
--
-- Earlier migrations are left untouched: everything here is CREATE OR REPLACE / DROP IF EXISTS.
BEGIN;

CREATE OR REPLACE FUNCTION core.enforce_business_account_single_tenant()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF core.is_business_account(NEW.user_id)
     AND NOT core.is_business_account(NEW.user_id, NEW.tenant_id) THEN
    RAISE EXCEPTION 'A business account can only belong to the company that manages it'
      USING ERRCODE = 'P0004';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION core.enforce_business_account_single_tenant() OWNER TO postgres;
REVOKE ALL ON FUNCTION core.enforce_business_account_single_tenant()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.enforce_business_account_single_tenant() TO postgres;

DROP TRIGGER IF EXISTS restrict_business_account_insert ON core.tenant_memberships;
CREATE TRIGGER restrict_business_account_insert
  BEFORE INSERT ON core.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION core.enforce_business_account_single_tenant();

DROP TRIGGER IF EXISTS restrict_business_account_update ON core.tenant_memberships;
CREATE TRIGGER restrict_business_account_update
  BEFORE UPDATE OF tenant_id, user_id ON core.tenant_memberships
  FOR EACH ROW
  WHEN (OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR OLD.user_id IS DISTINCT FROM NEW.user_id)
  EXECUTE FUNCTION core.enforce_business_account_single_tenant();

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

  -- A business account (generated email, no Google, no own email) belongs to ONE company for ever:
  -- refuse early and friendly. The trigger on core.tenant_memberships stays the last line of defence.
  IF core.is_business_account(p_user_id)
     AND NOT core.is_business_account(p_user_id, v_inv.tenant_id) THEN
    RAISE EXCEPTION 'Business account bound to another company' USING ERRCODE = 'P0004';
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

COMMIT;
