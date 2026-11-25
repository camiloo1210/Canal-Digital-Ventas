import { describe, expect, it, vi } from 'vitest';
import type { TrackingProviderPort } from '@/shipment-tracking/application/ports/out/tracking-provider.port';
import { TrackingAuthorizationException } from '@/shipment-tracking/application/tracking-authorization.exception';
import { PollTrackingUseCase } from '@/shipment-tracking/application/use-cases/poll-tracking.use-case';
import type {
  TrackingClaim,
  TrackingRepositoryPort,
} from '@/shipment-tracking/application/ports/out/tracking-repository.port';

const claim: TrackingClaim = {
  tenantId: 'tenant',
  orderId: 'order',
  environment: 'sandbox',
  trackingNumber: '123',
  credentialRef: 'tenant-key',
  generation: 2,
  attempts: 1,
  leaseToken: 'lease',
};
function setup(): {
  useCase: PollTrackingUseCase;
  repo: TrackingRepositoryPort;
  provider: TrackingProviderPort;
  apply: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  claimDue: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
} {
  const claimDue = vi.fn().mockResolvedValue(claim);
  const apply = vi.fn().mockResolvedValue('applied');
  const retry = vi.fn().mockResolvedValue(undefined);
  const track = vi.fn().mockResolvedValue({ kind: 'found', observations: [] });
  const pause = vi.fn().mockResolvedValue(undefined);
  const repo: TrackingRepositoryPort = { claimDue, apply, retry, pause };
  const provider: TrackingProviderPort = { track };
  return {
    useCase: new PollTrackingUseCase(
      repo,
      provider,
      (): string => '2026-11-09T12:00:00Z',
      (): number => 0,
    ),
    repo,
    provider,
    apply,
    retry,
    track,
    claimDue,
    pause,
  };
}
describe('tracking polling', (): void => {
  it('uses only the trusted claim and applies the result with its generation and lease', async (): Promise<void> => {
    const f = setup();
    expect(await f.useCase.execute('2026-11-09T12:00:00Z', 'lease', '2026-11-09T12:05:00Z')).toBe(
      'applied',
    );
    expect(f.track).toHaveBeenCalledWith({
      trackingNumber: '123',
      credentialRef: 'tenant-key',
      environment: 'sandbox',
    });
    expect(f.apply).toHaveBeenCalledWith(
      claim,
      { kind: 'found', observations: [] },
      '2026-11-09T12:00:00Z',
    );
  });
  it('returns stale if the claim is no longer valid', async (): Promise<void> => {
    const f = setup();
    f.apply.mockResolvedValue('stale');
    expect(await f.useCase.execute('2026-11-09T12:00:00Z', 'lease', '2026-11-09T12:05:00Z')).toBe(
      'stale',
    );
  });
  it('schedules retry and preserves the provider error when polling fails', async (): Promise<void> => {
    const f = setup();
    f.track.mockRejectedValue(new Error('unavailable'));
    await expect(
      f.useCase.execute('2026-11-09T12:00:00Z', 'lease', '2026-11-09T12:05:00Z'),
    ).rejects.toThrow('unavailable');
    expect(f.retry).toHaveBeenCalledWith(claim, '2026-11-09T12:05:00Z');
  });
  it('does not schedule a rate-limited request before the provider permits it', async (): Promise<void> => {
    const f = setup();
    f.track.mockRejectedValue(Object.assign(new Error('limited'), { retryAfterSeconds: 900 }));
    await expect(
      f.useCase.execute('2026-11-09T12:00:00Z', 'lease', '2026-11-09T12:05:00Z'),
    ).rejects.toThrow('limited');
    expect(f.retry).toHaveBeenCalledWith(claim, '2026-11-09T12:15:00.000Z');
  });
  it('backs off repeated errors with a six-hour cap', async (): Promise<void> => {
    const f = setup();
    f.claimDue.mockResolvedValue({ ...claim, attempts: 4 });
    f.track.mockRejectedValue(new Error('offline'));
    await expect(
      f.useCase.execute('2026-11-09T12:00:00Z', 'lease', '2026-11-09T12:01:00Z'),
    ).rejects.toThrow();
    expect(f.retry).toHaveBeenCalledWith({ ...claim, attempts: 4 }, '2026-11-09T12:08:00.000Z');
  });
  it('adds jitter to retry scheduling without exceeding the cap', async (): Promise<void> => {
    const f = setup();
    const poller = new PollTrackingUseCase(
      f.repo,
      f.provider,
      (): string => '2026-11-09T12:00:00Z',
      (): number => 1,
    );
    f.track.mockRejectedValue(new Error('offline'));
    await expect(
      poller.execute('2026-11-09T12:00:00Z', 'lease', '2026-11-09T12:01:00Z'),
    ).rejects.toThrow();
    expect(f.retry).toHaveBeenCalledWith(claim, '2026-11-09T12:01:06.000Z');
  });
  it('caps repeated retry delays at six hours', async (): Promise<void> => {
    const f = setup();
    f.claimDue.mockResolvedValue({ ...claim, attempts: 100 });
    f.track.mockRejectedValue(new Error('offline'));
    await expect(
      f.useCase.execute('2026-11-09T12:00:00Z', 'lease', '2026-11-09T12:01:00Z'),
    ).rejects.toThrow();
    expect(f.retry).toHaveBeenCalledWith({ ...claim, attempts: 100 }, '2026-11-09T18:00:00.000Z');
  });
  it('pauses only the affected claim after persistent authorization failure', async (): Promise<void> => {
    const f = setup();
    f.track.mockRejectedValue(new TrackingAuthorizationException());
    expect(await f.useCase.execute('2026-11-09T12:00:00Z', 'lease', '2026-11-09T12:05:00Z')).toBe(
      'paused',
    );
    expect(f.pause).toHaveBeenCalledWith(claim);
    expect(f.retry).not.toHaveBeenCalled();
  });
  it('does not call the provider when no work is due', async (): Promise<void> => {
    const f = setup();
    f.claimDue.mockResolvedValue(null);
    expect(await f.useCase.execute('2026-11-09T12:00:00Z', 'lease', '2026-11-09T12:05:00Z')).toBe(
      'idle',
    );
    expect(f.track).not.toHaveBeenCalled();
  });
});
