import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveTenantRoleAction } from '@/features/users/actions/roles.actions';
import { createInvitationAction } from '@/features/users/actions/invitations.actions';
import {
  acceptInvitationAction,
  acceptInvitationAsCurrentUserAction,
} from '@/features/users/actions/invite.actions';
import { assignMemberRoleAction } from '@/features/users/actions/members.actions';
import { updateOwnProfileAction } from '@/features/users/actions/profile.actions';
import type { AcceptInvitationActionState } from '@/features/users/types';

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  adminConfigured: vi.fn(),
  userId: vi.fn(),
  identity: vi.fn(),
  staffExecute: vi.fn(),
  staffRollback: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  createInvitation: vi.fn(),
  accept: vi.fn(),
  assignRole: vi.fn(),
  preview: vi.fn(),
  signUp: vi.fn(),
  updateProfile: vi.fn(),
  limit: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string, values?: Record<string, string>) => string> =>
    (key: string, values?: Record<string, string>): string =>
      values?.reason ? `${key}|${values.reason}` : key,
}));
vi.mock('server-only', (): object => ({}));
vi.mock('next/cache', (): object => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', (): object => ({
  redirect: (path: string): never => {
    mocks.redirect(path);
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('@/lib/security/authentication-rate-limit', (): object => ({
  authenticationLimitMessage: mocks.limit,
}));
vi.mock('@/features/users/actions/users-actor', async (importOriginal): Promise<object> => ({
  ...(await importOriginal<object>()),
  resolveUsersActor: mocks.actor,
  resolveAuthenticatedUserId: mocks.userId,
  resolveAuthenticatedIdentity: mocks.identity,
  requestPublicOrigin: async (): Promise<string> => 'https://shop.test',
}));
vi.mock('@/features/iam/di/iam.di', (): object => ({
  getRegisterGlobalIdentityUseCase: async (): Promise<object> => ({ execute: mocks.signUp }),
}));
vi.mock('@/features/users/di/users.di', (): object => ({
  getCreateTenantRoleUseCase: (): object => ({ execute: mocks.createRole }),
  getUpdateTenantRoleUseCase: (): object => ({ execute: mocks.updateRole }),
  getDeleteTenantRoleUseCase: (): object => ({ execute: vi.fn() }),
  isAdminAuthConfigured: (): boolean => mocks.adminConfigured(),
  getCreateInvitationUseCase: (): object => ({ execute: mocks.createInvitation }),
  getRevokeInvitationUseCase: (): object => ({ execute: vi.fn() }),
  getAssignMemberRoleUseCase: (): object => ({ execute: mocks.assignRole }),
  getAcceptInvitationUseCase: (): object => ({ execute: mocks.accept }),
  getBusinessAccountReadRepository: (): object => ({
    isBoundToOtherTenant: (): Promise<boolean> => Promise.resolve(false),
  }),
  getCreateStaffAccountUseCase: async (): Promise<object> => ({
    execute: mocks.staffExecute,
    rollback: mocks.staffRollback,
  }),
  getGetInvitationPreviewUseCase: (): object => ({ execute: mocks.preview }),
  getUpdateOwnProfileUseCase: (): object => ({ execute: mocks.updateProfile }),
}));

const actor = { userId: crypto.randomUUID(), tenantId: crypto.randomUUID() };
const roleId = crypto.randomUUID();
const token = 'x'.repeat(43);

function form(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries))
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  return data;
}

const initial = { success: false, message: null, revision: 0 };
const acceptInitial: AcceptInvitationActionState = initial;

class NamedFailure extends Error {
  public constructor(name: string) {
    super(name);
    this.name = name;
  }
}

beforeEach((): void => {
  vi.clearAllMocks();
  mocks.adminConfigured.mockReturnValue(true);
  mocks.actor.mockResolvedValue(actor);
  mocks.userId.mockResolvedValue(actor.userId);
  mocks.limit.mockResolvedValue(null);
  mocks.createRole.mockResolvedValue({ roleId });
  mocks.updateRole.mockResolvedValue(undefined);
  mocks.createInvitation.mockResolvedValue({
    invitationId: crypto.randomUUID(),
    token,
    expiresAt: '2030-01-01T00:00:00.000Z',
  });
  mocks.preview.mockResolvedValue({
    tenantName: 'Shop',
    tenantSlug: 'shop',
    roleName: 'Seller',
    accountMode: 'REAL_EMAIL',
  });
  mocks.identity.mockResolvedValue({ id: actor.userId, email: 'me@shop.test', provider: 'email' });
  mocks.staffExecute.mockResolvedValue({
    userId: actor.userId,
    email: 'ana-perez.abcdef@shop.staff.invalid',
  });
  mocks.staffRollback.mockResolvedValue(true);
  mocks.signUp.mockResolvedValue(actor.userId);
  mocks.accept.mockResolvedValue({ tenantId: actor.tenantId, roleId });
  mocks.updateProfile.mockResolvedValue(undefined);
});

describe('role actions', (): void => {
  it('takes actor and tenant from the session and ignores submitted ids', async (): Promise<void> => {
    const result = await saveTenantRoleAction(
      initial,
      form({
        name: ' Seller ',
        permissions: ['VIEW_ORDERS', 'MANAGE_ORDERS'],
        tenantId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
      }),
    );
    expect(result.success).toBe(true);
    expect(mocks.createRole).toHaveBeenCalledWith({
      ...actor,
      name: 'Seller',
      permissions: ['VIEW_ORDERS', 'MANAGE_ORDERS'],
    });
  });
  it('updates when a role id is submitted', async (): Promise<void> => {
    await saveTenantRoleAction(
      initial,
      form({ roleId, name: 'Seller', permissions: ['VIEW_ORDERS'] }),
    );
    expect(mocks.updateRole).toHaveBeenCalledWith({
      ...actor,
      roleId,
      name: 'Seller',
      permissions: ['VIEW_ORDERS'],
    });
  });
  it('rejects unknown permissions and keeps the typed values', async (): Promise<void> => {
    const result = await saveTenantRoleAction(
      initial,
      form({ name: 'Seller', permissions: ['DROP_TABLE'] }),
    );
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.permissions).toBeTruthy();
    expect(result.values).toEqual({ name: 'Seller', permissions: ['DROP_TABLE'] });
    expect(mocks.createRole).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated requests', async (): Promise<void> => {
    mocks.actor.mockResolvedValue(null);
    const result = await saveTenantRoleAction(
      initial,
      form({ name: 'Seller', permissions: ['VIEW_ORDERS'] }),
    );
    expect(result.message).toBe('errors.unauthorized');
    expect(mocks.createRole).not.toHaveBeenCalled();
  });
  it('maps owner-only and duplicate-name failures by exception name', async (): Promise<void> => {
    mocks.createRole.mockRejectedValue(new NamedFailure('UserManagementForbiddenException'));
    const forbidden = await saveTenantRoleAction(
      initial,
      form({ name: 'Seller', permissions: ['VIEW_ORDERS'] }),
    );
    expect(forbidden.message).toBe('errors.forbidden');
    mocks.createRole.mockRejectedValue(new NamedFailure('TenantRoleNameTakenException'));
    const taken = await saveTenantRoleAction(
      initial,
      form({ name: 'Seller', permissions: ['VIEW_ORDERS'] }),
    );
    expect(taken.fieldErrors?.name).toBe('errors.roleNameTaken');
  });
  it('masks unexpected errors', async (): Promise<void> => {
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    mocks.createRole.mockRejectedValue(new Error('connection string leaked'));
    const result = await saveTenantRoleAction(
      initial,
      form({ name: 'Seller', permissions: ['VIEW_ORDERS'] }),
    );
    expect(result.message).toBe('errors.unexpected');
    spy.mockRestore();
  });
});

describe('member actions', (): void => {
  it('maps an inactive member to a localized error key', async (): Promise<void> => {
    mocks.assignRole.mockRejectedValue(new NamedFailure('MemberNotActiveException'));
    const result = await assignMemberRoleAction(
      initial,
      form({ memberUserId: crypto.randomUUID(), roleId }),
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe('errors.memberNotActive');
  });
});

describe('invitation actions', (): void => {
  it('returns the invite link once with the public origin', async (): Promise<void> => {
    const result = await createInvitationAction(
      initial,
      form({ roleId, expiresInDays: '7', maxUses: '3' }),
    );
    expect(result.link).toBe(`https://shop.test/invite/${token}`);
    expect(mocks.createInvitation).toHaveBeenCalledWith({
      ...actor,
      roleId,
      expiresInDays: 7,
      maxUses: 3,
      accountMode: 'GENERATED_EMAIL',
    });
  });
  it('passes the owner-chosen account mode and defaults to a generated email', async (): Promise<void> => {
    await createInvitationAction(
      initial,
      form({ roleId, expiresInDays: '7', maxUses: '1', accountMode: 'GOOGLE' }),
    );
    expect(mocks.createInvitation).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountMode: 'GOOGLE' }),
    );
    await createInvitationAction(initial, form({ roleId, expiresInDays: '7', maxUses: '1' }));
    expect(mocks.createInvitation).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountMode: 'GENERATED_EMAIL' }),
    );
  });
  it('refuses a generated email invitation when the service role key is missing', async (): Promise<void> => {
    mocks.adminConfigured.mockReturnValue(false);
    const result = await createInvitationAction(
      initial,
      form({ roleId, expiresInDays: '7', maxUses: '1', accountMode: 'GENERATED_EMAIL' }),
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe('errors.adminAuthUnavailable');
    expect(mocks.createInvitation).not.toHaveBeenCalled();
    const real = await createInvitationAction(
      initial,
      form({ roleId, expiresInDays: '7', maxUses: '1', accountMode: 'REAL_EMAIL' }),
    );
    expect(real.success).toBe(true);
  });
  it('rejects an unknown account mode before calling Core', async (): Promise<void> => {
    const result = await createInvitationAction(
      initial,
      form({ roleId, expiresInDays: '7', maxUses: '1', accountMode: 'SMS' }),
    );
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.accountMode).toBeTruthy();
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });
  it('validates expiry and usage limits before calling Core', async (): Promise<void> => {
    const result = await createInvitationAction(
      initial,
      form({ roleId, expiresInDays: '365', maxUses: '0' }),
    );
    expect(result.success).toBe(false);
    expect(result.link).toBeUndefined();
    expect(result.fieldErrors?.expiresInDays).toBeTruthy();
    expect(result.fieldErrors?.maxUses).toBeTruthy();
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });
});

describe('accept invitation action', (): void => {
  const valid = {
    token,
    mode: 'REAL_EMAIL',
    email: 'new@shop.test',
    password: 'long-enough-1',
    firstName: 'Ana',
    lastName: 'Perez',
  };

  it('creates the auth user, accepts, then redirects outside the try block', async (): Promise<void> => {
    await expect(acceptInvitationAction(acceptInitial, form(valid))).rejects.toThrow(
      'NEXT_REDIRECT',
    );
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'new@shop.test',
      password: 'long-enough-1',
    });
    expect(mocks.accept).toHaveBeenCalledWith(
      expect.objectContaining({ token, userId: actor.userId, demographicConsent: false }),
    );
    // Lands in the business just joined, named explicitly (an owner of others would otherwise hit the selector).
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard?tenant=' + actor.tenantId);
  });
  it('drops demographic buckets when consent is not given', async (): Promise<void> => {
    await expect(
      acceptInvitationAction(
        acceptInitial,
        form({ ...valid, ageRange: '25_34', gender: 'FEMALE', province: 'AZUAY' }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT');
    const dto = mocks.accept.mock.calls[0][0];
    expect(dto.demographicConsent).toBe(false);
    expect(dto.ageRange).toBeUndefined();
    expect(dto.gender).toBeUndefined();
    expect(dto.province).toBeUndefined();
  });
  it('passes buckets only with consent and rejects values outside the fixed lists', async (): Promise<void> => {
    await expect(
      acceptInvitationAction(
        acceptInitial,
        form({ ...valid, consent: 'on', ageRange: '25_34', gender: 'FEMALE', province: 'AZUAY' }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.accept.mock.calls[0][0]).toMatchObject({
      demographicConsent: true,
      ageRange: '25_34',
      gender: 'FEMALE',
      province: 'AZUAY',
    });
    mocks.signUp.mockClear();
    const bad = await acceptInvitationAction(
      acceptInitial,
      form({ ...valid, consent: 'on', ageRange: '27' }),
    );
    expect(bad.success).toBe(false);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it('does not create an auth user for a dead invitation', async (): Promise<void> => {
    mocks.preview.mockResolvedValue(null);
    const result = await acceptInvitationAction(acceptInitial, form(valid));
    expect(result.message).toBe('invite.errors.invitationNotUsable');
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it('reports a created account when acceptance fails afterwards', async (): Promise<void> => {
    mocks.accept.mockRejectedValue(new NamedFailure('InvitationNotUsableException'));
    const result = await acceptInvitationAction(acceptInitial, form(valid));
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      'invite.errors.acceptFailedAccountCreated|errors.invitationNotUsable',
    );
    expect(result.values).not.toHaveProperty('password');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('is rate limited like the other authentication actions', async (): Promise<void> => {
    mocks.limit.mockResolvedValue('slow down');
    const result = await acceptInvitationAction(acceptInitial, form(valid));
    expect(result.message).toBe('slow down');
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it('lets a signed-in user accept with their own id, never a submitted one', async (): Promise<void> => {
    await expect(
      acceptInvitationAsCurrentUserAction(
        acceptInitial,
        form({ token, userId: crypto.randomUUID() }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.accept).toHaveBeenCalledWith(
      expect.objectContaining({ token, userId: actor.userId }),
    );
  });
  it('requires a session to accept with the current account', async (): Promise<void> => {
    mocks.identity.mockResolvedValue(null);
    const result = await acceptInvitationAsCurrentUserAction(acceptInitial, form({ token }));
    expect(result.message).toBe('invite.errors.notSignedIn');
    expect(mocks.accept).not.toHaveBeenCalled();
  });
});

describe('profile action', (): void => {
  it('updates only the authenticated user', async (): Promise<void> => {
    const result = await updateOwnProfileAction(
      initial,
      form({ firstName: 'Ana', lastName: 'Perez', consent: 'on', userId: crypto.randomUUID() }),
    );
    expect(result.success).toBe(true);
    expect(mocks.updateProfile).toHaveBeenCalledWith({
      userId: actor.userId,
      firstName: 'Ana',
      lastName: 'Perez',
      demographicConsent: true,
    });
  });
  it('treats a missing checkbox as withdrawn consent', async (): Promise<void> => {
    await updateOwnProfileAction(initial, form({ firstName: 'Ana', lastName: 'Perez' }));
    expect(mocks.updateProfile.mock.calls[0][0].demographicConsent).toBe(false);
  });
  it('keeps typed values when validation fails', async (): Promise<void> => {
    const result = await updateOwnProfileAction(
      initial,
      form({ firstName: '', lastName: 'Perez' }),
    );
    expect(result.success).toBe(false);
    expect(result.values?.lastName).toBe('Perez');
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });
});
