-- One database-side rule for "may this member do X in this store".
--
-- PROBLEM: the dashboard pages authorise by granular permission (custom roles), but the read and
-- write SQL still demanded role IN ('OWNER','ADMIN'). A MEMBER holding VIEW_REPORTS (or any other
-- custom-role permission) passed the page guard and then received an empty/denied result.
--
-- core.member_has_permission(user, tenant, permissions[]) is TRUE when the user is an ACTIVE member of
-- the tenant AND is OWNER or ADMIN (ADMIN holds every permission, mirroring resolveEffectivePermissions)
-- OR holds, through its custom role of THAT tenant, at least one of the listed permissions.
-- An empty list means "any active member".
--
-- Integrations (Kivi) are NOT delegable: they stay OWNER only and MANAGE_INTEGRATIONS no longer exists
-- as a permission. Roles that still store that value are harmless: it is ignored when resolving.
--
-- Called only by the server's postgres login, like the other helpers in this series.
BEGIN;

CREATE OR REPLACE FUNCTION core.member_has_permission(
  p_user_id uuid,
  p_tenant_id uuid,
  p_permissions text[]
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM core.tenant_memberships m
    LEFT JOIN core.tenant_roles r
      ON r.id = m.custom_role_id AND r.tenant_id = m.tenant_id
    WHERE m.user_id = p_user_id
      AND m.tenant_id = p_tenant_id
      AND m.status = 'active'
      AND (
        m.role IN ('OWNER', 'ADMIN')
        OR cardinality(coalesce(p_permissions, ARRAY[]::text[])) = 0
        OR r.permissions && p_permissions
      )
  );
$$;
ALTER FUNCTION core.member_has_permission(uuid, uuid, text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION core.member_has_permission(uuid, uuid, text[])
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.member_has_permission(uuid, uuid, text[]) TO postgres;

COMMIT;
