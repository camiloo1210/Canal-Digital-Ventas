import type postgres from 'postgres';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { TrackingActivationRepositoryPort } from '@/shipment-tracking/application/use-cases/enable-tracking.use-case';
import { TrackingRepositoryException } from '@/shipment-tracking/infrastructure/postgres-tracking-invalidation.adapter';

export class PostgresTrackingActivationAdapter implements TrackingActivationRepositoryPort {
  public constructor(
    private readonly credentialRefForTenant: (tenantId: string) => string | null,
    private readonly deploymentId: string,
  ) {}
  public async readForUpdate(
    tenantId: string,
    orderId: string,
    tx: TransactionContext,
  ): Promise<{ trackingNumber: string | null; version: number } | null> {
    try {
      return await tx.executeNative<
        postgres.TransactionSql<Record<string, unknown>>,
        { trackingNumber: string | null; version: number } | null
      >(async (sql) => {
        const rows = await sql<
          { tracking_number: string | null; version: number }[]
        >`SELECT tracking_number, version FROM sales.manual_shipments WHERE order_id = ${orderId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
        return rows[0]
          ? { trackingNumber: rows[0].tracking_number, version: Number(rows[0].version) }
          : null;
      });
    } catch (error: unknown) {
      throw new TrackingRepositoryException(error);
    }
  }
  public async disable(tenantId: string, orderId: string, tx: TransactionContext): Promise<void> {
    try {
      await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(
        async (sql): Promise<void> => {
          await sql`UPDATE sales.shipment_tracking_links SET active = false, generation = generation + 1, lease_token = NULL, lease_until = NULL
          WHERE order_id = ${orderId}::uuid AND tenant_id = ${tenantId}::uuid AND active
            AND EXISTS (SELECT 1 FROM sales.shipment_tracking_environment env WHERE env.singleton AND env.environment = 'sandbox' AND env.deployment_id = ${this.deploymentId}::uuid)`;
        },
      );
    } catch (error: unknown) {
      throw new TrackingRepositoryException(error);
    }
  }
  public async enable(
    input: {
      readonly tenantId: string;
      readonly orderId: string;
      readonly trackingNumber: string;
      readonly provider: 'fedex';
    },
    tx: TransactionContext,
  ): Promise<void> {
    const ref = this.credentialRefForTenant(input.tenantId);
    if (!ref || ref.length > 120) throw new TrackingRepositoryException(undefined);
    try {
      await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(
        async (sql): Promise<void> => {
          const rows = await sql<
            { order_id: string }[]
          >`INSERT INTO sales.shipment_tracking_links (order_id, tenant_id, tracking_number, provider, credential_ref)
          SELECT ${input.orderId}::uuid, ${input.tenantId}::uuid, ${input.trackingNumber}, ${input.provider}, ${ref}
          WHERE EXISTS (SELECT 1 FROM sales.shipment_tracking_environment env WHERE env.singleton AND env.environment = 'sandbox' AND env.deployment_id = ${this.deploymentId}::uuid)
          ON CONFLICT (order_id) DO UPDATE SET tracking_number = EXCLUDED.tracking_number, provider = EXCLUDED.provider,
            credential_ref = EXCLUDED.credential_ref, generation = sales.shipment_tracking_links.generation + 1,
            active = true, paused = false, next_poll_at = clock_timestamp(), last_success_at = NULL, last_error_at = NULL, lease_token = NULL, lease_until = NULL, attempts = 0, result = NULL
          WHERE sales.shipment_tracking_links.tenant_id = EXCLUDED.tenant_id
            AND (NOT sales.shipment_tracking_links.active OR sales.shipment_tracking_links.paused OR sales.shipment_tracking_links.tracking_number IS DISTINCT FROM EXCLUDED.tracking_number OR sales.shipment_tracking_links.credential_ref IS DISTINCT FROM EXCLUDED.credential_ref OR sales.shipment_tracking_links.provider IS DISTINCT FROM EXCLUDED.provider)
          RETURNING order_id`;
          if (rows.length !== 1) {
            const existing = await sql<
              { order_id: string }[]
            >`SELECT l.order_id FROM sales.shipment_tracking_links l
              JOIN sales.shipment_tracking_environment env ON env.singleton AND env.environment = 'sandbox' AND env.deployment_id = ${this.deploymentId}::uuid
              WHERE l.order_id = ${input.orderId}::uuid AND l.tenant_id = ${input.tenantId}::uuid AND l.active
                AND l.tracking_number = ${input.trackingNumber} AND l.provider = ${input.provider} AND l.credential_ref = ${ref}`;
            if (existing.length !== 1) throw new TrackingRepositoryException(undefined);
          }
        },
      );
    } catch (error: unknown) {
      if (error instanceof TrackingRepositoryException) throw error;
      throw new TrackingRepositoryException(error);
    }
  }
}
