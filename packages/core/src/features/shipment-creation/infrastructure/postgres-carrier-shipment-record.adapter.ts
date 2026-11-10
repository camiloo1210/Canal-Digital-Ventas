import type postgres from 'postgres';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type {
  CarrierShipmentRecord,
  CarrierShipmentRecordPort,
} from '@/shipment-creation/application/ports/out/carrier-shipment-record.port';
import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class CarrierShipmentRecordException extends InfrastructureException {
  public constructor(cause: unknown) {
    super('Carrier shipment persistence failed', cause);
    this.name = 'CarrierShipmentRecordException';
  }
}

/**
 * Mirrors PostgresManualShipmentRepository: every write bumps `version` and appends the
 * matching `manual_shipment_history` row, so seller views and optimistic checks stay consistent.
 */
export class PostgresCarrierShipmentRecordAdapter implements CarrierShipmentRecordPort {
  public async record(input: CarrierShipmentRecord, tx: TransactionContext): Promise<void> {
    try {
      await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(
        async (sql): Promise<void> => {
          const rows = await sql<{ version: number }[]>`
            INSERT INTO sales.manual_shipments (order_id, tenant_id, carrier, tracking_number, version)
            VALUES (${input.orderId}::uuid, ${input.tenantId}::uuid, ${input.carrier}, ${input.trackingNumber}, 1)
            ON CONFLICT (order_id) DO UPDATE SET carrier = EXCLUDED.carrier,
              tracking_number = EXCLUDED.tracking_number,
              version = sales.manual_shipments.version + 1, updated_at = clock_timestamp()
            WHERE sales.manual_shipments.tenant_id = EXCLUDED.tenant_id
            RETURNING version`;
          if (!rows[0]) throw new CarrierShipmentRecordException(undefined);
          await sql`INSERT INTO sales.manual_shipment_history (order_id, tenant_id, actor_id, carrier, tracking_number, version)
            VALUES (${input.orderId}::uuid, ${input.tenantId}::uuid, ${input.actorId}::uuid, ${input.carrier}, ${input.trackingNumber}, ${rows[0].version})`;
        },
      );
    } catch (error: unknown) {
      if (error instanceof CarrierShipmentRecordException) throw error;
      throw new CarrierShipmentRecordException(error);
    }
  }
}
