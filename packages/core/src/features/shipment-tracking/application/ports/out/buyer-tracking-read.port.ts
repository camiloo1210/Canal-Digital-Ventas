import type { TrackingReadModel } from '@/shipment-tracking/application/tracking-read-model';
export interface BuyerTrackingReadPort {
  findByBuyer(
    buyerId: string,
    orderId: string,
    deploymentId: string,
  ): Promise<TrackingReadModel | null>;
}
