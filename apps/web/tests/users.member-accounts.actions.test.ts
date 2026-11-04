import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renameMemberAction,
  resetMemberPasswordAction,
  setMemberActiveAction,
  unlinkMemberAction,
} from '@/features/users/actions/members.actions';

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  unlink: vi.fn(),
  setActive: vi.fn(),
  resetPassword: vi.fn(),
  rename: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string) => string> =>
    (key: string): string =>
      key,
}));
vi.mock('server-only', (): object => ({}));
vi.mock('next/cache', (): object => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/features/users/actions/users-actor', async (importOriginal): Promise<object> => ({
  ...(await importOriginal<object>()),
  resolveUsersActor: mocks.actor,
}));
vi.mock('@/features/users/di/users.di', (): object => ({
  getAssignMemberRoleUseCase: (): object => ({ execute: vi.fn() }),
  getUnlinkMemberUseCase: (): object => ({ execute: mocks.unlink }),
  getSetMemberActiveUseCase: (): object => ({ execute: mocks.setActive }),
  getResetManagedAccountPasswordUseCase: (): object => ({ execute: mocks.resetPassword }),
  getRenameManagedAccountUseCase: (): object => ({ execute: mocks.rename }),
}));

const actor = { userId: crypto.randomUUID(), tenantId: crypto.randomUUID() };
const memberUserId = crypto.randomUUID();
const initial = { success: false, message: null, revision: 0 };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

class NamedFailure extends Error {
  public constructor(name: string) {
    super(name);
    this.name = name;
  }
}

beforeEach((): void => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue(actor);
  mocks.unlink.mockResolvedValue({ accountKind: 'PERSONAL' });
  mocks.setActive.mockResolvedValue(undefined);
  mocks.resetPassword.mockResolvedValue({ passwordChanged: true, sessionsRevoked: true });
  mocks.rename.mockResolvedValue(undefined);
});

describe('unlinkMemberAction', (): void => {
  it('takes actor and tenant from the session, never from the form', async (): Promise<void> => {
    const result = await unlinkMemberAction(
      initial,
      form({ memberUserId, userId: crypto.randomUUID(), tenantId: crypto.randomUUID() }),
    );
    expect(mocks.unlink).toHaveBeenCalledWith({ ...actor, memberUserId });
    expect(result).toMatchObject({ success: true, message: 'members.unlinked' });
    expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard/users');
  });

  it('never warns about the sign-in account: the database trigger handles it', async (): Promise<void> => {
    mocks.unlink.mockResolvedValue({ accountKind: 'MANAGED' });
    const result = await unlinkMemberAction(initial, form({ memberUserId }));
    expect(result.success).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('rejects a malformed member id and unauthenticated callers', async (): Promise<void> => {
    expect((await unlinkMemberAction(initial, form({ memberUserId: 'nope' }))).message).toBe(
      'errors.invalidInput',
    );
    mocks.actor.mockResolvedValue(null);
    expect((await unlinkMemberAction(initial, form({ memberUserId }))).message).toBe(
      'errors.unauthorized',
    );
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it('maps the protected owner and not found members', async (): Promise<void> => {
    mocks.unlink.mockRejectedValue(new NamedFailure('ProtectedMemberException'));
    expect((await unlinkMemberAction(initial, form({ memberUserId }))).message).toBe(
      'errors.protectedMember',
    );
    mocks.unlink.mockRejectedValue(new NamedFailure('MemberNotFoundException'));
    expect((await unlinkMemberAction(initial, form({ memberUserId }))).message).toBe(
      'errors.memberNotFound',
    );
  });
});

describe('setMemberActiveAction', (): void => {
  it('deactivates and reactivates from the submitted flag', async (): Promise<void> => {
    await setMemberActiveAction(initial, form({ memberUserId, active: 'false' }));
    expect(mocks.setActive).toHaveBeenLastCalledWith({ ...actor, memberUserId, active: false });
    const result = await setMemberActiveAction(initial, form({ memberUserId, active: 'true' }));
    expect(mocks.setActive).toHaveBeenLastCalledWith({ ...actor, memberUserId, active: true });
    expect(result.message).toBe('members.activated');
  });

  it('has no auth warning and rejects an unknown flag', async (): Promise<void> => {
    const result = await setMemberActiveAction(initial, form({ memberUserId, active: 'false' }));
    expect(result.warning).toBeUndefined();
    const bad = await setMemberActiveAction(initial, form({ memberUserId, active: 'maybe' }));
    expect(bad.message).toBe('errors.invalidInput');
  });

  it('maps personal account protection', async (): Promise<void> => {
    mocks.setActive.mockRejectedValue(new NamedFailure('PersonalAccountProtectedException'));
    const result = await setMemberActiveAction(initial, form({ memberUserId, active: 'false' }));
    expect(result.message).toBe('errors.personalAccountProtected');
  });
});

describe('resetMemberPasswordAction', (): void => {
  it('passes the password to the use case and never echoes it back', async (): Promise<void> => {
    const result = await resetMemberPasswordAction(
      initial,
      form({ memberUserId, newPassword: 'new-secret-1' }),
    );
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      ...actor,
      memberUserId,
      newPassword: 'new-secret-1',
    });
    expect(JSON.stringify(result)).not.toContain('new-secret-1');
    expect(result.message).toBe('members.passwordReset');
    expect(result.warning).toBeUndefined();
  });

  it('warns, without failing, when the password changed but sessions were not revoked', async (): Promise<void> => {
    mocks.resetPassword.mockResolvedValue({ passwordChanged: true, sessionsRevoked: false });
    const result = await resetMemberPasswordAction(
      initial,
      form({ memberUserId, newPassword: 'new-secret-1' }),
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe('members.passwordReset');
    expect(result.warning).toBe('members.sessionsNotRevoked');
    expect(JSON.stringify(result)).not.toContain('new-secret-1');
  });

  it('rejects short passwords before the use case and keeps them out of the state', async (): Promise<void> => {
    const result = await resetMemberPasswordAction(
      initial,
      form({ memberUserId, newPassword: 'short' }),
    );
    expect(result.message).toBe('errors.invalidPassword');
    expect(JSON.stringify(result)).not.toContain('short');
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it('maps a missing service role key to a clear notice', async (): Promise<void> => {
    mocks.resetPassword.mockRejectedValue(new NamedFailure('AdminAuthUnavailableException'));
    const result = await resetMemberPasswordAction(
      initial,
      form({ memberUserId, newPassword: 'new-secret-1' }),
    );
    expect(result.message).toBe('errors.adminAuthUnavailable');
  });

  it('does not log the password when an unexpected error happens', async (): Promise<void> => {
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    mocks.resetPassword.mockRejectedValue(new Error('boom'));
    const result = await resetMemberPasswordAction(
      initial,
      form({ memberUserId, newPassword: 'new-secret-1' }),
    );
    expect(result.message).toBe('errors.unexpected');
    expect(JSON.stringify(spy.mock.calls)).not.toContain('new-secret-1');
    spy.mockRestore();
  });
});

describe('renameMemberAction', (): void => {
  it('renames with trimmed names and maps invalid names', async (): Promise<void> => {
    await renameMemberAction(
      initial,
      form({ memberUserId, firstName: ' Ana ', lastName: 'Gomez' }),
    );
    expect(mocks.rename).toHaveBeenCalledWith({
      ...actor,
      memberUserId,
      firstName: 'Ana',
      lastName: 'Gomez',
    });
    mocks.rename.mockRejectedValue(new NamedFailure('InvalidPersonNameException'));
    const result = await renameMemberAction(
      initial,
      form({ memberUserId, firstName: 'Ana', lastName: 'Gomez' }),
    );
    expect(result.message).toBe('errors.invalidName');
  });

  it('rejects empty names', async (): Promise<void> => {
    const result = await renameMemberAction(
      initial,
      form({ memberUserId, firstName: '', lastName: '' }),
    );
    expect(result.message).toBe('errors.invalidInput');
    expect(mocks.rename).not.toHaveBeenCalled();
  });
});
