import type { ShipmentPackage } from '@/shipment-creation/domain/shipment-package';
import type { ShippingOriginProps } from '@/tenants/domain/value-objects/shipping-origin.vo';

export interface ShipmentRecipient {
  readonly name: string;
  readonly phone: string;
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly country: string;
}

export interface ShipmentProviderInput {
  readonly credentialRef: string;
  readonly origin: ShippingOriginProps;
  readonly recipient: ShipmentRecipient;
  readonly package: ShipmentPackage;
  readonly accountNumber: string;
  readonly serviceType: string;
}

export interface ShipmentProviderResult {
  readonly trackingNumber: string;
  readonly labelPdf: Uint8Array;
}

export interface ShipmentProviderPort {
  /**
   * Creates one carrier shipment. Throws `ShipmentProviderRejectedException` when the carrier
   * definitely refused it (nothing was created) and `ShipmentProviderAmbiguousException` when the
   * outcome is unknown (a shipment may exist at the carrier).
   */
  create(input: ShipmentProviderInput): Promise<ShipmentProviderResult>;
}
