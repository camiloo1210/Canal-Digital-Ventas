import { TrackingAuthorizationException } from '@/shipment-tracking/application/tracking-authorization.exception';
import type { TrackingProviderPort } from '@/shipment-tracking/application/ports/out/tracking-provider.port';
import type { TrackingRepositoryPort } from '@/shipment-tracking/application/ports/out/tracking-repository.port';

export class PollTrackingUseCase {
  public constructor(
    private readonly repository: TrackingRepositoryPort,
    private readonly provider: TrackingProviderPort,
    private readonly clock: () => string = (): string => new Date().toISOString(),
    private readonly random: () => number = Math.random,
  ) {}

  public async execute(
    now: string,
    leaseToken: string,
    retryAt: string,
  ): Promise<'idle' | 'applied' | 'stale' | 'paused'> {
    const claim = await this.repository.claimDue(now, leaseToken);
    if (!claim) return 'idle';
    try {
      const result = await this.provider.track({
        trackingNumber: claim.trackingNumber,
        credentialRef: claim.credentialRef,
        environment: claim.environment,
      });
      return await this.repository.apply(claim, result, this.clock());
    } catch (error: unknown) {
      if (error instanceof TrackingAuthorizationException) {
        await this.repository.pause(claim);
        return 'paused';
      }
      let nextAttempt = retryAt;
      const baseTime = Date.parse(this.clock());
      const baseBackoff = Math.min(
        21600000,
        60000 * 2 ** Math.min(9, Math.max(0, claim.attempts - 1)),
      );
      const random = this.random();
      const jitter = Number.isFinite(random) ? Math.min(1, Math.max(0, random)) : 0;
      const backoff = Math.min(21600000, Math.round(baseBackoff * (1 + jitter * 0.1)));
      if (Number.isFinite(baseTime) && baseTime + backoff > Date.parse(nextAttempt))
        nextAttempt = new Date(baseTime + backoff).toISOString();
      if (
        typeof error === 'object' &&
        error !== null &&
        'retryAfterSeconds' in error &&
        typeof error.retryAfterSeconds === 'number' &&
        Number.isSafeInteger(error.retryAfterSeconds) &&
        error.retryAfterSeconds >= 0
      ) {
        const minimum = Date.parse(this.clock()) + error.retryAfterSeconds * 1000;
        if (
          Number.isFinite(minimum) &&
          minimum > Date.parse(nextAttempt) &&
          minimum <= 8640000000000000
        )
          nextAttempt = new Date(minimum).toISOString();
      }
      await this.repository.retry(claim, nextAttempt);
      throw error;
    }
  }
}
