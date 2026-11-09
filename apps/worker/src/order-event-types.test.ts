import { describe, expect, it } from 'vitest';
import { orderEventTypesForWorker, shouldPublishOrderEvent } from '@/worker/order-event-types';

describe('order event rollout', (): void => {
  it('keeps the new route disabled until it is explicitly enabled', (): void => {
    expect(orderEventTypesForWorker({})).not.toContain('OrderShipmentUpdatedEvent');
    expect(orderEventTypesForWorker({})).toContain('OrderShippedEvent');
    expect(orderEventTypesForWorker({})).not.toContain('OrderRefundedEvent');
    expect(orderEventTypesForWorker({ REFUND_NOTIFICATIONS_ENABLED: 'true' })).not.toContain(
      'OrderRefundedEvent',
    );
    expect(
      shouldPublishOrderEvent(
        { eventType: 'OrderRefundedEvent', occurredAt: '2026-11-07T00:00:00Z' },
        { REFUND_NOTIFICATIONS_SINCE: '2026-11-08T00:00:00Z' },
      ),
    ).toBe(false);
    expect(
      shouldPublishOrderEvent(
        { eventType: 'OrderRefundedEvent', occurredAt: '2026-11-09T00:00:00Z' },
        { REFUND_NOTIFICATIONS_SINCE: '2026-11-08T00:00:00Z' },
      ),
    ).toBe(true);
    expect(
      orderEventTypesForWorker({
        REFUND_NOTIFICATIONS_ENABLED: 'true',
        REFUND_NOTIFICATIONS_SINCE: '2026-11-08T00:00:00Z',
      }),
    ).toContain('OrderRefundedEvent');
    expect(orderEventTypesForWorker({ SHIPMENT_NOTIFICATIONS_ENABLED: 'true' })).toContain(
      'OrderShipmentUpdatedEvent',
    );
  });
});
