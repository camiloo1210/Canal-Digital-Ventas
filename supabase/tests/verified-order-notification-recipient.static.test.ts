import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('verified order notification recipient migration', (): void => {
  it('only returns a confirmed account email for the order buyer through the restricted worker', (): void => {
    const sql = readFileSync(
      resolve('supabase/migrations/20261108191000_verified_order_notification_recipient.sql'),
      'utf8',
    );
    expect(sql).toContain('core.read_confirmed_auth_email(c.global_auth_id)');
    expect(sql).toContain('u.id = p_auth_id');
    expect(sql).toContain('GRANT notification_rpc_owner TO CURRENT_USER');
    expect(sql).toContain('SET ROLE notification_rpc_owner');
    expect(sql).toContain('RESET ROLE');
    expect(sql).toContain('REVOKE notification_rpc_owner FROM CURRENT_USER');
    expect(sql).toContain(
      'GRANT SELECT (global_auth_id) ON sales.customers TO notification_rpc_owner',
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION core.read_confirmed_auth_email(uuid) TO notification_rpc_owner',
    );
    expect(sql).not.toContain('OWNER TO postgres');
    expect(sql).toContain('u.email_confirmed_at IS NOT NULL');
    expect(sql).toContain('u.deleted_at IS NULL');
    expect(sql).toContain(
      "pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER')",
    );
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION core.read_order_notification(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role',
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION core.read_order_notification(uuid, uuid) TO notification_worker_role',
    );
  });
});
