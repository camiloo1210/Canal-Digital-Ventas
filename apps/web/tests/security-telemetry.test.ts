import { beforeEach, expect, it, vi } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { reportSecurityDecision } from '@/lib/security/security-telemetry';
const mocks = vi.hoisted(
  (): {
    claim: ReturnType<typeof vi.fn>;
    capture: ReturnType<typeof vi.fn>;
    flush: ReturnType<typeof vi.fn>;
    init: ReturnType<typeof vi.fn>;
  } => ({
    claim: vi.fn(),
    capture: vi.fn(),
    flush: vi.fn(),
    init: vi.fn(),
  }),
);
vi.mock('server-only', (): object => ({}));
vi.mock('@/lib/security/request-rate-limit', (): object => ({ claimSecurityReport: mocks.claim }));
vi.mock('@sentry/nextjs', (): object => ({
  Scope: class {
    setClient(): void {}
    setTags(): void {}
    setFingerprint(): void {}
  },
  withScope: (scope: unknown, callback: (scope: unknown) => void): void => {
    callback(scope);
  },
  getClient: (): undefined => undefined,
  captureMessage: mocks.capture,
  flush: mocks.flush,
  init: mocks.init,
}));
beforeEach((): void => {
  vi.resetAllMocks();
  mocks.claim.mockResolvedValue(true);
});
it('sends only a grouped security signal and flushes it', async (): Promise<void> => {
  await reportSecurityDecision({ status: 429, retryAfter: 60, policy: 'read', signal: 'blocked' });
  expect(mocks.capture).toHaveBeenCalledWith('request-rate-limit:blocked', { level: 'warning' });
  expect(mocks.flush).toHaveBeenCalledWith(1500);
});
it('suppresses duplicate reports', async (): Promise<void> => {
  mocks.claim.mockResolvedValue(false);
  await reportSecurityDecision({ status: 429, retryAfter: 60, policy: 'read', signal: 'blocked' });
  expect(mocks.capture).not.toHaveBeenCalled();
});
it('contains Sentry failures without changing the security decision', async (): Promise<void> => {
  mocks.capture.mockImplementation((): never => {
    throw new Error('offline');
  });
  await expect(
    reportSecurityDecision({ status: 503, retryAfter: 30, policy: 'read', signal: 'unavailable' }),
  ).resolves.toBeUndefined();
});
it('removes request, user and breadcrumb data before transport', async (): Promise<void> => {
  vi.resetModules();
  await import('@/lib/security/sentry.server');
  const options = mocks.init.mock.calls[0][0] as {
    beforeSend: (event: ErrorEvent) => ErrorEvent;
    dataCollection: object;
  };
  const event = options.beforeSend({
    type: undefined,
    request: { url: 'https://private.test/?token=secret' },
    user: { ip_address: '203.0.113.1' },
    breadcrumbs: [{ message: 'private' }],
  });
  expect(event.request).toBeUndefined();
  expect(event.user).toBeUndefined();
  expect(event.breadcrumbs).toBeUndefined();
  expect(options.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpBodies: [] });
});
