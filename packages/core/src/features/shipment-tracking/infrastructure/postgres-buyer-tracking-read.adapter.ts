import type postgres from 'postgres';
import type {
  TrackingEventReadModel,
  TrackingReadModel,
} from '@/shipment-tracking/application/tracking-read-model';
import { projectTrackingState } from '@/shipment-tracking/application/tracking-read-model';
import type { TrackingStatus } from '@/shipment-tracking/domain/tracking-observation';
import { TrackingRepositoryException } from '@/shipment-tracking/infrastructure/postgres-tracking-invalidation.adapter';

export class PostgresBuyerTrackingReadAdapter {
  public constructor(
    private readonly sql: postgres.Sql<Record<string, unknown>>,
    private readonly now: string,
  ) {}
  public async findByBuyer(
    buyerId: string,
    orderId: string,
    deploymentId: string,
  ): Promise<TrackingReadModel | null> {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(buyerId) || !uuid.test(orderId) || !uuid.test(deploymentId)) return null;
    try {
      const rows = await this.sql<
        {
          active: boolean;
          paused: boolean;
          result: 'found' | 'not_found' | 'unsupported' | null;
          last_success_at: Date | null;
          last_error_at: Date | null;
          events: TrackingEventReadModel[];
        }[]
      >`
        SELECT l.active, l.paused, l.result, l.last_success_at, l.last_error_at,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('status', e.status, 'occurredAt', e.occurred_at, 'dateOnly', e.date_only) ORDER BY COALESCE(e.date_only, (e.occurred_at AT TIME ZONE 'UTC')::date) DESC NULLS LAST, e.occurred_at DESC NULLS LAST, e.id DESC)
            FROM sales.shipment_tracking_observations e
            WHERE e.order_id = l.order_id AND e.tenant_id = l.tenant_id AND e.generation = l.generation), '[]'::jsonb) AS events
        FROM sales.shipment_tracking_links l
        JOIN sales.manual_shipments ms ON ms.order_id = l.order_id AND ms.tenant_id = l.tenant_id AND ms.tracking_number = l.tracking_number
        JOIN sales.orders o ON o.id = l.order_id AND o.tenant_id = l.tenant_id
        JOIN sales.customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
        JOIN sales.shipment_tracking_environment env ON env.singleton AND env.environment = l.environment
        WHERE o.id = ${orderId}::uuid AND c.global_auth_id = ${buyerId}::uuid
          AND env.deployment_id = ${deploymentId}::uuid AND l.environment = 'sandbox'`;
      const row = rows[0];
      if (!row) return null;
      const lastSuccessfulAt = row.last_success_at
        ? new Date(row.last_success_at).toISOString()
        : null;
      const validStatuses: readonly TrackingStatus[] = [
        'unknown',
        'label_created',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'exception',
        'returned',
      ];
      const events = row.events.map((event): TrackingEventReadModel => ({
        status: validStatuses.includes(event.status) ? event.status : 'unknown',
        occurredAt: event.occurredAt,
        dateOnly: event.dateOnly,
      }));
      return {
        state: projectTrackingState(
          {
            active: row.active,
            paused: row.paused,
            result: row.result,
            lastSuccessfulAt,
            lastErrorAt: row.last_error_at ? new Date(row.last_error_at).toISOString() : null,
          },
          this.now,
          7200000,
        ),
        lastSuccessfulAt,
        events,
      };
    } catch (error: unknown) {
      throw new TrackingRepositoryException(error);
    }
  }
}
