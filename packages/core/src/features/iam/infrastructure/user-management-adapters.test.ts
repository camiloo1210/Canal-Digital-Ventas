import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { PostgresDemographicStatsReadRepository } from '@/iam/infrastructure/postgres/postgres-user-management-read.repositories';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { NodeCryptoTokenGenerator } from '@/iam/infrastructure/node-crypto-token.generator';
import { PostgresInvitationAcceptanceAdapter } from '@/iam/infrastructure/postgres/postgres-invitation-acceptance.adapter';
import { PostgresSignupDemographicsAdapter } from '@/iam/infrastructure/postgres/postgres-signup-demographics.adapter';
import { PostgresTenantRoleRepository } from '@/iam/infrastructure/postgres/postgres-tenant-role.repository';
import { TenantRole } from '@/iam/domain/entities/tenant-role.entity';
import { InvitationNotUsableException } from '@/iam/domain/exceptions/invitation-not-usable.exception';
import { BusinessAccountBoundException } from '@/iam/application/exceptions/business-account-bound.exception';
import { PostgresBusinessAccountReadRepository } from '@/iam/infrastructure/postgres/postgres-business-account-read.repository';
import { PostgresMembershipRepository } from '@/iam/infrastructure/postgres/postgres-membership.repository';
import { AlreadyMemberException } from '@/iam/application/exceptions/already-member.exception';
import { TenantRoleNameTakenException } from '@/iam/application/exceptions/tenant-role-name-taken.exception';
import { UserManagementRepositoryException } from '@/iam/application/exceptions/user-management-repository.exception';

type Sql = postgres.Sql<Record<string, unknown>>;

function failingTx(code: string): TransactionContext {
  const connection = (): Promise<never> => Promise.reject(Object.assign(new Error('pg'), { code }));
  return {
    executeNative: <C, R>(callback: (conn: C) => Promise<R>): Promise<R> =>
      callback(connection as unknown as C),
  };
}

function rowsTx(rows: unknown[]): TransactionContext {
  const connection = (): Promise<unknown[]> => Promise.resolve(rows);
  return {
    executeNative: <C, R>(callback: (conn: C) => Promise<R>): Promise<R> =>
      callback(connection as unknown as C),
  };
}

const command = {
  tokenHash: 'a'.repeat(64),
  userId: '11111111-1111-4111-8111-111111111111',
  consent: false,
  ageRange: null,
  gender: null,
  province: null,
  firstName: null,
  lastName: null,
};

describe('NodeCryptoTokenGenerator', () => {
  const gen = new NodeCryptoTokenGenerator();

  it('generates unguessable url-safe tokens of 256 bits', () => {
    const a = gen.generate();
    const b = gen.generate();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes to deterministic SHA-256 hex that is not the token', () => {
    const token = gen.generate();
    expect(gen.hash(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(gen.hash(token)).toBe(gen.hash(token));
    expect(gen.hash(token)).not.toContain(token);
    expect(gen.hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('PostgresInvitationAcceptanceAdapter', () => {
  const adapter = new PostgresInvitationAcceptanceAdapter();

  it('maps RPC error codes to typed exceptions', async () => {
    await expect(adapter.accept(command, failingTx('P0001'))).rejects.toBeInstanceOf(
      InvitationNotUsableException,
    );
    await expect(adapter.accept(command, failingTx('P0002'))).rejects.toBeInstanceOf(
      AlreadyMemberException,
    );
    await expect(adapter.accept(command, failingTx('P0004'))).rejects.toBeInstanceOf(
      BusinessAccountBoundException,
    );
    await expect(adapter.accept(command, failingTx('08006'))).rejects.toBeInstanceOf(
      UserManagementRepositoryException,
    );
  });

  it('returns the tenant and role of the accepted invitation', async () => {
    await expect(
      adapter.accept(command, rowsTx([{ tenant_id: 't', role_id: 'r' }])),
    ).resolves.toEqual({ tenantId: 't', roleId: 'r' });
  });
});

describe('PostgresTenantRoleRepository', () => {
  it('maps a unique violation to TenantRoleNameTakenException', async () => {
    const role = TenantRole.create({
      id: 'r',
      tenantId: 't',
      name: 'Cajero',
      permissions: ['VIEW_ORDERS'],
    });
    await expect(
      new PostgresTenantRoleRepository().save(role, failingTx('23505')),
    ).rejects.toBeInstanceOf(TenantRoleNameTakenException);
    await expect(
      new PostgresTenantRoleRepository().save(role, failingTx('08006')),
    ).rejects.toBeInstanceOf(UserManagementRepositoryException);
  });
});

describe('PostgresDemographicStatsReadRepository', () => {
  const rows = [
    { dimension: 'ageRange', value: '25_34', total: 12 },
    { dimension: 'gender', value: 'FEMALE', total: 12 },
  ];

  function fakeSql(totalSamples: number): Sql {
    const query = (strings: TemplateStringsArray): Promise<unknown[]> =>
      Promise.resolve(strings.join('?').includes('GROUP BY') ? rows : [{ total: totalSamples }]);
    return query as unknown as Sql;
  }

  it('hides every dimension while the tenant has fewer than 20 samples', async () => {
    const stats = await new PostgresDemographicStatsReadRepository(fakeSql(19)).findForOwner(
      'u',
      't',
    );
    for (const dimension of [stats.ageRange, stats.gender, stats.province]) {
      expect(dimension).toEqual({ buckets: [], hasSuppressed: true });
    }
  });

  it('shows buckets of at least 5 once the tenant reaches 20 samples', async () => {
    const stats = await new PostgresDemographicStatsReadRepository(fakeSql(20)).findForOwner(
      'u',
      't',
    );
    expect(stats.ageRange.buckets).toEqual([{ value: '25_34', count: 12 }]);
  });
});

describe('PostgresSignupDemographicsAdapter', () => {
  const adapter = new PostgresSignupDemographicsAdapter();
  const signup = {
    userId: '11111111-1111-4111-8111-111111111111',
    consent: true,
    ageRange: null,
    gender: null,
    province: null,
    tenantId: null,
  };

  it('wraps vendor failures in a typed repository exception', async () => {
    await expect(adapter.record(signup, failingTx('08006'))).rejects.toBeInstanceOf(
      UserManagementRepositoryException,
    );
  });

  it('resolves when the RPC succeeds', async () => {
    await expect(adapter.record(signup, rowsTx([]))).resolves.toBeUndefined();
  });
});

describe('business account single tenant rule (P0004)', () => {
  it('maps the trigger error of a membership write to BusinessAccountBoundException', async () => {
    await expect(
      new PostgresMembershipRepository().setStatus('t', 'u', 'active', failingTx('P0004')),
    ).rejects.toBeInstanceOf(BusinessAccountBoundException);
    await expect(
      new PostgresMembershipRepository().setStatus('t', 'u', 'active', failingTx('08006')),
    ).rejects.toBeInstanceOf(UserManagementRepositoryException);
  });

  it('reads whether an account is bound to another tenant', async () => {
    const sqlReturning = (rows: unknown[]): Sql => (() => Promise.resolve(rows)) as unknown as Sql;
    const failing = ((): Promise<never> => Promise.reject(new Error('pg'))) as unknown as Sql;
    await expect(
      new PostgresBusinessAccountReadRepository(
        sqlReturning([{ bound: true }]),
      ).isBoundToOtherTenant('u', 't'),
    ).resolves.toBe(true);
    await expect(
      new PostgresBusinessAccountReadRepository(
        sqlReturning([{ bound: false }]),
      ).isBoundToOtherTenant('u', 't'),
    ).resolves.toBe(false);
    await expect(
      new PostgresBusinessAccountReadRepository(sqlReturning([{ bound: true }])).isBusinessAccount(
        'u',
      ),
    ).resolves.toBe(true);
    await expect(
      new PostgresBusinessAccountReadRepository(failing).isBusinessAccount('u'),
    ).rejects.toBeInstanceOf(UserManagementRepositoryException);
  });
});
