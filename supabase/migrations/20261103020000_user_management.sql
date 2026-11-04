-- User management: custom tenant roles (permission sets), role invitations, demographic consent
-- and anonymous demographic samples. Every new table is closed to the API roles; the web backend
-- reaches them through its privileged database login (authorization lives in TypeScript).
-- Known gap: existing RLS still lets any active member read tenant data; granular permissions are
-- enforced in the application layer.
BEGIN;

CREATE SCHEMA IF NOT EXISTS analytics;
REVOKE ALL ON SCHEMA analytics FROM PUBLIC, anon, authenticated, service_role;

-- 1. Custom roles per tenant.
CREATE TABLE IF NOT EXISTS core.tenant_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  permissions text[] NOT NULL CHECK (cardinality(permissions) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_roles_tenant_lower_name
  ON core.tenant_roles (tenant_id, lower(name));
ALTER TABLE core.tenant_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.tenant_roles FROM PUBLIC, anon, authenticated, service_role;

-- 2. Membership -> custom role. RESTRICT: a role with members cannot be deleted.
ALTER TABLE core.tenant_memberships
  ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES core.tenant_roles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_custom_role_id
  ON core.tenant_memberships (custom_role_id) WHERE custom_role_id IS NOT NULL;

-- 3. Invitations. Only the SHA-256 hash of the token is stored.
CREATE TABLE IF NOT EXISTS core.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES core.tenant_roles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  max_uses integer NOT NULL CHECK (max_uses BETWEEN 1 AND 100),
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count >= 0 AND use_count <= max_uses),
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant ON core.tenant_invitations (tenant_id, created_at DESC);
ALTER TABLE core.tenant_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.tenant_invitations FROM PUBLIC, anon, authenticated, service_role;

-- 4. Demographic consent lives on the user; the samples carry no identity.
ALTER TABLE core.users
  ADD COLUMN IF NOT EXISTS demographic_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demographic_consent_at timestamptz;

CREATE TABLE IF NOT EXISTS analytics.demographic_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES core.tenants(id) ON DELETE SET NULL,
  age_range text CHECK (age_range IN ('18_24','25_34','35_44','45_54','55_64','65_PLUS')),
  gender text CHECK (gender IN ('FEMALE','MALE','OTHER','PREFER_NOT_TO_SAY')),
  province text CHECK (char_length(province) BETWEEN 2 AND 40),
  sample_month date NOT NULL CHECK (sample_month = date_trunc('month', sample_month)::date)
);
CREATE INDEX IF NOT EXISTS idx_demographic_samples_tenant ON analytics.demographic_samples (tenant_id);
ALTER TABLE analytics.demographic_samples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON analytics.demographic_samples FROM PUBLIC, anon, authenticated, service_role;

-- 5. Atomic invitation acceptance. The auth user already exists (created server-side).
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

-- 6. Client (buyer) signup: consent chosen at account creation. Nothing is stored when declined.
CREATE OR REPLACE FUNCTION core.record_signup_demographics(
  p_user_id uuid,
  p_consent boolean,
  p_tenant_id uuid,
  p_age_range text,
  p_gender text,
  p_province text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  -- Declined: leave the user row untouched and store no sample.
  IF COALESCE(p_consent, false) THEN
    UPDATE core.users
    SET demographic_consent_at = CASE WHEN NOT demographic_consent
                                      THEN pg_catalog.now() ELSE demographic_consent_at END,
        demographic_consent = true
    WHERE id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown user' USING ERRCODE = 'P0003';
    END IF;

    -- Unlinked sample: no user id, no email, month-truncated date only.
    INSERT INTO analytics.demographic_samples (tenant_id, age_range, gender, province, sample_month)
    VALUES (p_tenant_id, p_age_range, p_gender, p_province,
            pg_catalog.date_trunc('month', pg_catalog.now())::date);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION core.record_signup_demographics(uuid, boolean, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.record_signup_demographics(uuid, boolean, uuid, text, text, text)
  TO postgres;

COMMIT;
