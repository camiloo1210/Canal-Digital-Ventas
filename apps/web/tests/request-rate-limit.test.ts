import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RateLimitDecision } from '@/lib/security/request-rate-limit';

const mocks = vi.hoisted(
  (): { limit: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; options: unknown[] } => ({
    limit: vi.fn(),
    set: vi.fn(),
    options: [],
  }),
);
vi.mock('server-only', (): object => ({}));
vi.mock('@upstash/redis', (): object => ({
  Redis: class {
    set = mocks.set;
  },
}));
vi.mock('@upstash/ratelimit', (): object => ({
  Ratelimit: class {
    constructor(options: unknown) {
      mocks.options.push(options);
    }
    static slidingWindow(count: number, duration: string): object {
      return { count, duration };
    }
    limit = mocks.limit;
  },
}));

function request(path = '/store/test', method = 'GET', ip = '203.0.113.1'): Request {
  return new Request(`https://app.test${path}`, {
    method,
    headers: { 'x-vercel-forwarded-for': ip },
  });
}

beforeEach((): void => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.options.length = 0;
  vi.unstubAllEnvs();
  vi.stubEnv('RATE_LIMIT_ENABLED', 'true');
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('RATE_LIMIT_KEY_SECRET', 'a'.repeat(32));
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test');
  mocks.limit.mockResolvedValue({ success: true });
  mocks.set.mockResolvedValue('OK');
});

describe('distributed request protection', (): void => {
  it('does not contact Redis when disabled', async (): Promise<void> => {
    vi.stubEnv('RATE_LIMIT_ENABLED', 'false');
    const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
    expect(await checkRequestRateLimit(request())).toBeNull();
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it('hashes the trusted IP and shares a bucket across paths and query strings', async (): Promise<void> => {
    const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
    await checkRequestRateLimit(request('/store/a?x=1'));
    await checkRequestRateLimit(request('/store/b?x=2'));
    expect(mocks.limit.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.limit.mock.calls[0][0]).toBe(mocks.limit.mock.calls[1][0]);
    expect(mocks.options).toHaveLength(5);
    expect(mocks.options[0]).toMatchObject({
      prefix: 'cdv:traffic:preview:read',
    });
    expect(mocks.options[0]).not.toHaveProperty('ephemeralCache');
  });
  it('normalizes IPv6 before hashing', async (): Promise<void> => {
    const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
    await checkRequestRateLimit(request('/', 'GET', '2001:db8::1'));
    await checkRequestRateLimit(request('/', 'GET', '2001:0db8:0:0:0:0:0:1'));
    expect(mocks.limit.mock.calls[0][0]).toBe(mocks.limit.mock.calls[1][0]);
  });
  it('shares one bucket per IPv6 /64 and separates different prefixes', async (): Promise<void> => {
    const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
    await checkRequestRateLimit(request('/', 'GET', '2001:db8:1:2::1'));
    await checkRequestRateLimit(request('/', 'GET', '2001:db8:1:2:ffff:ffff:ffff:ffff'));
    await checkRequestRateLimit(request('/', 'GET', '2001:db8:1:3::1'));
    const [first, second, third] = mocks.limit.mock.calls.map(
      (call: unknown[]): unknown => call[0],
    );
    expect(first).toBe(second);
    expect(first).not.toBe(third);
  });
  it('rejects spoofed forwarding headers, including a claimed Cloudflare IP', async (): Promise<void> => {
    const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
    const spoofed = new Request('https://app.test/', {
      headers: { 'x-forwarded-for': '203.0.113.1', 'cf-connecting-ip': '203.0.113.2' },
    });
    expect(await checkRequestRateLimit(spoofed, 'auth')).toMatchObject({ status: 503 });
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it.each(['invalid', '203.0.113.1, 203.0.113.2'])(
    'rejects invalid trusted IP %s',
    async (ip: string): Promise<void> => {
      const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
      expect(await checkRequestRateLimit(request('/login', 'POST', ip))).toMatchObject({
        status: 503,
      });
    },
  );
  it('is disabled outside Vercel, where forwarded IP headers cannot be trusted', async (): Promise<void> => {
    vi.stubEnv('VERCEL', '');
    const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
    expect(await checkRequestRateLimit(request())).toBeNull();
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it.each(['RATE_LIMIT_KEY_SECRET', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'])(
    'fails closed when %s is missing',
    async (variable: string): Promise<void> => {
      vi.stubEnv(variable, '');
      const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
      expect(await checkRequestRateLimit(request('/login', 'POST'))).toMatchObject({
        status: 503,
        signal: 'unavailable',
      });
      expect(mocks.limit).not.toHaveBeenCalled();
    },
  );
  it('fails open for webhooks and reads when the trusted IP is missing', async (): Promise<void> => {
    const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
    const webhook = new Request('https://app.test/api/webhooks/lemon-squeezy', { method: 'POST' });
    expect(await checkRequestRateLimit(webhook)).toBeNull();
    expect(await checkRequestRateLimit(new Request('https://app.test/store/a'))).toBeNull();
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it('returns a bounded retry delay after exhausting a limit', async (): Promise<void> => {
    mocks.limit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });
    const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
    expect(await checkRequestRateLimit(request('/login', 'POST'))).toMatchObject({
      status: 429,
      policy: 'auth',
      retryAfter: 60,
    });
  });
  it('fails closed for mutations on the Upstash fail-open timeout result', async (): Promise<void> => {
    mocks.limit.mockResolvedValue({ success: true, reason: 'timeout' });
    const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
    expect(await checkRequestRateLimit(request('/api/x', 'POST'))).toMatchObject({ status: 503 });
  });
  it('fails closed for auth on Redis exceptions', async (): Promise<void> => {
    mocks.limit.mockRejectedValue(new Error('provider unavailable'));
    const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
    expect(await checkRequestRateLimit(request('/login', 'POST'))).toMatchObject({ status: 503 });
  });
  it.each([
    ['/store/test', 'GET'],
    ['/api/webhooks/lemon-squeezy', 'POST'],
  ])(
    'fails open for %s during a Redis outage',
    async (path: string, method: string): Promise<void> => {
      const { checkRequestRateLimit } = await import('@/lib/security/request-rate-limit');
      mocks.limit.mockResolvedValue({ success: true, reason: 'timeout' });
      expect(await checkRequestRateLimit(request(path, method))).toBeNull();
      mocks.limit.mockRejectedValue(new Error('provider unavailable'));
      expect(await checkRequestRateLimit(request(path, method))).toBeNull();
    },
  );
  it('classifies auth, mutations, reads and signed webhook ingress separately', async (): Promise<void> => {
    const { trafficPolicy } = await import('@/lib/security/request-rate-limit');
    expect(trafficPolicy('/auth/callback', 'GET')).toBe('auth');
    expect(trafficPolicy('/signup/customer', 'POST')).toBe('auth');
    expect(trafficPolicy('/dashboard/products', 'POST')).toBe('mutation');
    expect(trafficPolicy('/store/a.png', 'GET')).toBe('read');
    expect(trafficPolicy('/api/webhooks/lemon-squeezy', 'POST')).toBe('webhook');
    expect(trafficPolicy('/api/webhooks/lemon-squeezy/evil', 'POST')).toBe('mutation');
  });
  it('coordinates one report per policy per minute across instances', async (): Promise<void> => {
    const { checkRequestRateLimit, claimSecurityReport } =
      await import('@/lib/security/request-rate-limit');
    await checkRequestRateLimit(request());
    const decision: RateLimitDecision = {
      status: 429,
      retryAfter: 60,
      policy: 'read',
      signal: 'blocked',
    };
    expect(await claimSecurityReport(decision)).toBe(true);
    expect(await claimSecurityReport(decision)).toBe(false);
    expect(mocks.set).toHaveBeenCalledWith('cdv:traffic:preview:report:read:blocked', '1', {
      nx: true,
      ex: 60,
    });
  });
  it('suppresses a report already claimed by another instance', async (): Promise<void> => {
    mocks.set.mockResolvedValue(null);
    const { checkRequestRateLimit, claimSecurityReport } =
      await import('@/lib/security/request-rate-limit');
    await checkRequestRateLimit(request());
    expect(
      await claimSecurityReport({ status: 429, retryAfter: 60, policy: 'read', signal: 'blocked' }),
    ).toBe(false);
  });
});
