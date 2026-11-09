import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface ManualShipmentWrite {
  readonly orderId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly expectedVersion: number;
  readonly carrier: string | null;
  readonly trackingNumber: string | null;
}
export interface ManualShipmentRepositoryPort {
  save(input: ManualShipmentWrite, tx: TransactionContext): Promise<void>;
}
