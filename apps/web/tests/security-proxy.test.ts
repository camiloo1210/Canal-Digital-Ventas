import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { proxy, config } from '@/proxy';

const mocks = vi.hoisted(
  (): {
    check: ReturnType<typeof vi.fn>;
    session: ReturnType<typeof vi.fn>;
    report: ReturnType<typeof vi.fn>;
  } => ({
    check: vi.fn(),
    session: vi.fn(),
    report: vi.fn(),
  }),
);
vi.mock('@/lib/security/request-rate-limit', (): object => ({
  checkRequestRateLimit: mocks.check,
}));
vi.mock('@/lib/security/security-telemetry', (): object => ({
  reportSecurityDecision: mocks.report,
}));
vi.mock('@/lib/supabase/proxy', (): object => ({ updateSession: mocks.session }));

beforeEach((): void => {
  vi.resetAllMocks();
  mocks.check.mockResolvedValue(null);
  mocks.session.mockResolvedValue(NextResponse.next());
  mocks.report.mockResolvedValue(undefined);
});

describe('proxy security boundary', (): void => {
  it.each([429, 503])(
    'responds with %i before accessing Supabase',
    async (status: number): Promise<void> => {
      mocks.check.mockResolvedValue({
        status,
        retryAfter: 30,
        policy: 'auth',
        signal: status === 429 ? 'blocked' : 'unavailable',
      });
      const waitUntil = vi.fn();
      const response = await proxy(
        new NextRequest('https://app.test/login', { headers: { cookie: 'NEXT_LOCALE=en' } }),
        { waitUntil } as unknown as NextFetchEvent,
      );
      expect(response.status).toBe(status);
      expect(response.headers.get('retry-after')).toBe('30');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect((await response.json()).message).toMatch(status === 429 ? /Too many/ : /temporarily/);
      expect(mocks.session).not.toHaveBeenCalled();
      expect(waitUntil).toHaveBeenCalledOnce();
    },
  );
  it('rate limits authentication Server Action POSTs even when the next-action header is forged', async (): Promise<void> => {
    await proxy(
      new NextRequest('https://app.test/login', {
        method: 'POST',
        headers: { 'next-action': 'forged' },
      }),
      { waitUntil: vi.fn() } as unknown as NextFetchEvent,
    );
    expect(mocks.check).toHaveBeenCalledOnce();
  });
  it('preserves the existing auth response and locale cookie for allowed traffic', async (): Promise<void> => {
    const response = await proxy(new NextRequest('https://app.test/store/a'), {
      waitUntil: vi.fn(),
    } as unknown as NextFetchEvent);
    expect(mocks.session).toHaveBeenCalledOnce();
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('es');
  });
  it.each([
    '/login',
    '/signup',
    '/dashboard',
    '/api/webhooks/lemon-squeezy',
    '/store/evil.png',
    '/store/evil.png/checkout',
  ])('covers %s including action POSTs', (url: string): void => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
  });
  it.each(['/_next/static/chunk.js', '/_next/image', '/favicon.ico', '/Logo.svg'])(
    'excludes the known static asset %s',
    (url: string): void => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false);
    },
  );
});
