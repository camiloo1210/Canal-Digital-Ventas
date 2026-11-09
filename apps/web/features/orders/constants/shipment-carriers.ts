/** Carriers a seller can pick. Add more here as providers are supported. */
export const SHIPMENT_CARRIERS = ['FedEx'] as const;

export type ShipmentCarrier = (typeof SHIPMENT_CARRIERS)[number];
