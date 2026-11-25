import type postgres from 'postgres';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type {
  ShipmentLabelReadPort,
  ShipmentLabelRecord,
} from '@/shipment-creation/application/ports/out/shipment-label-read.port';
import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class ShipmentLabelReadException extends InfrastructureException {
  public constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'ShipmentLabelReadException';
  }
}

export class PostgresShipmentLabelReadAdapter implements ShipmentLabelReadPort {
  public async find(
    tenantId: string,
    orderId: string,
    tx: TransactionContext,
  ): Promise<ShipmentLabelRecord | null> {
    try {
      return await tx.executeNative<
        postgres.TransactionSql<Record<string, unknown>>,
        ShipmentLabelRecord | null
      >(async (sql): Promise<ShipmentLabelRecord | null> => {
        const rows = await sql<
          { state: ShipmentLabelRecord['state']; label_path: string | null }[]
        >`
          SELECT state, label_path FROM sales.shipment_creation_jobs
          WHERE order_id = ${orderId}::uuid AND tenant_id = ${tenantId}::uuid`;
        const row = rows[0];
        return row ? { state: row.state, labelPath: row.label_path } : null;
      });
    } catch (error: unknown) {
      throw new ShipmentLabelReadException('Shipment label lookup failed', error);
    }
  }
}
