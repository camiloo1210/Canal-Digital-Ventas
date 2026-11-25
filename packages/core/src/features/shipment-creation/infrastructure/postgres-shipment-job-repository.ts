import type postgres from 'postgres';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type {
  ClaimedJob,
  ShipmentJobRepositoryPort,
  ShipmentNeedsAttentionReason,
} from '@/shipment-creation/application/ports/out/shipment-job-repository.port';
import { LABEL_UNAVAILABLE_REASON } from '@/shipment-creation/application/ports/out/shipment-job-repository.port';
import { ShipmentRetryNotAllowedException } from '@/shipment-creation/application/exceptions/shipment-retry-not-allowed.exception';
import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class ShipmentJobRepositoryException extends InfrastructureException {
  public constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'ShipmentJobRepositoryException';
  }
}

const MAX_REASON_LENGTH = 80;
const SAFE_REASON = /^[A-Z0-9][A-Z0-9._-]*$/;

function safeReason(reason: string): string {
  return reason.length <= MAX_REASON_LENGTH && SAFE_REASON.test(reason)
    ? reason
    : 'PROVIDER_REJECTED';
}

export class PostgresShipmentJobRepository implements ShipmentJobRepositoryPort {
  public constructor(
    private readonly sql: postgres.Sql<Record<string, unknown>>,
    private readonly newToken: () => string = (): string => crypto.randomUUID(),
  ) {}

  public async claimNext(now: Date, leaseSeconds: number): Promise<ClaimedJob | null> {
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 3600)
      throw new ShipmentJobRepositoryException('Invalid shipment job lease');
    try {
      const rows = await this.sql<
        {
          tenant_id: string;
          order_id: string;
          lease_token: string;
          attempts: number;
          claimed_from: 'queued' | 'creating';
        }[]
      >`
        WITH candidate AS (SELECT order_id, state FROM sales.shipment_creation_jobs
          WHERE state IN ('queued', 'creating')
            AND (lease_until IS NULL OR lease_until <= ${now.toISOString()}::timestamptz)
          ORDER BY updated_at, order_id FOR UPDATE SKIP LOCKED LIMIT 1)
        UPDATE sales.shipment_creation_jobs j SET lease_token = ${this.newToken()}::uuid,
          lease_until = clock_timestamp() + (${leaseSeconds}::int * interval '1 second'),
          attempts = j.attempts + 1, version = j.version + 1, updated_at = clock_timestamp()
        FROM candidate c WHERE j.order_id = c.order_id
        RETURNING j.tenant_id, j.order_id, j.lease_token, j.attempts, c.state AS claimed_from`;
      const row = rows[0];
      return row
        ? {
            tenantId: row.tenant_id,
            orderId: row.order_id,
            leaseToken: row.lease_token,
            leaseSeconds,
            attempts: Number(row.attempts),
            claimedFrom: row.claimed_from,
          }
        : null;
    } catch (error: unknown) {
      throw new ShipmentJobRepositoryException('Shipment job claim failed', error);
    }
  }

  public async markCreating(job: ClaimedJob): Promise<boolean> {
    try {
      const rows = await this.sql<{ order_id: string }[]>`
        UPDATE sales.shipment_creation_jobs SET state = 'creating', reason = NULL,
          lease_until = clock_timestamp() + (${job.leaseSeconds}::int * interval '1 second'),
          version = version + 1, updated_at = clock_timestamp()
        WHERE order_id = ${job.orderId}::uuid AND tenant_id = ${job.tenantId}::uuid
          AND state = 'queued' AND lease_token = ${job.leaseToken}::uuid
          AND lease_until > clock_timestamp()
        RETURNING order_id`;
      return rows.length === 1;
    } catch (error: unknown) {
      throw new ShipmentJobRepositoryException('Shipment job transition failed', error);
    }
  }

  public async complete(
    job: ClaimedJob,
    labelPath: string | null,
    tx: TransactionContext,
  ): Promise<void> {
    if (labelPath !== null && !labelPath.startsWith(`${job.tenantId}/`))
      throw new ShipmentJobRepositoryException('Label path outside tenant folder');
    try {
      await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(
        async (sql): Promise<void> => {
          const rows = await sql<{ order_id: string }[]>`
            UPDATE sales.shipment_creation_jobs SET state = 'done',
              reason = ${labelPath === null ? LABEL_UNAVAILABLE_REASON : null},
              label_path = ${labelPath}, lease_token = NULL, lease_until = NULL,
              version = version + 1, updated_at = clock_timestamp()
            WHERE order_id = ${job.orderId}::uuid AND tenant_id = ${job.tenantId}::uuid
              AND state = 'creating' AND lease_token = ${job.leaseToken}::uuid
            RETURNING order_id`;
          if (rows.length !== 1)
            throw new ShipmentJobRepositoryException('Shipment job lease lost');
        },
      );
    } catch (error: unknown) {
      if (error instanceof ShipmentJobRepositoryException) throw error;
      throw new ShipmentJobRepositoryException('Shipment job completion failed', error);
    }
  }

  public async markNeedsAttention(
    job: ClaimedJob,
    reason: ShipmentNeedsAttentionReason,
    providerTrackingNumber?: string,
  ): Promise<void> {
    await this.finish(job, 'needs_attention', reason, providerTrackingNumber ?? null);
  }

  public async markFailed(job: ClaimedJob, reason: string): Promise<void> {
    await this.finish(job, 'failed', safeReason(reason), null);
  }

  private async finish(
    job: ClaimedJob,
    state: 'needs_attention' | 'failed',
    reason: string,
    providerTrackingNumber: string | null,
  ): Promise<void> {
    try {
      await this.sql`
        UPDATE sales.shipment_creation_jobs SET state = ${state}, reason = ${reason},
          provider_tracking_number = COALESCE(${providerTrackingNumber}, provider_tracking_number),
          lease_token = NULL, lease_until = NULL, version = version + 1, updated_at = clock_timestamp()
        WHERE order_id = ${job.orderId}::uuid AND tenant_id = ${job.tenantId}::uuid
          AND state IN ('queued', 'creating') AND lease_token = ${job.leaseToken}::uuid`;
    } catch (error: unknown) {
      throw new ShipmentJobRepositoryException('Shipment job transition failed', error);
    }
  }

  public async recordProviderTrackingNumber(
    job: ClaimedJob,
    trackingNumber: string,
  ): Promise<void> {
    try {
      // Deliberately not fenced by lease_token: the shipment already exists at the carrier.
      await this.sql`
        UPDATE sales.shipment_creation_jobs SET provider_tracking_number = ${trackingNumber},
          updated_at = clock_timestamp()
        WHERE order_id = ${job.orderId}::uuid AND tenant_id = ${job.tenantId}::uuid
          AND state <> 'done' AND provider_tracking_number IS NULL`;
    } catch (error: unknown) {
      throw new ShipmentJobRepositoryException('Shipment job tracking number record failed', error);
    }
  }

  public async retry(tenantId: string, orderId: string, actorId: string): Promise<boolean> {
    let row: { updated: number; blocked: number } | undefined;
    try {
      const rows = await this.sql<{ updated: number; blocked: number }[]>`
        WITH target AS (SELECT j.order_id, j.provider_tracking_number FROM sales.shipment_creation_jobs j
          WHERE j.order_id = ${orderId}::uuid AND j.tenant_id = ${tenantId}::uuid
            AND j.state IN ('needs_attention', 'failed')
            AND core.member_has_permission(${actorId}::uuid, j.tenant_id, ARRAY['MANAGE_ORDERS']::text[])
          FOR UPDATE),
        updated AS (UPDATE sales.shipment_creation_jobs j SET state = 'queued', reason = NULL,
            lease_token = NULL, lease_until = NULL, version = j.version + 1, updated_at = clock_timestamp()
          FROM target t WHERE j.order_id = t.order_id AND t.provider_tracking_number IS NULL
          RETURNING j.order_id)
        SELECT (SELECT count(*) FROM updated)::int AS updated,
          (SELECT count(*) FROM target WHERE provider_tracking_number IS NOT NULL)::int AS blocked`;
      row = rows[0];
    } catch (error: unknown) {
      throw new ShipmentJobRepositoryException('Shipment job retry failed', error);
    }
    if (row && Number(row.blocked) > 0) throw new ShipmentRetryNotAllowedException();
    return Number(row?.updated ?? 0) === 1;
  }
}
