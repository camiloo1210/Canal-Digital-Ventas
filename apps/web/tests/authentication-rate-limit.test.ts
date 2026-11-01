import { beforeEach, expect, it, vi } from 'vitest';
import { authenticationLimitMessage } from '@/lib/security/authentication-rate-limit';
const mocks = vi.hoisted(
  (): { check: ReturnType<typeof vi.fn>; report: ReturnType<typeof vi.fn> } => ({
    check: vi.fn(),
    report: vi.fn(),
  }),
);
vi.mock('server-only', (): object => ({}));
vi.mock('next/headers', (): object => ({
  headers: async (): Promise<Headers> => new Headers({ 'x-vercel-forwarded-for': '203.0.113.1' }),
}));
vi.mock('next/server', (): object => ({
  after: (callback: () => unknown): void => {
    void callback();
  },
}));
vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string) => string> =>
    (key: string): string =>
      key,
}));
vi.mock('@/lib/security/request-rate-limit', (): object => ({
  checkRequestRateLimit: mocks.check,
}));
vi.mock('@/lib/security/security-telemetry', (): object => ({
  reportSecurityDecision: mocks.report,
}));
beforeEach((): void => {
  vi.resetAllMocks();
  vi.stubEnv('RATE_LIMIT_ENABLED', 'true');
});
it('enforces the authentication bucket even when an action is invoked from another page', async (): Promise<void> => {
  mocks.check.mockResolvedValue({ status: 429 });
  expect(await authenticationLimitMessage()).toBe('rateLimited');
  expect(mocks.check).toHaveBeenCalledWith(expect.any(Request), 'auth-action');
  expect(mocks.report).toHaveBeenCalledOnce();
});
it('returns a localized service failure when the limiter is unavailable', async (): Promise<void> => {
  mocks.check.mockResolvedValue({ status: 503 });
  expect(await authenticationLimitMessage()).toBe('unavailable');
});
it('allows valid traffic', async (): Promise<void> => {
  mocks.check.mockResolvedValue(null);
  expect(await authenticationLimitMessage()).toBeNull();
});
