import type { TrackingReadModel } from '@/shipment-tracking/application/tracking-read-model';
export interface SellerTrackingReadPort {
  findBySeller(
    actorId: string,
    tenantId: string,
    orderId: string,
    deploymentId: string,
  ): Promise<TrackingReadModel | null>;
}
