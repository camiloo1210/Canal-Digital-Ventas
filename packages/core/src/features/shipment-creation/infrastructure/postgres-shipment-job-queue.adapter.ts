import type postgres from 'postgres';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { ShipmentJobQueuePort } from '@/shipment-creation/application/ports/out/shipment-job-queue.port';
import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class ShipmentJobQueueException extends InfrastructureException {
  public constructor(cause: unknown) {
    super('Shipment creation job persistence failed', cause);
  }
}

export class PostgresShipmentJobQueueAdapter implements ShipmentJobQueuePort {
  public async enqueue(tenantId: string, orderId: string, tx: TransactionContext): Promise<void> {
    try {
      await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(
        async (sql): Promise<void> => {
          await sql`INSERT INTO sales.shipment_creation_jobs (order_id, tenant_id)
            VALUES (${orderId}::uuid, ${tenantId}::uuid)
            ON CONFLICT (order_id) DO NOTHING`;
        },
      );
    } catch (error: unknown) {
      throw new ShipmentJobQueueException(error);
    }
  }
}
