import type postgres from 'postgres';
import type {
  TrackingClaim,
  TrackingRepositoryPort,
} from '@/shipment-tracking/application/ports/out/tracking-repository.port';
import type { TrackingProviderResult } from '@/shipment-tracking/application/ports/out/tracking-provider.port';
import { mergeTrackingObservations } from '@/shipment-tracking/domain/tracking-observation';
import { TrackingRepositoryException } from '@/shipment-tracking/infrastructure/postgres-tracking-invalidation.adapter';

export class PostgresTrackingRepository implements TrackingRepositoryPort {
  public constructor(
    private readonly sql: postgres.Sql<Record<string, unknown>>,
    private readonly intervalMs: number = 1800000,
    private readonly terminalIntervalMs: number = 86400000,
  ) {
    if (
      !Number.isSafeInteger(intervalMs) ||
      intervalMs < 60000 ||
      !Number.isSafeInteger(terminalIntervalMs) ||
      terminalIntervalMs < intervalMs
    )
      throw new TrackingRepositoryException(undefined);
  }
  public async readOperationalMetrics(): Promise<{
    readonly active: number;
    readonly paused: number;
    readonly failed: number;
    readonly due: number;
    readonly oldestAgeSeconds: number | null;
  }> {
    try {
      const rows = await this.sql<
        {
          active_count: number;
          paused_count: number;
          failed_count: number;
          due_count: number;
          oldest_age_seconds: number | null;
        }[]
      >`
        SELECT count(*)::int AS active_count, count(*) FILTER (WHERE paused)::int AS paused_count,
          count(*) FILTER (WHERE last_error_at IS NOT NULL)::int AS failed_count,
          count(*) FILTER (WHERE NOT paused AND next_poll_at <= clock_timestamp())::int AS due_count,
          CASE WHEN min(last_success_at) IS NULL THEN NULL ELSE greatest(0, extract(epoch FROM clock_timestamp() - min(last_success_at)))::int END AS oldest_age_seconds
        FROM sales.shipment_tracking_links WHERE active AND environment = 'sandbox'`;
      const row = rows[0];
      if (!row) throw new TrackingRepositoryException(undefined);
      return {
        active: Number(row.active_count),
        paused: Number(row.paused_count),
        failed: Number(row.failed_count),
        due: Number(row.due_count),
        oldestAgeSeconds: row.oldest_age_seconds === null ? null : Number(row.oldest_age_seconds),
      };
    } catch (error: unknown) {
      if (error instanceof TrackingRepositoryException) throw error;
      throw new TrackingRepositoryException(error);
    }
  }
  public async purgeExpired(cutoff: string): Promise<void> {
    try {
      await this.sql`DELETE FROM sales.shipment_tracking_observations e
        WHERE e.received_at < ${cutoff}::timestamptz
          AND NOT EXISTS (SELECT 1 FROM sales.shipment_tracking_links l
            WHERE l.order_id = e.order_id AND l.tenant_id = e.tenant_id AND l.active AND l.generation = e.generation
              AND (e.id = (SELECT MAX(newest.id) FROM sales.shipment_tracking_observations newest
                WHERE newest.order_id = e.order_id AND newest.tenant_id = e.tenant_id AND newest.generation = e.generation)
                OR e.occurred_at = (SELECT MAX(newest.occurred_at) FROM sales.shipment_tracking_observations newest
                WHERE newest.order_id = e.order_id AND newest.tenant_id = e.tenant_id AND newest.generation = e.generation)
                OR e.date_only = (SELECT MAX(newest.date_only) FROM sales.shipment_tracking_observations newest
                WHERE newest.order_id = e.order_id AND newest.tenant_id = e.tenant_id AND newest.generation = e.generation)))`;
    } catch (error: unknown) {
      throw new TrackingRepositoryException(error);
    }
  }
  public async claimDue(now: string, leaseToken: string): Promise<TrackingClaim | null> {
    try {
      const rows = await this.sql<
        {
          tenant_id: string;
          order_id: string;
          tracking_number: string;
          credential_ref: string;
          generation: number;
          lease_token: string;
          attempts: number;
        }[]
      >`
        WITH candidate AS (SELECT order_id FROM sales.shipment_tracking_links
          WHERE active AND NOT paused AND environment = 'sandbox' AND EXISTS (SELECT 1 FROM sales.manual_shipments ms WHERE ms.order_id = shipment_tracking_links.order_id AND ms.tenant_id = shipment_tracking_links.tenant_id AND ms.tracking_number = shipment_tracking_links.tracking_number) AND next_poll_at <= ${now}::timestamptz
            AND (lease_until IS NULL OR lease_until <= clock_timestamp())
          ORDER BY next_poll_at, order_id FOR UPDATE SKIP LOCKED LIMIT 1)
        UPDATE sales.shipment_tracking_links l SET lease_token = ${leaseToken}::uuid,
          lease_until = clock_timestamp() + interval '2 minutes', attempts = l.attempts + 1
        FROM candidate c WHERE l.order_id = c.order_id
        RETURNING l.tenant_id, l.order_id, l.tracking_number, l.credential_ref, l.generation, l.lease_token, l.attempts`;
      const row = rows[0];
      return row
        ? {
            tenantId: row.tenant_id,
            orderId: row.order_id,
            trackingNumber: row.tracking_number,
            credentialRef: row.credential_ref,
            generation: Number(row.generation),
            attempts: Number(row.attempts),
            environment: 'sandbox',
            leaseToken: row.lease_token,
          }
        : null;
    } catch (error: unknown) {
      throw new TrackingRepositoryException(error);
    }
  }
  public async apply(
    claim: TrackingClaim,
    result: TrackingProviderResult,
    observedAt: string,
  ): Promise<'applied' | 'stale'> {
    try {
      return (await this.sql.begin(async (sql): Promise<'applied' | 'stale'> => {
        const rows = await sql<
          { order_id: string }[]
        >`SELECT order_id FROM sales.shipment_tracking_links
          WHERE order_id = ${claim.orderId}::uuid AND tenant_id = ${claim.tenantId}::uuid
            AND environment = 'sandbox' AND active AND EXISTS (SELECT 1 FROM sales.manual_shipments ms WHERE ms.order_id = shipment_tracking_links.order_id AND ms.tenant_id = shipment_tracking_links.tenant_id AND ms.tracking_number = shipment_tracking_links.tracking_number) AND generation = ${claim.generation}
            AND lease_token = ${claim.leaseToken}::uuid AND lease_until > clock_timestamp() FOR UPDATE`;
        if (!rows[0]) return 'stale';
        if (result.kind === 'found') {
          for (const event of result.observations) {
            await sql`INSERT INTO sales.shipment_tracking_observations
              (order_id, tenant_id, generation, provider_code, provider_event_id, status, occurred_at, date_only, received_at, fingerprint, mapping_version)
              VALUES (${claim.orderId}::uuid, ${claim.tenantId}::uuid, ${claim.generation}, ${event.providerCode}, ${event.providerEventId}, ${event.status}, ${event.occurredAt}::timestamptz, ${event.dateOnly}::date, ${event.receivedAt}::timestamptz, ${event.fingerprint}, ${event.mappingVersion})
              ON CONFLICT (order_id, generation, fingerprint) DO NOTHING`;
          }
        }
        const latest =
          result.kind === 'found' &&
          result.observations.every((item): boolean => item.dateOnly === null)
            ? mergeTrackingObservations([], result.observations).latest
            : null;
        const interval =
          latest && (latest.status === 'delivered' || latest.status === 'returned')
            ? this.terminalIntervalMs
            : this.intervalMs;
        await sql`UPDATE sales.shipment_tracking_links SET result = ${result.kind}, last_success_at = ${observedAt}::timestamptz, last_error_at = NULL,
          next_poll_at = clock_timestamp() + (${interval}::bigint * interval '1 millisecond' * (1 + random() * 0.1)), lease_token = NULL, lease_until = NULL, attempts = 0
          WHERE order_id = ${claim.orderId}::uuid AND tenant_id = ${claim.tenantId}::uuid AND generation = ${claim.generation} AND lease_token = ${claim.leaseToken}::uuid`;
        return 'applied';
      })) as 'applied' | 'stale';
    } catch (error: unknown) {
      throw new TrackingRepositoryException(error);
    }
  }
  public async pause(claim: TrackingClaim): Promise<void> {
    try {
      await this
        .sql`UPDATE sales.shipment_tracking_links SET paused = true, last_error_at = clock_timestamp(), lease_token = NULL, lease_until = NULL
        WHERE order_id = ${claim.orderId}::uuid AND tenant_id = ${claim.tenantId}::uuid AND generation = ${claim.generation}
          AND lease_token = ${claim.leaseToken}::uuid AND active AND lease_until > clock_timestamp()`;
    } catch (error: unknown) {
      throw new TrackingRepositoryException(error);
    }
  }
  public async retry(claim: TrackingClaim, retryAt: string): Promise<void> {
    try {
      await this
        .sql`UPDATE sales.shipment_tracking_links SET next_poll_at = ${retryAt}::timestamptz, last_error_at = clock_timestamp(), lease_token = NULL, lease_until = NULL
        WHERE order_id = ${claim.orderId}::uuid AND tenant_id = ${claim.tenantId}::uuid AND generation = ${claim.generation}
          AND lease_token = ${claim.leaseToken}::uuid AND active AND lease_until > clock_timestamp()`;
    } catch (error: unknown) {
      throw new TrackingRepositoryException(error);
    }
  }
}
