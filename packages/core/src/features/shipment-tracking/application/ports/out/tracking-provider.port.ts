import type { TrackingObservation } from '@/shipment-tracking/domain/tracking-observation';

export type TrackingEnvironment = 'sandbox';
export type TrackingProviderResult =
  | { readonly kind: 'found'; readonly observations: readonly TrackingObservation[] }
  | { readonly kind: 'not_found' | 'unsupported' };

export interface TrackingProviderPort {
  track(input: {
    readonly trackingNumber: string;
    readonly credentialRef: string;
    readonly environment: TrackingEnvironment;
  }): Promise<TrackingProviderResult>;
}
