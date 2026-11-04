import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onboardBusinessAction, type ActionState } from '@/features/iam/actions/onboarding.actions';

const mocks = vi.hoisted(() => ({
  isBusinessAccount: vi.fn(),
  execute: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('server-only', (): object => ({}));
vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string) => string> =>
    (key: string): string =>
      key,
}));
vi.mock('next/navigation', (): object => ({
  redirect: (path: string): never => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  },
}));
vi.mock('@/lib/security/authentication-rate-limit', (): object => ({
  authenticationLimitMessage: async (): Promise<null> => null,
}));
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/features/iam/di/iam.di', (): object => ({
  getOnboardTenantUseCase: async (): Promise<object> => ({ execute: mocks.execute }),
}));
vi.mock('@/features/iam/di/business-account.di', (): object => ({
  getBusinessAccountReadRepository: (): object => ({ isBusinessAccount: mocks.isBusinessAccount }),
}));
vi.mock('@canaldigital/packages/core', (): object => ({
  BusinessAccountBoundException: class extends Error {
    public constructor() {
      super('bound');
      this.name = 'BusinessAccountBoundException';
    }
  },
  DomainException: class extends Error {},
  ApplicationException: class extends Error {},
}));

const initial: ActionState = { success: false, error: null };
function form(): FormData {
  const data = new FormData();
  data.append('firstName', 'Ana');
  data.append('lastName', 'Perez');
  data.append('storeName', 'Mi tienda');
  data.append('storeSlug', 'mi-tienda');
  return data;
}

beforeEach((): void => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.co' } }, error: null });
  mocks.isBusinessAccount.mockResolvedValue(false);
  mocks.execute.mockResolvedValue(undefined);
});

describe('onboarding and business accounts', (): void => {
  it('refuses a business account with the localized message and creates nothing', async (): Promise<void> => {
    mocks.isBusinessAccount.mockResolvedValue(true);
    const result = await onboardBusinessAction(initial, form());
    expect(result).toEqual({ success: false, error: 'businessAccountBound' });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('maps the database refusal (P0004) to the same message', async (): Promise<void> => {
    const core = await import('@canaldigital/packages/core');
    mocks.execute.mockRejectedValue(new core.BusinessAccountBoundException());
    const result = await onboardBusinessAction(initial, form());
    expect(result).toEqual({ success: false, error: 'businessAccountBound' });
  });

  it('lets a personal account onboard', async (): Promise<void> => {
    await expect(onboardBusinessAction(initial, form())).rejects.toThrow(
      'NEXT_REDIRECT /dashboard',
    );
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});
