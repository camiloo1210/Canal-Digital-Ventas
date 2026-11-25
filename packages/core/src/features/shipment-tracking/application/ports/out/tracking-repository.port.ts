import type { TrackingProviderResult } from '@/shipment-tracking/application/ports/out/tracking-provider.port';

export interface TrackingClaim {
  readonly tenantId: string;
  readonly orderId: string;
  readonly environment: 'sandbox';
  readonly trackingNumber: string;
  readonly credentialRef: string;
  readonly generation: number;
  readonly attempts: number;
  readonly leaseToken: string;
}

export interface TrackingRepositoryPort {
  claimDue(now: string, leaseToken: string): Promise<TrackingClaim | null>;
  apply(
    claim: TrackingClaim,
    result: TrackingProviderResult,
    observedAt: string,
  ): Promise<'applied' | 'stale'>;
  retry(claim: TrackingClaim, retryAt: string): Promise<void>;
  pause(claim: TrackingClaim): Promise<void>;
}
