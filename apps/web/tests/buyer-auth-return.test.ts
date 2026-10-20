import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginWithEmailAction, loginWithGoogleAction } from '@/features/iam/actions/login.actions';
import { GET } from '@/app/auth/callback/route';
import { signupCustomerAction } from '@/features/iam/actions/signup.actions';
import { OAUTH_INTENT_COOKIE, OAUTH_RETURN_COOKIE } from '@/features/iam/constants';
import { InvalidCredentialsException } from '@canaldigital/packages/core';

vi.mock('next-intl/server', (): object => ({
  getTranslations: vi.fn().mockResolvedValue((key: string): string => key),
}));

const mocks = vi.hoisted(
  (): {
    execute: ReturnType<typeof vi.fn>;
    exchange: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
  } => ({
    execute: vi.fn(),
    exchange: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    getUser: vi.fn(),
  }),
);
vi.mock('next/headers', (): object => ({
  cookies: vi.fn().mockImplementation(async (): Promise<object> => ({
    set: mocks.set,
    get: mocks.get,
    delete: mocks.remove,
  })),
  headers: vi
    .fn()
    .mockImplementation(
      async (): Promise<Headers> => new Headers({ host: 'app.test', 'x-forwarded-proto': 'https' }),
    ),
}));
vi.mock('next/navigation', (): object => ({
  redirect: (path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock('@/features/iam/di/iam.di', (): object => ({
  getSignInWithEmailUseCase: vi
    .fn()
    .mockImplementation(async (): Promise<object> => ({ execute: mocks.execute })),
  getGetOAuthSignInUrlUseCase: vi
    .fn()
    .mockImplementation(async (): Promise<object> => ({ execute: mocks.execute })),
  getExchangeOAuthCodeUseCase: vi
    .fn()
    .mockImplementation(async (): Promise<object> => ({ execute: mocks.exchange })),
  getRegisterGlobalIdentityUseCase: vi
    .fn()
    .mockImplementation(async (): Promise<object> => ({ execute: mocks.execute })),
  getOnboardTenantUseCase: vi.fn(),
}));
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: vi.fn().mockImplementation(async (): Promise<object> => ({
    auth: { getUser: mocks.getUser },
    schema: (): object => ({
      from: (): object => ({
        select: (): object => ({
          eq: (): object => ({
            eq: (): object => ({ limit: async (): Promise<object> => ({ data: [], error: null }) }),
          }),
        }),
      }),
    }),
  })),
}));

describe('buyer auth round trip', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.execute.mockReset().mockResolvedValue(undefined);
    mocks.exchange.mockResolvedValue(undefined);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'buyer' } } });
  });
  it('returns localized credential errors instead of vendor text', async (): Promise<void> => {
    mocks.execute.mockRejectedValue(new InvalidCredentialsException('Private provider detail'));
    const data = new FormData();
    data.set('email', 'buyer@example.test');
    data.set('password', 'password');
    expect(await loginWithEmailAction({ success: false, error: null }, data)).toEqual({
      success: false,
      error: 'credentials',
    });
  });
  it('localizes invalid input before invoking authentication', async (): Promise<void> => {
    const data = new FormData();
    data.set('email', 'invalid');
    data.set('password', 'password');
    expect(await loginWithEmailAction({ success: false, error: null }, data)).toEqual({
      success: false,
      error: 'email',
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('returns an email login to the original checkout', async (): Promise<void> => {
    const data = new FormData();
    data.set('email', 'buyer@example.test');
    data.set('password', 'password');
    data.set('redirectTo', '/store/shop/checkout');
    await expect(loginWithEmailAction({ success: false, error: null }, data)).rejects.toThrow(
      'REDIRECT:/store/shop/checkout',
    );
  });
  it('returns a signed in customer registration to checkout', async (): Promise<void> => {
    const data = new FormData();
    data.set('email', 'buyer@example.test');
    data.set('password', 'password');
    data.set('redirectTo', '/store/shop/checkout');
    await expect(signupCustomerAction({ success: false, error: null }, data)).rejects.toThrow(
      'REDIRECT:/store/shop/checkout',
    );
  });
  it('keeps the checkout return on login when registration requires confirmation', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const data = new FormData();
    data.set('email', 'buyer@example.test');
    data.set('password', 'password');
    data.set('redirectTo', '/store/shop/checkout');
    await expect(signupCustomerAction({ success: false, error: null }, data)).rejects.toThrow(
      'REDIRECT:/login?redirectTo=%2Fstore%2Fshop%2Fcheckout',
    );
  });
  it('does not return an email login to an external origin', async (): Promise<void> => {
    const data = new FormData();
    data.set('email', 'buyer@example.test');
    data.set('password', 'password');
    data.set('redirectTo', '//evil.test');
    await expect(loginWithEmailAction({ success: false, error: null }, data)).rejects.toThrow(
      'REDIRECT:/login',
    );
  });
  it('stores a short lived httpOnly OAuth return and preserves the provider redirect', async (): Promise<void> => {
    mocks.execute.mockResolvedValue('https://provider.test/authorize');
    const data = new FormData();
    data.set('redirectTo', '/store/shop/checkout');
    await expect(loginWithGoogleAction(data)).rejects.toThrow(
      'REDIRECT:https://provider.test/authorize',
    );
    expect(mocks.set).toHaveBeenCalledWith(
      OAUTH_RETURN_COOKIE,
      '/store/shop/checkout',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', maxAge: 600 }),
    );
  });
  it('consumes the OAuth return and redirects the buyer to checkout', async (): Promise<void> => {
    mocks.get.mockImplementation((key: string): { value: string } | undefined =>
      key === OAUTH_INTENT_COOKIE
        ? { value: 'customer' }
        : key === OAUTH_RETURN_COOKIE
          ? { value: '/store/shop/checkout' }
          : undefined,
    );
    const result = await GET(new Request('https://app.test/auth/callback?code=valid-code'));
    expect(mocks.exchange).toHaveBeenCalledWith('valid-code');
    expect(mocks.remove).toHaveBeenCalledWith(OAUTH_RETURN_COOKIE);
    expect(result.headers.get('location')).toBe('https://app.test/store/shop/checkout');
  });
});
