-- This narrow helper is owned by the migration role, which must be able to read Auth.
-- A custom notification role cannot normally be granted USAGE on Supabase's auth schema.
DO $$
BEGIN
  IF NOT pg_catalog.has_schema_privilege(current_user, 'auth', 'USAGE')
    OR NOT pg_catalog.has_column_privilege(current_user, 'auth.users', 'id', 'SELECT')
    OR NOT pg_catalog.has_column_privilege(current_user, 'auth.users', 'email', 'SELECT')
    OR NOT pg_catalog.has_column_privilege(current_user, 'auth.users', 'email_confirmed_at', 'SELECT')
    OR NOT pg_catalog.has_column_privilege(current_user, 'auth.users', 'deleted_at', 'SELECT') THEN
    RAISE EXCEPTION 'Migration role cannot read the required auth.users columns' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION core.read_confirmed_auth_email(p_auth_id uuid)
RETURNS varchar
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized notification worker' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT u.email::varchar FROM auth.users u
    WHERE u.id = p_auth_id
      AND u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION core.read_confirmed_auth_email(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.read_confirmed_auth_email(uuid) TO notification_rpc_owner;

-- The existing function belongs to notification_rpc_owner. Replace it as that role
-- and preserve its ownership and existing tenant/order RLS policies.
GRANT SELECT (global_auth_id) ON sales.customers TO notification_rpc_owner;
GRANT notification_rpc_owner TO CURRENT_USER;
GRANT CREATE ON SCHEMA core TO notification_rpc_owner;
SET ROLE notification_rpc_owner;
CREATE OR REPLACE FUNCTION core.read_order_notification(p_tenant_id uuid, p_order_id uuid)
RETURNS TABLE (email varchar, order_number varchar, tenant_name varchar)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Unauthorized notification worker' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT core.read_confirmed_auth_email(c.global_auth_id), o.order_number, t.name
    FROM sales.orders o
    JOIN sales.customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
    JOIN core.tenants t ON t.id = o.tenant_id
    WHERE o.id = p_order_id AND o.tenant_id = p_tenant_id
      AND core.read_confirmed_auth_email(c.global_auth_id) IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION core.read_order_notification(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.read_order_notification(uuid, uuid) TO notification_worker_role;
RESET ROLE;
REVOKE CREATE ON SCHEMA core FROM notification_rpc_owner;
REVOKE notification_rpc_owner FROM CURRENT_USER;
