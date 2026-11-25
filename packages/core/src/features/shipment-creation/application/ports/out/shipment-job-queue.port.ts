import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface ShipmentJobQueuePort {
  /** Idempotently queues a carrier shipment creation job for an order inside the caller's transaction. */
  enqueue(tenantId: string, orderId: string, tx: TransactionContext): Promise<void>;
}
