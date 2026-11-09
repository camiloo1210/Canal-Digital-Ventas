import type postgres from 'postgres';
import type {
  ManualShipmentRepositoryPort,
  ManualShipmentWrite,
} from '@/orders/application/ports/out/manual-shipment-repository.port';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { OrderRepositoryException } from '@/orders/application/exceptions/order-repository.exception';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';

export class PostgresManualShipmentRepository implements ManualShipmentRepositoryPort {
  public async save(input: ManualShipmentWrite, tx: TransactionContext): Promise<void> {
    try {
      await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(
        async (sql): Promise<void> => {
          const rows =
            input.expectedVersion === 0
              ? await sql<
                  { version: number }[]
                >`INSERT INTO sales.manual_shipments (order_id, tenant_id, carrier, tracking_number, version)
              VALUES (${input.orderId}::uuid, ${input.tenantId}::uuid, ${input.carrier}, ${input.trackingNumber}, 1)
              ON CONFLICT (order_id) DO NOTHING RETURNING version`
              : await sql<
                  { version: number }[]
                >`UPDATE sales.manual_shipments SET carrier = ${input.carrier}, tracking_number = ${input.trackingNumber}, version = version + 1, updated_at = clock_timestamp()
              WHERE order_id = ${input.orderId}::uuid AND tenant_id = ${input.tenantId}::uuid AND version = ${input.expectedVersion} RETURNING version`;
          if (!rows[0]) throw new OptimisticConcurrencyException('Shipment', input.orderId);
          await sql`INSERT INTO sales.manual_shipment_history (order_id, tenant_id, actor_id, carrier, tracking_number, version)
          VALUES (${input.orderId}::uuid, ${input.tenantId}::uuid, ${input.actorId}::uuid, ${input.carrier}, ${input.trackingNumber}, ${rows[0].version})`;
        },
      );
    } catch (error: unknown) {
      if (error instanceof OptimisticConcurrencyException) throw error;
      throw new OrderRepositoryException('Manual shipment persistence failed.', error);
    }
  }
}
