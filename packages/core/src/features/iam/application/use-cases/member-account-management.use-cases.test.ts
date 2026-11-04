import { describe, expect, it, vi } from 'vitest';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type {
  MemberRecord,
  MembershipRepositoryPort,
} from '@/iam/application/ports/out/membership-repository.port';
import type { UserProfileRepositoryPort } from '@/iam/application/ports/out/user-profile-repository.port';
import type { SessionRevocationPort } from '@/iam/application/ports/out/session-revocation.port';
import type { AdminAuthPort } from '@/iam/application/ports/out/admin-auth.port';
import { UnlinkMemberUseCase } from '@/iam/application/use-cases/unlink-member.use-case';
import { SetMemberActiveUseCase } from '@/iam/application/use-cases/set-member-active.use-case';
import { ResetManagedAccountPasswordUseCase } from '@/iam/application/use-cases/reset-managed-account-password.use-case';
import { RenameManagedAccountUseCase } from '@/iam/application/use-cases/rename-managed-account.use-case';
import { UserManagementForbiddenException } from '@/iam/application/exceptions/user-management-forbidden.exception';
import { MemberNotFoundException } from '@/iam/application/exceptions/member-not-found.exception';
import { ProtectedMemberException } from '@/iam/application/exceptions/protected-member.exception';
import { PersonalAccountProtectedException } from '@/iam/application/exceptions/personal-account-protected.exception';
import { AdminAuthUnavailableException } from '@/iam/application/exceptions/admin-auth-unavailable.exception';
import { InvalidManagedPasswordException } from '@/iam/domain/exceptions/invalid-managed-password.exception';
import { InvalidPersonNameException } from '@/shared/domain/exceptions/invalid-person-name.exception';

const OWNER = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const TENANT = '33333333-3333-4333-8333-333333333333';
const OTHER_TENANT = '44444444-4444-4444-8444-444444444444';
const TX: TransactionContext = {
  executeNative: <C, R>(callback: (conn: C) => Promise<R>): Promise<R> =>
    callback({} as unknown as C),
};

function transactions(): TransactionManagerPort {
  return {
    runInTransaction: <T>(operation: (tx: TransactionContext) => Promise<T>): Promise<T> =>
      operation(TX),
  };
}

function ownership(isOwner: boolean): TenantOwnershipPort {
  return { isStoreOwner: vi.fn().mockResolvedValue(isOwner) };
}

const managed: MemberRecord = {
  userId: MEMBER,
  baseRole: 'MEMBER',
  status: 'active',
  accountManagedByTenantId: TENANT,
};
const personal: MemberRecord = { ...managed, accountManagedByTenantId: null };
const managedByOther: MemberRecord = { ...managed, accountManagedByTenantId: OTHER_TENANT };
const ownerRecord: MemberRecord = { ...managed, userId: OWNER, baseRole: 'OWNER' };

function members(record: MemberRecord | null, remaining: number = 0): MembershipRepositoryPort {
  return {
    find: vi.fn().mockResolvedValue(record),
    assignCustomRole: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    setStatus: vi.fn().mockResolvedValue(undefined),
    countForUser: vi.fn().mockResolvedValue(remaining),
  };
}

function admin(): AdminAuthPort {
  return {
    setTenantClaim: vi.fn(),
    createConfirmedUser: vi.fn(),
    deleteUser: vi.fn(),
    setPassword: vi.fn().mockResolvedValue(undefined),
  };
}

function profiles(): UserProfileRepositoryPort {
  return { update: vi.fn(), rename: vi.fn().mockResolvedValue(undefined) };
}

const dto = { userId: OWNER, tenantId: TENANT, memberUserId: MEMBER };

describe('UnlinkMemberUseCase', (): void => {
  it('removes a personal account membership and reports it as personal', async (): Promise<void> => {
    const repo = members(personal);
    const result = await new UnlinkMemberUseCase(repo, ownership(true), transactions()).execute(
      dto,
    );
    expect(repo.remove).toHaveBeenCalledWith(TENANT, MEMBER, TX);
    expect(result).toEqual({ accountKind: 'PERSONAL' });
  });

  it('removes a managed account membership; the database trigger cuts the auth access', async (): Promise<void> => {
    const repo = members(managed);
    const result = await new UnlinkMemberUseCase(repo, ownership(true), transactions()).execute(
      dto,
    );
    expect(repo.remove).toHaveBeenCalledWith(TENANT, MEMBER, TX);
    expect(repo.countForUser).not.toHaveBeenCalled();
    expect(result).toEqual({ accountKind: 'MANAGED' });
  });

  it('treats an account managed by another tenant as personal for this tenant', async (): Promise<void> => {
    const result = await new UnlinkMemberUseCase(
      members(managedByOther),
      ownership(true),
      transactions(),
    ).execute(dto);
    expect(result.accountKind).toBe('PERSONAL');
  });

  it('rejects a non owner before reading the member', async (): Promise<void> => {
    const repo = members(managed);
    await expect(
      new UnlinkMemberUseCase(repo, ownership(false), transactions()).execute(dto),
    ).rejects.toBeInstanceOf(UserManagementForbiddenException);
    expect(repo.find).not.toHaveBeenCalled();
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('rejects a member of another tenant (not found) and the owner (protected)', async (): Promise<void> => {
    await expect(
      new UnlinkMemberUseCase(members(null), ownership(true), transactions()).execute(dto),
    ).rejects.toBeInstanceOf(MemberNotFoundException);
    const repo = members(ownerRecord);
    await expect(
      new UnlinkMemberUseCase(repo, ownership(true), transactions()).execute({
        ...dto,
        memberUserId: OWNER,
      }),
    ).rejects.toBeInstanceOf(ProtectedMemberException);
    expect(repo.remove).not.toHaveBeenCalled();
  });
});

describe('SetMemberActiveUseCase', (): void => {
  it('suspends a managed account by updating only the membership status', async (): Promise<void> => {
    const repo = members(managed);
    await new SetMemberActiveUseCase(repo, ownership(true), transactions()).execute({
      ...dto,
      active: false,
    });
    expect(repo.setStatus).toHaveBeenCalledWith(TENANT, MEMBER, 'suspended', TX);
  });

  it('reactivates a managed account by updating only the membership status', async (): Promise<void> => {
    const repo = members({ ...managed, status: 'suspended' });
    await new SetMemberActiveUseCase(repo, ownership(true), transactions()).execute({
      ...dto,
      active: true,
    });
    expect(repo.setStatus).toHaveBeenCalledWith(TENANT, MEMBER, 'active', TX);
  });

  it('refuses personal accounts and accounts managed by another tenant', async (): Promise<void> => {
    for (const record of [personal, managedByOther]) {
      const repo = members(record);
      await expect(
        new SetMemberActiveUseCase(repo, ownership(true), transactions()).execute({
          ...dto,
          active: false,
        }),
      ).rejects.toBeInstanceOf(PersonalAccountProtectedException);
      expect(repo.setStatus).not.toHaveBeenCalled();
    }
  });

  it('is owner-only and protects the owner row', async (): Promise<void> => {
    await expect(
      new SetMemberActiveUseCase(members(managed), ownership(false), transactions()).execute({
        ...dto,
        active: false,
      }),
    ).rejects.toBeInstanceOf(UserManagementForbiddenException);
    await expect(
      new SetMemberActiveUseCase(members(ownerRecord), ownership(true), transactions()).execute({
        ...dto,
        active: false,
      }),
    ).rejects.toBeInstanceOf(ProtectedMemberException);
    await expect(
      new SetMemberActiveUseCase(members(null), ownership(true), transactions()).execute({
        ...dto,
        active: false,
      }),
    ).rejects.toBeInstanceOf(MemberNotFoundException);
  });
});

describe('ResetManagedAccountPasswordUseCase', (): void => {
  const reset = { ...dto, newPassword: 'longenough1' };
  const sessions = (fail: boolean = false): SessionRevocationPort => ({
    revokeSessions: fail
      ? vi.fn().mockRejectedValue(new Error('db down'))
      : vi.fn().mockResolvedValue(undefined),
  });
  const build = (
    record: MemberRecord | null,
    owner: boolean,
    auth: AdminAuthPort | null,
    revoke: SessionRevocationPort = sessions(),
    manager: TransactionManagerPort = transactions(),
  ): ResetManagedAccountPasswordUseCase =>
    new ResetManagedAccountPasswordUseCase(
      members(record),
      ownership(owner),
      auth,
      manager,
      revoke,
    );

  it('sets the password then revokes the sessions of a managed account', async (): Promise<void> => {
    const auth = admin();
    const revoke = sessions();
    const result = await build(managed, true, auth, revoke).execute(reset);
    expect(result).toEqual({ passwordChanged: true, sessionsRevoked: true });
    expect(auth.setPassword).toHaveBeenCalledWith(MEMBER, 'longenough1');
    expect(revoke.revokeSessions).toHaveBeenCalledWith(MEMBER);
  });

  it('never calls the auth provider or revokes sessions inside the transaction', async (): Promise<void> => {
    const auth = admin();
    const revoke = sessions();
    let open = false;
    const seen: boolean[] = [];
    vi.mocked(auth.setPassword).mockImplementation(async (): Promise<void> => {
      seen.push(open);
    });
    vi.mocked(revoke.revokeSessions).mockImplementation(async (): Promise<void> => {
      seen.push(open);
    });
    const manager: TransactionManagerPort = {
      runInTransaction: async <T>(
        operation: (tx: TransactionContext) => Promise<T>,
      ): Promise<T> => {
        open = true;
        try {
          return await operation(TX);
        } finally {
          open = false;
        }
      },
    };
    await build(managed, true, auth, revoke, manager).execute(reset);
    expect(seen).toEqual([false, false]);
  });

  it('reports sessionsRevoked=false when only the revocation fails', async (): Promise<void> => {
    const auth = admin();
    const result = await build(managed, true, auth, sessions(true)).execute(reset);
    expect(result).toEqual({ passwordChanged: true, sessionsRevoked: false });
    expect(auth.setPassword).toHaveBeenCalled();
  });

  it('changes nothing and revokes nothing when the password change fails', async (): Promise<void> => {
    const auth = admin();
    vi.mocked(auth.setPassword).mockRejectedValue(new Error('auth down'));
    const revoke = sessions();
    await expect(build(managed, true, auth, revoke).execute(reset)).rejects.toThrow('auth down');
    expect(revoke.revokeSessions).not.toHaveBeenCalled();
  });

  it('requires the admin port', async (): Promise<void> => {
    await expect(build(managed, true, null).execute(reset)).rejects.toBeInstanceOf(
      AdminAuthUnavailableException,
    );
  });

  it('rejects short passwords without calling auth, and never leaks the password in the error', async (): Promise<void> => {
    const auth = admin();
    const revoke = sessions();
    const error = await build(managed, true, auth, revoke)
      .execute({ ...dto, newPassword: 'short' })
      .catch((e: unknown): unknown => e);
    expect(error).toBeInstanceOf(InvalidManagedPasswordException);
    expect((error as Error).message).not.toContain('short');
    expect(auth.setPassword).not.toHaveBeenCalled();
    expect(revoke.revokeSessions).not.toHaveBeenCalled();
  });

  it('refuses personal accounts, owners and non owners', async (): Promise<void> => {
    const auth = admin();
    const revoke = sessions();
    await expect(build(personal, true, auth, revoke).execute(reset)).rejects.toBeInstanceOf(
      PersonalAccountProtectedException,
    );
    await expect(build(ownerRecord, true, auth, revoke).execute(reset)).rejects.toBeInstanceOf(
      ProtectedMemberException,
    );
    await expect(build(managed, false, auth, revoke).execute(reset)).rejects.toBeInstanceOf(
      UserManagementForbiddenException,
    );
    expect(auth.setPassword).not.toHaveBeenCalled();
    expect(revoke.revokeSessions).not.toHaveBeenCalled();
  });
});

describe('RenameManagedAccountUseCase', (): void => {
  const rename = { ...dto, firstName: 'Ana', lastName: 'Gomez' };

  it('renames a managed account', async (): Promise<void> => {
    const repo = profiles();
    await new RenameManagedAccountUseCase(
      members(managed),
      repo,
      ownership(true),
      transactions(),
    ).execute(rename);
    expect(repo.rename).toHaveBeenCalledWith(MEMBER, 'Ana', 'Gomez', TX);
  });

  it('refuses personal accounts and invalid names', async (): Promise<void> => {
    const repo = profiles();
    await expect(
      new RenameManagedAccountUseCase(
        members(personal),
        repo,
        ownership(true),
        transactions(),
      ).execute(rename),
    ).rejects.toBeInstanceOf(PersonalAccountProtectedException);
    await expect(
      new RenameManagedAccountUseCase(
        members(managed),
        repo,
        ownership(true),
        transactions(),
      ).execute({ ...rename, firstName: '<b>' }),
    ).rejects.toBeInstanceOf(InvalidPersonNameException);
    await expect(
      new RenameManagedAccountUseCase(
        members(managed),
        repo,
        ownership(false),
        transactions(),
      ).execute(rename),
    ).rejects.toBeInstanceOf(UserManagementForbiddenException);
    expect(repo.rename).not.toHaveBeenCalled();
  });
});
