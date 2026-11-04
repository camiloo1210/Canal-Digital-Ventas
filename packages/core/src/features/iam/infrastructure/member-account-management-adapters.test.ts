import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { SupabaseAdminAuthAdapter } from '@/iam/infrastructure/adapters/supabase-admin-auth.adapter';
import { AdminAuthException } from '@/iam/application/exceptions/admin-auth.exception';
import { PostgresMembershipRepository } from '@/iam/infrastructure/postgres/postgres-membership.repository';
import { PostgresSessionRevocationAdapter } from '@/iam/infrastructure/postgres/postgres-session-revocation.adapter';
import { UserManagementRepositoryException } from '@/iam/application/exceptions/user-management-repository.exception';
import { PostgresUserProfileRepository } from '@/iam/infrastructure/postgres/postgres-user-profile.repository';
import {
  PostgresMemberDirectoryReadRepository,
  PostgresMemberPermissionsReadRepository,
} from '@/iam/infrastructure/postgres/postgres-user-management-read.repositories';

type Sql = postgres.Sql<Record<string, unknown>>;

function adminClient(error: { message: string } | null): {
  client: SupabaseClient;
  updateUserById: ReturnType<typeof vi.fn>;
} {
  const updateUserById = vi.fn().mockResolvedValue({ data: { user: {} }, error });
  return {
    updateUserById,
    client: { auth: { admin: { updateUserById } } } as unknown as SupabaseClient,
  };
}

describe('SupabaseAdminAuthAdapter account management', (): void => {
  it('creates a confirmed user without sending mail, tagged as managed by the tenant', async (): Promise<void> => {
    const createUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const client = { auth: { admin: { createUser } } } as unknown as SupabaseClient;
    const id = await new SupabaseAdminAuthAdapter(client).createConfirmedUser(
      'a@t.staff.invalid',
      'pw-123456',
      'tenant-1',
    );
    expect(id).toBe('u1');
    expect(createUser).toHaveBeenCalledWith({
      email: 'a@t.staff.invalid',
      password: 'pw-123456',
      email_confirm: true,
      app_metadata: { managed_by_tenant: 'tenant-1' },
    });
  });

  it('sets the password and never includes it in a thrown error', async (): Promise<void> => {
    const ok = adminClient(null);
    await new SupabaseAdminAuthAdapter(ok.client).setPassword('u1', 'secret-pass-1');
    expect(ok.updateUserById).toHaveBeenCalledWith('u1', { password: 'secret-pass-1' });

    const bad = adminClient({ message: 'boom' });
    const error = await new SupabaseAdminAuthAdapter(bad.client)
      .setPassword('u1', 'secret-pass-1')
      .catch((e: unknown): unknown => e);
    expect(error).toBeInstanceOf(AdminAuthException);
    expect((error as Error).message).not.toContain('secret-pass-1');
  });
});

function recordingTx(rows: unknown[]): { tx: TransactionContext; statements: string[] } {
  const statements: string[] = [];
  const connection = (strings: TemplateStringsArray): Promise<unknown[]> => {
    statements.push(strings.join('?'));
    return Promise.resolve(rows);
  };
  return {
    statements,
    tx: {
      executeNative: <C, R>(callback: (conn: C) => Promise<R>): Promise<R> =>
        callback(connection as unknown as C),
    },
  };
}

describe('PostgresMembershipRepository account management', (): void => {
  it('find returns the tenant that manages the account', async (): Promise<void> => {
    const { tx, statements } = recordingTx([
      { userId: 'u1', baseRole: 'MEMBER', status: 'active', accountManagedByTenantId: 't1' },
    ]);
    const record = await new PostgresMembershipRepository().find('t1', 'u1', tx);
    expect(record?.accountManagedByTenantId).toBe('t1');
    expect(statements[0]).toMatch(/managed_by_tenant_id/);
    expect(statements[0]).toMatch(/tenant_id\s*=\s*\?::uuid/);
  });

  it('remove only deletes a non owner membership of that tenant', async (): Promise<void> => {
    const { tx, statements } = recordingTx([]);
    await new PostgresMembershipRepository().remove('t1', 'u1', tx);
    expect(statements[0]).toMatch(/DELETE FROM core\.tenant_memberships/);
    expect(statements[0]).toMatch(/tenant_id\s*=\s*\?::uuid/);
    expect(statements[0]).toMatch(/role\s*<>\s*'OWNER'/);
  });

  it('setStatus only updates a non owner membership of that tenant', async (): Promise<void> => {
    const { tx, statements } = recordingTx([]);
    await new PostgresMembershipRepository().setStatus('t1', 'u1', 'suspended', tx);
    expect(statements[0]).toMatch(/UPDATE core\.tenant_memberships/);
    expect(statements[0]).toMatch(/role\s*<>\s*'OWNER'/);
  });

  it('countForUser counts memberships across tenants', async (): Promise<void> => {
    const { tx } = recordingTx([{ total: 2 }]);
    expect(await new PostgresMembershipRepository().countForUser('u1', tx)).toBe(2);
  });
});

describe('PostgresUserProfileRepository.rename', (): void => {
  it('updates names only, never email or consent', async (): Promise<void> => {
    const { tx, statements } = recordingTx([]);
    await new PostgresUserProfileRepository().rename('u1', 'Ana', 'Gomez', tx);
    expect(statements[0]).toMatch(/SET first_name/);
    expect(statements[0]).not.toMatch(/email|demographic_consent/);
  });
});

describe('PostgresMemberDirectoryReadRepository account kind', (): void => {
  it('derives accountKind and accessStatus from the row', async (): Promise<void> => {
    const rows = [
      row('a', 'OWNER', 'active', null),
      row('b', 'MEMBER', 'active', 't1'),
      row('c', 'MEMBER', 'suspended', 't1'),
      row('d', 'MEMBER', 'active', null),
    ];
    const sql = ((): Promise<unknown[]> => Promise.resolve(rows)) as unknown as Sql;
    const members = await new PostgresMemberDirectoryReadRepository(sql).listForOwner('a', 't1');
    expect(members.map((m): string => `${m.userId}:${m.accountKind}:${m.accessStatus}`)).toEqual([
      'a:PERSONAL:ACTIVE',
      'b:MANAGED:ACTIVE',
      'c:MANAGED:SUSPENDED',
      'd:PERSONAL:ACTIVE',
    ]);
  });
});

function row(
  id: string,
  baseRole: string,
  status: string,
  managedBy: string | null,
): Record<string, unknown> {
  return {
    user_id: id,
    first_name: 'N',
    last_name: 'L',
    email: `${id}@x.invalid`,
    base_role: baseRole,
    role_id: null,
    role_name: null,
    status,
    managed_by_tenant_id: managedBy,
    tenant_id: 't1',
  };
}

describe('session revocation for suspended or unlinked members', (): void => {
  it('effective permissions are only read from an active membership row', async (): Promise<void> => {
    const statements: string[] = [];
    const sql = ((strings: TemplateStringsArray): Promise<unknown[]> => {
      statements.push(strings.join('?'));
      return Promise.resolve([]);
    }) as unknown as Sql;
    const result = await new PostgresMemberPermissionsReadRepository(sql).findForUser('u', 't');
    expect(result).toBeNull();
    expect(statements[0]).toMatch(/m\.status\s*=\s*'active'/);
  });
});

describe('PostgresSessionRevocationAdapter', (): void => {
  it('calls only the narrow revoke function with the user id', async (): Promise<void> => {
    const calls: string[] = [];
    const sql = ((strings: TemplateStringsArray): Promise<unknown[]> => {
      calls.push(strings.join('?'));
      return Promise.resolve([]);
    }) as unknown as Sql;
    await new PostgresSessionRevocationAdapter(sql).revokeSessions('u1');
    expect(calls).toEqual(['SELECT core.revoke_user_sessions(?::uuid)']);
  });

  it('wraps vendor errors in a typed exception', async (): Promise<void> => {
    const sql = ((): Promise<unknown[]> => Promise.reject(new Error('boom'))) as unknown as Sql;
    await expect(
      new PostgresSessionRevocationAdapter(sql).revokeSessions('u1'),
    ).rejects.toBeInstanceOf(UserManagementRepositoryException);
  });
});
