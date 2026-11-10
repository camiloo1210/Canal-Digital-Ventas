import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface ShipmentLabelRecord {
  readonly state: 'queued' | 'creating' | 'done' | 'needs_attention' | 'failed';
  readonly labelPath: string | null;
}

export interface ShipmentLabelReadPort {
  /** Reads the job label state scoped by tenant AND order; null when no job exists. */
  find(
    tenantId: string,
    orderId: string,
    tx: TransactionContext,
  ): Promise<ShipmentLabelRecord | null>;
}
