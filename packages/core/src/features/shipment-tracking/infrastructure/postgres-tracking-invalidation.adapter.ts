import type postgres from 'postgres';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { ShipmentTrackingInvalidationPort } from '@/orders/application/use-cases/register-manual-shipment.use-case';
import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class TrackingRepositoryException extends InfrastructureException {
  public constructor(cause: unknown) {
    super('Tracking persistence failed', cause);
  }
}
export class PostgresTrackingInvalidationAdapter implements ShipmentTrackingInvalidationPort {
  public async invalidateIfChanged(
    tenantId: string,
    orderId: string,
    trackingNumber: string | null,
    tx: TransactionContext,
  ): Promise<void> {
    try {
      await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(
        async (sql): Promise<void> => {
          await sql`UPDATE sales.shipment_tracking_links SET active = false, generation = generation + 1, lease_token = NULL, lease_until = NULL
          WHERE order_id = ${orderId}::uuid AND tenant_id = ${tenantId}::uuid
            AND active AND tracking_number IS DISTINCT FROM ${trackingNumber}`;
        },
      );
    } catch (error: unknown) {
      throw new TrackingRepositoryException(error);
    }
  }
}
