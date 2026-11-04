import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signupClientAction } from '@/features/iam/actions/signup-client.actions';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  record: vi.fn(),
  tenantId: vi.fn(),
  limit: vi.fn(),
  redirect: vi.fn(),
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
    mocks.redirect(path);
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('@/lib/security/authentication-rate-limit', (): object => ({
  authenticationLimitMessage: mocks.limit,
}));
vi.mock('@/features/iam/di/iam.di', (): object => ({
  getRegisterGlobalIdentityUseCase: async (): Promise<object> => ({ execute: mocks.signUp }),
}));
vi.mock('@/features/users/di/users.di', (): object => ({
  getRecordSignupDemographicsUseCase: (): object => ({ execute: mocks.record }),
}));
vi.mock('@/features/users/queries/tenant-id-by-slug.query', (): object => ({
  resolveActiveTenantIdBySlugQuery: mocks.tenantId,
}));

const userId = crypto.randomUUID();
const tenantId = crypto.randomUUID();
const initial = { success: false, error: null };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

const valid = { email: 'buyer@shop.test', password: 'long-enough-1' };

beforeEach((): void => {
  vi.clearAllMocks();
  mocks.limit.mockResolvedValue(null);
  mocks.signUp.mockResolvedValue(userId);
  mocks.record.mockResolvedValue(undefined);
  mocks.tenantId.mockResolvedValue(tenantId);
});

describe('signupClientAction demographic consent', (): void => {
  it('stores nothing when consent is not given, even if buckets were submitted', async (): Promise<void> => {
    await expect(
      signupClientAction(initial, form({ ...valid, ageRange: '25_34', gender: 'FEMALE' })),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith('/buyer-dashboard');
  });

  it('records consent for the new user with the store resolved from the slug', async (): Promise<void> => {
    await expect(
      signupClientAction(
        initial,
        form({
          ...valid,
          tenantSlug: 'my-shop',
          consent: 'on',
          ageRange: '25_34',
          gender: 'FEMALE',
          province: 'AZUAY',
        }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.tenantId).toHaveBeenCalledWith('my-shop', userId);
    expect(mocks.record).toHaveBeenCalledWith({
      userId,
      consent: true,
      ageRange: '25_34',
      gender: 'FEMALE',
      province: 'AZUAY',
      tenantId,
    });
    expect(mocks.redirect).toHaveBeenCalledWith('/store/my-shop');
  });

  it('rejects buckets outside the fixed lists before creating the account', async (): Promise<void> => {
    const result = await signupClientAction(
      initial,
      form({ ...valid, consent: 'on', ageRange: '27' }),
    );
    expect(result.success).toBe(false);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('does not block signup when recording fails and logs only the error name', async (): Promise<void> => {
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    const failure = new Error('connection string postgres://secret');
    failure.name = 'UserManagementRepositoryException';
    mocks.record.mockRejectedValue(failure);
    await expect(signupClientAction(initial, form({ ...valid, consent: 'on' }))).rejects.toThrow(
      'NEXT_REDIRECT',
    );
    expect(mocks.redirect).toHaveBeenCalledWith('/buyer-dashboard');
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain('UserManagementRepositoryException');
    expect(logged).not.toContain('secret');
    spy.mockRestore();
  });
});
