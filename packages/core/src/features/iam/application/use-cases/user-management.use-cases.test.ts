import { describe, expect, it, vi } from 'vitest';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type { TenantRoleRepositoryPort } from '@/iam/application/ports/out/tenant-role-repository.port';
import type { InvitationRepositoryPort } from '@/iam/application/ports/out/invitation-repository.port';
import type {
  MemberRecord,
  MembershipRepositoryPort,
} from '@/iam/application/ports/out/membership-repository.port';
import type { UserProfileRepositoryPort } from '@/iam/application/ports/out/user-profile-repository.port';
import type { InvitationAcceptancePort } from '@/iam/application/ports/out/invitation-acceptance.port';
import type { InvitationPreviewReadPort } from '@/iam/application/ports/out/invitation-preview-read.port';
import type { TokenGeneratorPort } from '@/iam/application/ports/out/token-generator.port';
import { TenantRole } from '@/iam/domain/entities/tenant-role.entity';
import { Invitation } from '@/iam/domain/entities/invitation.entity';
import { CreateTenantRoleUseCase } from '@/iam/application/use-cases/create-tenant-role.use-case';
import { UpdateTenantRoleUseCase } from '@/iam/application/use-cases/update-tenant-role.use-case';
import { DeleteTenantRoleUseCase } from '@/iam/application/use-cases/delete-tenant-role.use-case';
import { CreateInvitationUseCase } from '@/iam/application/use-cases/create-invitation.use-case';
import { RevokeInvitationUseCase } from '@/iam/application/use-cases/revoke-invitation.use-case';
import { AcceptInvitationUseCase } from '@/iam/application/use-cases/accept-invitation.use-case';
import { AssignMemberRoleUseCase } from '@/iam/application/use-cases/assign-member-role.use-case';
import { UpdateOwnProfileUseCase } from '@/iam/application/use-cases/update-own-profile.use-case';
import { GetInvitationPreviewUseCase } from '@/iam/application/use-cases/get-invitation-preview.use-case';
import { UserManagementForbiddenException } from '@/iam/application/exceptions/user-management-forbidden.exception';
import { TenantRoleNotFoundException } from '@/iam/application/exceptions/tenant-role-not-found.exception';
import { TenantRoleNameTakenException } from '@/iam/application/exceptions/tenant-role-name-taken.exception';
import { TenantRoleInUseException } from '@/iam/application/exceptions/tenant-role-in-use.exception';
import { InvitationNotFoundException } from '@/iam/application/exceptions/invitation-not-found.exception';
import { BusinessAccountBoundException } from '@/iam/application/exceptions/business-account-bound.exception';
import { MemberNotFoundException } from '@/iam/application/exceptions/member-not-found.exception';
import { MemberNotActiveException } from '@/iam/application/exceptions/member-not-active.exception';
import { ProtectedMemberException } from '@/iam/application/exceptions/protected-member.exception';
import { InvalidTenantRoleException } from '@/iam/domain/exceptions/invalid-tenant-role.exception';
import { InvalidDemographicBucketException } from '@/iam/domain/exceptions/invalid-demographic-bucket.exception';
import { InvalidInvitationException } from '@/iam/domain/exceptions/invalid-invitation.exception';
import { InvalidPersonNameException } from '@/shared/domain/exceptions/invalid-person-name.exception';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const TENANT = '33333333-3333-4333-8333-333333333333';
const ROLE = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-11-03T10:00:00Z');
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

function roleRepo(initial: TenantRole[] = [], members: number = 0): TenantRoleRepositoryPort {
  const store = new Map<string, TenantRole>(
    initial.map((r): [string, TenantRole] => [r.getId(), r]),
  );
  return {
    findById: vi.fn((id: string, tenantId: string): Promise<TenantRole | null> =>
      Promise.resolve(
        store.get(id) && store.get(id)!.getTenantId() === tenantId ? store.get(id)! : null,
      ),
    ),
    nameExists: vi.fn((tenantId: string, name: string, exclude: string | null): Promise<boolean> =>
      Promise.resolve(
        [...store.values()].some(
          (r): boolean =>
            r.getTenantId() === tenantId &&
            r.getId() !== exclude &&
            r.getName().toLowerCase() === name.trim().toLowerCase(),
        ),
      ),
    ),
    save: vi.fn((role: TenantRole): Promise<void> => {
      store.set(role.getId(), role);
      return Promise.resolve();
    }),
    delete: vi.fn((id: string): Promise<void> => {
      store.delete(id);
      return Promise.resolve();
    }),
    countMembers: vi.fn().mockResolvedValue(members),
  };
}

function existingRole(name: string = 'Cajero'): TenantRole {
  return TenantRole.create({ id: ROLE, tenantId: TENANT, name, permissions: ['VIEW_ORDERS'] });
}

const tokens: TokenGeneratorPort = {
  generate: (): string => 'raw-secret-token',
  hash: (raw: string): string => (raw === 'raw-secret-token' ? 'b'.repeat(64) : 'c'.repeat(64)),
};

describe('CreateTenantRoleUseCase', () => {
  const dto = { userId: OWNER, tenantId: TENANT, name: 'Cajero', permissions: ['VIEW_ORDERS'] };

  it('creates a role for the owner', async () => {
    const roles = roleRepo();
    const result = await new CreateTenantRoleUseCase(
      roles,
      ownership(true),
      transactions(),
      (): string => ROLE,
    ).execute(dto);
    expect(result).toEqual({ roleId: ROLE });
    expect(roles.save).toHaveBeenCalledTimes(1);
  });

  it('refuses non-owners without touching the repository', async () => {
    const roles = roleRepo();
    await expect(
      new CreateTenantRoleUseCase(roles, ownership(false), transactions()).execute(dto),
    ).rejects.toBeInstanceOf(UserManagementForbiddenException);
    expect(roles.save).not.toHaveBeenCalled();
  });

  it('rejects duplicate names and invalid input', async () => {
    const roles = roleRepo([existingRole('cajero')]);
    const uc = new CreateTenantRoleUseCase(roles, ownership(true), transactions());
    await expect(uc.execute(dto)).rejects.toBeInstanceOf(TenantRoleNameTakenException);
    await expect(uc.execute({ ...dto, name: 'Nuevo', permissions: [] })).rejects.toBeInstanceOf(
      InvalidTenantRoleException,
    );
  });
});

describe('UpdateTenantRoleUseCase', () => {
  const dto = {
    userId: OWNER,
    tenantId: TENANT,
    roleId: ROLE,
    name: 'Bodega',
    permissions: ['MANAGE_CATALOG'],
  };

  it('updates name and permissions', async () => {
    const roles = roleRepo([existingRole()]);
    await new UpdateTenantRoleUseCase(roles, ownership(true), transactions()).execute(dto);
    const saved = (roles.save as ReturnType<typeof vi.fn>).mock.calls[0]![0] as TenantRole;
    expect(saved.getName()).toBe('Bodega');
    expect(saved.getPermissions()).toEqual(['MANAGE_CATALOG']);
  });

  it('keeps its own name without a duplicate error', async () => {
    const roles = roleRepo([existingRole()]);
    await expect(
      new UpdateTenantRoleUseCase(roles, ownership(true), transactions()).execute({
        ...dto,
        name: 'Cajero',
      }),
    ).resolves.toBeUndefined();
  });

  it('fails for non-owner, unknown role (other tenant) and taken name', async () => {
    const roles = roleRepo([existingRole()]);
    await expect(
      new UpdateTenantRoleUseCase(roles, ownership(false), transactions()).execute(dto),
    ).rejects.toBeInstanceOf(UserManagementForbiddenException);
    await expect(
      new UpdateTenantRoleUseCase(roles, ownership(true), transactions()).execute({
        ...dto,
        tenantId: OTHER,
      }),
    ).rejects.toBeInstanceOf(TenantRoleNotFoundException);
    const two = roleRepo([
      existingRole(),
      TenantRole.create({
        id: OTHER,
        tenantId: TENANT,
        name: 'Bodega',
        permissions: ['VIEW_CATALOG'],
      }),
    ]);
    await expect(
      new UpdateTenantRoleUseCase(two, ownership(true), transactions()).execute(dto),
    ).rejects.toBeInstanceOf(TenantRoleNameTakenException);
  });
});

describe('DeleteTenantRoleUseCase', () => {
  const dto = { userId: OWNER, tenantId: TENANT, roleId: ROLE };

  it('deletes an unused role', async () => {
    const roles = roleRepo([existingRole()]);
    await new DeleteTenantRoleUseCase(roles, ownership(true), transactions()).execute(dto);
    expect(roles.delete).toHaveBeenCalledWith(ROLE, TENANT, TX);
  });

  it('blocks deletion while members are assigned', async () => {
    const roles = roleRepo([existingRole()], 2);
    await expect(
      new DeleteTenantRoleUseCase(roles, ownership(true), transactions()).execute(dto),
    ).rejects.toBeInstanceOf(TenantRoleInUseException);
    expect(roles.delete).not.toHaveBeenCalled();
  });

  it('refuses non-owners and unknown roles', async () => {
    await expect(
      new DeleteTenantRoleUseCase(
        roleRepo([existingRole()]),
        ownership(false),
        transactions(),
      ).execute(dto),
    ).rejects.toBeInstanceOf(UserManagementForbiddenException);
    await expect(
      new DeleteTenantRoleUseCase(roleRepo(), ownership(true), transactions()).execute(dto),
    ).rejects.toBeInstanceOf(TenantRoleNotFoundException);
  });
});

function invitationRepo(initial: Invitation[] = []): InvitationRepositoryPort & {
  saved: Invitation[];
} {
  const saved: Invitation[] = [];
  return {
    saved,
    findById: vi.fn((id: string, tenantId: string): Promise<Invitation | null> =>
      Promise.resolve(
        initial.find((i): boolean => i.getId() === id && i.getTenantId() === tenantId) ?? null,
      ),
    ),
    save: vi.fn((inv: Invitation): Promise<void> => {
      saved.push(inv);
      return Promise.resolve();
    }),
  };
}

describe('CreateInvitationUseCase', () => {
  const dto = { userId: OWNER, tenantId: TENANT, roleId: ROLE };
  const make = (
    invites: InvitationRepositoryPort,
    roles: TenantRoleRepositoryPort,
    owner: boolean = true,
  ): CreateInvitationUseCase =>
    new CreateInvitationUseCase(
      invites,
      roles,
      ownership(owner),
      transactions(),
      tokens,
      (): string => 'inv-1',
      (): Date => NOW,
    );

  it('returns the raw token once and persists only its hash', async () => {
    const invites = invitationRepo();
    const result = await make(invites, roleRepo([existingRole()])).execute({
      ...dto,
      expiresInDays: 3,
      maxUses: 5,
    });
    expect(result.token).toBe('raw-secret-token');
    expect(result.invitationId).toBe('inv-1');
    expect(result.expiresAt).toBe(new Date(NOW.getTime() + 3 * 86400000).toISOString());
    const snap = invites.saved[0]!.toSnapshot();
    expect(snap.tokenHash).toBe('b'.repeat(64));
    expect(JSON.stringify(snap)).not.toContain('raw-secret-token');
    expect(snap.maxUses).toBe(5);
  });

  it('stores the owner-chosen account mode and defaults to a generated email', async () => {
    const invites = invitationRepo();
    await make(invites, roleRepo([existingRole()])).execute({ ...dto, accountMode: 'GOOGLE' });
    expect(invites.saved[0]!.toSnapshot().accountMode).toBe('GOOGLE');
    const defaults = invitationRepo();
    await make(defaults, roleRepo([existingRole()])).execute(dto);
    expect(defaults.saved[0]!.toSnapshot().accountMode).toBe('GENERATED_EMAIL');
    await expect(
      make(invitationRepo(), roleRepo([existingRole()])).execute({
        ...dto,
        accountMode: 'SMS' as never,
      }),
    ).rejects.toBeInstanceOf(InvalidInvitationException);
  });

  it('refuses non-owners, foreign roles and out-of-range options', async () => {
    await expect(
      make(invitationRepo(), roleRepo([existingRole()]), false).execute(dto),
    ).rejects.toBeInstanceOf(UserManagementForbiddenException);
    await expect(make(invitationRepo(), roleRepo()).execute(dto)).rejects.toBeInstanceOf(
      TenantRoleNotFoundException,
    );
    await expect(
      make(invitationRepo(), roleRepo([existingRole()])).execute({ ...dto, expiresInDays: 31 }),
    ).rejects.toBeInstanceOf(InvalidInvitationException);
  });
});

describe('RevokeInvitationUseCase', () => {
  const inv = (): Invitation =>
    Invitation.create({
      id: 'inv-1',
      tenantId: TENANT,
      roleId: ROLE,
      tokenHash: 'b'.repeat(64),
      createdBy: OWNER,
      now: NOW,
    });

  it('revokes for the owner', async () => {
    const invites = invitationRepo([inv()]);
    await new RevokeInvitationUseCase(
      invites,
      ownership(true),
      transactions(),
      (): Date => NOW,
    ).execute({
      userId: OWNER,
      tenantId: TENANT,
      invitationId: 'inv-1',
    });
    expect(invites.saved[0]!.toSnapshot().revokedAt).toEqual(NOW);
  });

  it('refuses non-owners and invitations of other tenants', async () => {
    const invites = invitationRepo([inv()]);
    const dto = { userId: OWNER, tenantId: TENANT, invitationId: 'inv-1' };
    await expect(
      new RevokeInvitationUseCase(invites, ownership(false), transactions()).execute(dto),
    ).rejects.toBeInstanceOf(UserManagementForbiddenException);
    await expect(
      new RevokeInvitationUseCase(invites, ownership(true), transactions()).execute({
        ...dto,
        tenantId: OTHER,
      }),
    ).rejects.toBeInstanceOf(InvitationNotFoundException);
  });
});

describe('AcceptInvitationUseCase', () => {
  const acceptance = (): InvitationAcceptancePort => ({
    accept: vi.fn().mockResolvedValue({ tenantId: TENANT, roleId: ROLE }),
  });
  const base = {
    token: 'raw-secret-token',
    userId: OTHER,
    firstName: 'Ana',
    lastName: 'Perez',
    demographicConsent: false,
  };

  it('surfaces BusinessAccountBoundException from the acceptance port', async () => {
    const port: InvitationAcceptancePort = {
      accept: vi.fn().mockRejectedValue(new BusinessAccountBoundException()),
    };
    await expect(
      new AcceptInvitationUseCase(port, tokens, transactions()).execute(base),
    ).rejects.toBeInstanceOf(BusinessAccountBoundException);
  });

  it('hashes the token and writes no buckets without consent', async () => {
    const port = acceptance();
    const result = await new AcceptInvitationUseCase(port, tokens, transactions()).execute({
      ...base,
      ageRange: '25_34',
      gender: 'FEMALE',
      province: 'AZUAY',
    });
    expect(result).toEqual({ tenantId: TENANT, roleId: ROLE });
    expect(port.accept).toHaveBeenCalledWith(
      {
        tokenHash: 'b'.repeat(64),
        userId: OTHER,
        consent: false,
        ageRange: null,
        gender: null,
        province: null,
        firstName: 'Ana',
        lastName: 'Perez',
      },
      TX,
    );
  });

  it('passes validated buckets when consent is given', async () => {
    const port = acceptance();
    await new AcceptInvitationUseCase(port, tokens, transactions()).execute({
      ...base,
      demographicConsent: true,
      ageRange: '25_34',
      gender: 'FEMALE',
      province: 'AZUAY',
    });
    expect(port.accept).toHaveBeenCalledWith(
      expect.objectContaining({
        consent: true,
        ageRange: '25_34',
        gender: 'FEMALE',
        province: 'AZUAY',
      }),
      TX,
    );
  });

  it('allows consent with no bucket selected', async () => {
    const port = acceptance();
    await new AcceptInvitationUseCase(port, tokens, transactions()).execute({
      ...base,
      demographicConsent: true,
    });
    expect(port.accept).toHaveBeenCalledWith(
      expect.objectContaining({ consent: true, ageRange: null, gender: null, province: null }),
      TX,
    );
  });

  it('rejects invalid buckets, names and blank tokens before calling the port', async () => {
    const port = acceptance();
    const uc = new AcceptInvitationUseCase(port, tokens, transactions());
    await expect(
      uc.execute({ ...base, demographicConsent: true, ageRange: '27' }),
    ).rejects.toBeInstanceOf(InvalidDemographicBucketException);
    await expect(uc.execute({ ...base, firstName: '<script>' })).rejects.toBeInstanceOf(
      InvalidPersonNameException,
    );
    await expect(uc.execute({ ...base, token: '  ' })).rejects.toBeInstanceOf(
      InvalidInvitationException,
    );
    expect(port.accept).not.toHaveBeenCalled();
  });
});

describe('AssignMemberRoleUseCase', () => {
  const members = (record: MemberRecord | null): MembershipRepositoryPort => ({
    find: vi.fn().mockResolvedValue(record),
    assignCustomRole: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    setStatus: vi.fn().mockResolvedValue(undefined),
    countForUser: vi.fn().mockResolvedValue(0),
  });
  const dto = {
    userId: OWNER,
    tenantId: TENANT,
    memberUserId: OTHER,
    roleId: ROLE as string | null,
  };
  const member: MemberRecord = {
    userId: OTHER,
    baseRole: 'MEMBER',
    status: 'active',
    accountManagedByTenantId: null,
  };

  it('assigns a tenant role to a member', async () => {
    const repo = members(member);
    await new AssignMemberRoleUseCase(
      repo,
      roleRepo([existingRole()]),
      ownership(true),
      transactions(),
    ).execute(dto);
    expect(repo.assignCustomRole).toHaveBeenCalledWith(TENANT, OTHER, ROLE, TX);
  });

  it('allows clearing the role with null', async () => {
    const repo = members(member);
    await new AssignMemberRoleUseCase(repo, roleRepo(), ownership(true), transactions()).execute({
      ...dto,
      roleId: null,
    });
    expect(repo.assignCustomRole).toHaveBeenCalledWith(TENANT, OTHER, null, TX);
  });

  it('refuses to assign a role to a suspended or invited member', async () => {
    for (const status of ['suspended', 'invited'] as const) {
      const repo = members({ ...member, status });
      await expect(
        new AssignMemberRoleUseCase(
          repo,
          roleRepo([existingRole()]),
          ownership(true),
          transactions(),
        ).execute(dto),
      ).rejects.toBeInstanceOf(MemberNotActiveException);
      expect(repo.assignCustomRole).not.toHaveBeenCalled();
    }
  });

  it('refuses non-owners, owners as targets, unknown members and foreign roles', async () => {
    const roles = roleRepo([existingRole()]);
    await expect(
      new AssignMemberRoleUseCase(members(member), roles, ownership(false), transactions()).execute(
        dto,
      ),
    ).rejects.toBeInstanceOf(UserManagementForbiddenException);
    const ownerTarget = members({ ...member, baseRole: 'OWNER' });
    await expect(
      new AssignMemberRoleUseCase(ownerTarget, roles, ownership(true), transactions()).execute(dto),
    ).rejects.toBeInstanceOf(ProtectedMemberException);
    expect(ownerTarget.assignCustomRole).not.toHaveBeenCalled();
    await expect(
      new AssignMemberRoleUseCase(members(null), roles, ownership(true), transactions()).execute(
        dto,
      ),
    ).rejects.toBeInstanceOf(MemberNotFoundException);
    await expect(
      new AssignMemberRoleUseCase(
        members(member),
        roleRepo(),
        ownership(true),
        transactions(),
      ).execute(dto),
    ).rejects.toBeInstanceOf(TenantRoleNotFoundException);
  });
});

describe('UpdateOwnProfileUseCase', () => {
  const profiles = (): UserProfileRepositoryPort => ({
    update: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
  });

  it('updates names and stamps consent date when granting', async () => {
    const repo = profiles();
    await new UpdateOwnProfileUseCase(repo, transactions(), (): Date => NOW).execute({
      userId: OTHER,
      firstName: ' Ana ',
      lastName: 'Perez',
      demographicConsent: true,
    });
    expect(repo.update).toHaveBeenCalledWith(
      {
        userId: OTHER,
        firstName: 'Ana',
        lastName: 'Perez',
        demographicConsent: true,
        demographicConsentAt: NOW,
      },
      TX,
    );
  });

  it('clears the consent date when withdrawing', async () => {
    const repo = profiles();
    await new UpdateOwnProfileUseCase(repo, transactions(), (): Date => NOW).execute({
      userId: OTHER,
      firstName: 'Ana',
      lastName: 'Perez',
      demographicConsent: false,
    });
    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ demographicConsent: false, demographicConsentAt: null }),
      TX,
    );
  });

  it('rejects invalid names', async () => {
    const repo = profiles();
    await expect(
      new UpdateOwnProfileUseCase(repo, transactions()).execute({
        userId: OTHER,
        firstName: '',
        lastName: 'Perez',
        demographicConsent: false,
      }),
    ).rejects.toBeInstanceOf(InvalidPersonNameException);
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('GetInvitationPreviewUseCase', () => {
  it('hashes the token and returns the preview or null', async () => {
    const read: InvitationPreviewReadPort = {
      findUsableByTokenHash: vi
        .fn()
        .mockImplementation((hash: string) =>
          Promise.resolve(
            hash === 'b'.repeat(64)
              ? {
                  tenantId: 't-1',
                  tenantName: 'Tienda',
                  tenantSlug: 'tienda',
                  roleName: 'Cajero',
                  accountMode: 'GOOGLE' as const,
                }
              : null,
          ),
        ),
    };
    const uc = new GetInvitationPreviewUseCase(read, tokens);
    await expect(uc.execute('raw-secret-token')).resolves.toEqual({
      tenantId: 't-1',
      tenantName: 'Tienda',
      tenantSlug: 'tienda',
      roleName: 'Cajero',
      accountMode: 'GOOGLE',
    });
    await expect(uc.execute('other')).resolves.toBeNull();
    await expect(uc.execute('   ')).resolves.toBeNull();
  });
});
