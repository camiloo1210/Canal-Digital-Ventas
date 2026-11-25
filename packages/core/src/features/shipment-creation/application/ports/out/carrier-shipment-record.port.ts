import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface CarrierShipmentRecord {
  readonly tenantId: string;
  readonly orderId: string;
  readonly carrier: 'FedEx';
  readonly trackingNumber: string;
  readonly actorId: string;
}

export interface CarrierShipmentRecordPort {
  /** Upserts the order shipment (carrier + tracking number) with a new version and history row. */
  record(input: CarrierShipmentRecord, tx: TransactionContext): Promise<void>;
}
