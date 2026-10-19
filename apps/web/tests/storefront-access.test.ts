import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
import { safeAuthReturnPath, buyerAuthHref } from '@/features/iam/utils/auth-return-path';

const mocks = vi.hoisted(
  (): { getUser: ReturnType<typeof vi.fn>; limit: ReturnType<typeof vi.fn> } => ({
    getUser: vi.fn(),
    limit: vi.fn(),
  }),
);
vi.mock('@supabase/ssr', (): object => ({
  createServerClient: (): object => ({
    auth: { getUser: mocks.getUser },
    schema: (): object => ({
      from: (): object => ({
        select: (): object => ({
          eq: (): object => ({ eq: (): object => ({ limit: mocks.limit }) }),
        }),
      }),
    }),
  }),
}));

describe('buyer authentication return paths', (): void => {
  it.each([
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/dashboard',
    '/store/slug/checkout/extra',
    '/%2f%2fevil.test',
    '/login?redirectTo=//evil.test',
    '/store/%2e%2e/dashboard',
    '/\n/evil.test',
  ])('rejects untrusted destination %s', (path: string): void => {
    expect(safeAuthReturnPath(path)).toBe('/');
  });
  it('preserves store filters and checkout destinations', (): void => {
    expect(safeAuthReturnPath('/store/my-store?q=pen&category=office&page=2')).toBe(
      '/store/my-store?q=pen&category=office&page=2',
    );
    expect(buyerAuthHref('/signup', '/store/my-store/checkout')).toBe(
      '/signup?redirectTo=%2Fstore%2Fmy-store%2Fcheckout',
    );
  });
  it('preserves the separate buyer purchases destination and order anchor', (): void => {
    expect(safeAuthReturnPath('/purchases#order-existing')).toBe('/purchases#order-existing');
    expect(safeAuthReturnPath('/purchases/admin')).toBe('/');
    expect(safeAuthReturnPath('/purchases-other')).toBe('/');
  });
});

describe('public store route boundaries', (): void => {
  beforeEach((): void => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.limit.mockResolvedValue({ data: [], error: null });
  });
  it.each(['/store/my-store', '/store/my-store/', '/store/my-store/products/product-id'])(
    'allows catalog and detail without a session: %s',
    async (path: string): Promise<void> => {
      const result = await updateSession(new NextRequest(`https://app.test${path}`));
      expect(result.headers.get('location')).toBeNull();
    },
  );
  it.each([
    '/store/my-store/checkout',
    '/store/my-store/products/id/edit',
    '/dashboard',
    '/storefront',
    '/purchases',
  ])('keeps protected or unknown routes authenticated: %s', async (path: string): Promise<void> => {
    const result = await updateSession(new NextRequest(`https://app.test${path}`));
    expect(new URL(result.headers.get('location') ?? '').pathname).toBe('/login');
  });
  it('preserves the checkout return on the login redirect', async (): Promise<void> => {
    const response = await updateSession(
      new NextRequest('https://app.test/store/my-store/checkout'),
    );
    expect(new URL(response.headers.get('location') ?? '').searchParams.get('redirectTo')).toBe(
      '/store/my-store/checkout',
    );
  });
  it('returns an authenticated buyer from login to checkout', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'buyer' } } });
    const response = await updateSession(
      new NextRequest(`https://app.test${buyerAuthHref('/login', '/store/my-store/checkout')}`),
    );
    expect(response.headers.get('location')).toBe('https://app.test/store/my-store/checkout');
  });
  it('allows authenticated buyers to checkout without a seller membership', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'buyer' } } });
    const response = await updateSession(
      new NextRequest('https://app.test/store/my-store/checkout'),
    );
    expect(response.headers.get('location')).toBeNull();
  });
  it('does not grant dashboard access to a buyer without membership', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'buyer' } } });
    const response = await updateSession(new NextRequest('https://app.test/dashboard'));
    expect(response.headers.get('location')).toBe('https://app.test/onboarding');
  });
});
