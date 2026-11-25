import type { ShipmentPackageItem } from '@/shipment-creation/domain/shipment-package';
import type { ShipmentRecipient } from '@/shipment-creation/application/ports/out/shipment-provider.port';

export interface ShipmentCreationSource {
  readonly orderStatus: string;
  /** True when the order already has a recorded tracking number (e.g. typed by the seller). */
  readonly hasRecordedShipment: boolean;
  readonly recipient: ShipmentRecipient;
  readonly items: readonly ShipmentPackageItem[];
}

export interface ShipmentCreationSourcePort {
  /** Loads the order recipient and its items' package data; null when the order is not visible. */
  load(tenantId: string, orderId: string): Promise<ShipmentCreationSource | null>;
}
