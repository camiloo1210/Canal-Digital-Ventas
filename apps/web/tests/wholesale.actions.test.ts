import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setWholesaleAction } from '@/features/users/actions/wholesale.actions';

const mocks = vi.hoisted(() => ({ user: vi.fn(), execute: vi.fn(), revalidate: vi.fn() }));
vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string) => string> =>
    (key: string): string =>
      key,
}));
vi.mock('next/cache', (): object => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/features/users/actions/users-actor', (): object => ({
  resolveAuthenticatedUserId: mocks.user,
}));
vi.mock('@/features/users/di/users.di', (): object => ({
  getSetBuyerWholesaleUseCase: (): object => ({ execute: mocks.execute }),
}));

const initial = { enabled: null, message: null, success: false };
function form(enabled: string): FormData {
  const data = new FormData();
  data.set('enabled', enabled);
  data.set('userId', 'attacker-controlled');
  return data;
}

beforeEach((): void => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue('authenticated-user');
  mocks.execute.mockResolvedValue(undefined);
});

describe('wholesale action', (): void => {
  it.each(['true', 'false'])(
    'uses the session identity when setting %s',
    async (value: string): Promise<void> => {
      const result = await setWholesaleAction(initial, form(value));
      expect(mocks.execute).toHaveBeenCalledWith({
        userId: 'authenticated-user',
        enabled: value === 'true',
      });
      expect(result).toMatchObject({ success: true, enabled: value === 'true' });
    },
  );
  it('rejects invalid input and unauthenticated requests', async (): Promise<void> => {
    expect((await setWholesaleAction(initial, form('other'))).success).toBe(false);
    mocks.user.mockResolvedValue(null);
    expect((await setWholesaleAction(initial, form('true'))).success).toBe(false);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('preserves the last known state on failure', async (): Promise<void> => {
    mocks.execute.mockRejectedValue(new Error('database'));
    const log = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    const result = await setWholesaleAction(
      { enabled: true, message: null, success: true },
      form('false'),
    );
    expect(result).toMatchObject({ enabled: true, success: false });
    log.mockRestore();
  });
});
