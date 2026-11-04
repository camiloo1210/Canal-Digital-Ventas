import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  saveTenantRoleAction,
  deleteTenantRoleAction,
} from '@/features/users/actions/roles.actions';
import {
  createInvitationAction,
  revokeInvitationAction,
} from '@/features/users/actions/invitations.actions';
import {
  assignMemberRoleAction,
  renameMemberAction,
  resetMemberPasswordAction,
  setMemberActiveAction,
  unlinkMemberAction,
} from '@/features/users/actions/members.actions';
import { resolveUsersActor } from '@/features/users/actions/users-actor';

const mocks = vi.hoisted(
  (): { execute: ReturnType<typeof vi.fn>; resolve: ReturnType<typeof vi.fn> } => ({
    execute: vi.fn(),
    resolve: vi.fn(),
  }),
);

vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string) => string> =>
    (key: string): string =>
      key,
}));
vi.mock('server-only', (): object => ({}));
vi.mock('next/cache', (): object => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', (): object => ({ headers: vi.fn() }));
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({
    auth: { getUser: async (): Promise<object> => ({ data: { user: { id: 'actor-id' } } }) },
  }),
}));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  resolveActiveTenantQuery: mocks.resolve,
}));
vi.mock('@/features/users/di/users.di', (): object => ({
  getCreateTenantRoleUseCase: (): object => ({ execute: mocks.execute }),
  getUpdateTenantRoleUseCase: (): object => ({ execute: mocks.execute }),
  getDeleteTenantRoleUseCase: (): object => ({ execute: mocks.execute }),
  getCreateInvitationUseCase: (): object => ({ execute: mocks.execute }),
  getRevokeInvitationUseCase: (): object => ({ execute: mocks.execute }),
  getAssignMemberRoleUseCase: (): object => ({ execute: mocks.execute }),
  getUnlinkMemberUseCase: (): object => ({ execute: mocks.execute }),
  getSetMemberActiveUseCase: (): object => ({ execute: mocks.execute }),
  getResetManagedAccountPasswordUseCase: (): object => ({ execute: mocks.execute }),
  getRenameManagedAccountUseCase: (): object => ({ execute: mocks.execute }),
  isAdminAuthConfigured: (): boolean => true,
}));

const TENANT = crypto.randomUUID();
const FOREIGN = crypto.randomUUID();
const member = crypto.randomUUID();
const role = crypto.randomUUID();
const initial = { success: false, message: null, revision: 0 };

function data(tenantId: string | null): FormData {
  const d = new FormData();
  if (tenantId) d.set('tenantId', tenantId);
  d.set('memberUserId', member);
  d.set('roleId', role);
  d.set('invitationId', role);
  d.set('name', 'Seller');
  d.set('permissions', 'VIEW_ORDERS');
  d.set('active', 'true');
  d.set('newPassword', 'Sup3r-secret-pass!');
  d.set('firstName', 'Ana');
  d.set('lastName', 'Perez');
  d.set('expiresInDays', '7');
  d.set('maxUses', '1');
  return d;
}

beforeEach((): void => {
  vi.clearAllMocks();
  mocks.execute.mockResolvedValue({ roleId: role });
  mocks.resolve.mockImplementation(async (_user: string, id: string): Promise<object | null> =>
    id === TENANT
      ? { status: 'ready', tenantId: TENANT, tenantName: 'S', tenantSlug: 's', role: 'OWNER' }
      : null,
  );
});

describe('resolveUsersActor', (): void => {
  it('binds the actor to the verified named tenant', async (): Promise<void> => {
    expect(await resolveUsersActor(data(TENANT))).toEqual({ userId: 'actor-id', tenantId: TENANT });
  });
  it.each([
    ['missing', null],
    ['foreign', FOREIGN],
    ['malformed', 'nope'],
  ])('answers CONTEXT_CHANGED for a %s tenantId', async (_label, id): Promise<void> => {
    expect(await resolveUsersActor(data(id))).toBe('CONTEXT_CHANGED');
  });
});

describe('every users mutation requires the explicit, verified business', (): void => {
  const actions: [string, () => Promise<{ success: boolean; message: string | null }>][] = [
    [
      'saveTenantRole',
      (): Promise<{ success: boolean; message: string | null }> =>
        saveTenantRoleAction({ ...initial, values: { name: '', permissions: [] } }, data(FOREIGN)),
    ],
    [
      'deleteTenantRole',
      (): Promise<{ success: boolean; message: string | null }> =>
        deleteTenantRoleAction(initial, data(FOREIGN)),
    ],
    [
      'createInvitation',
      (): Promise<{ success: boolean; message: string | null }> =>
        createInvitationAction(initial, data(FOREIGN)),
    ],
    [
      'revokeInvitation',
      (): Promise<{ success: boolean; message: string | null }> =>
        revokeInvitationAction(initial, data(FOREIGN)),
    ],
    [
      'assignMemberRole',
      (): Promise<{ success: boolean; message: string | null }> =>
        assignMemberRoleAction(initial, data(FOREIGN)),
    ],
    [
      'unlinkMember',
      (): Promise<{ success: boolean; message: string | null }> =>
        unlinkMemberAction(initial, data(FOREIGN)),
    ],
    [
      'setMemberActive',
      (): Promise<{ success: boolean; message: string | null }> =>
        setMemberActiveAction(initial, data(FOREIGN)),
    ],
    [
      'resetMemberPassword',
      (): Promise<{ success: boolean; message: string | null }> =>
        resetMemberPasswordAction(initial, data(FOREIGN)),
    ],
    [
      'renameMember',
      (): Promise<{ success: boolean; message: string | null }> =>
        renameMemberAction(initial, data(FOREIGN)),
    ],
  ];
  it.each(actions)(
    '%s rejects a foreign tenantId without executing',
    async (_name, run): Promise<void> => {
      const result = await run();
      expect(result.success).toBe(false);
      expect(result.message).toBe('errors.contextChanged');
      expect(mocks.execute).not.toHaveBeenCalled();
    },
  );
  it('unlinkMember rejects a missing tenantId without executing', async (): Promise<void> => {
    const result = await unlinkMemberAction(initial, data(null));
    expect(result.message).toBe('errors.contextChanged');
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('acts inside the named business when it is verified', async (): Promise<void> => {
    const result = await unlinkMemberAction(initial, data(TENANT));
    expect(result.success).toBe(true);
    expect(mocks.execute).toHaveBeenCalledWith({
      userId: 'actor-id',
      tenantId: TENANT,
      memberUserId: member,
    });
  });
});
