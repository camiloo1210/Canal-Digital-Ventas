import { ORDER_NOTIFICATION_EVENT_TYPES } from '@canaldigital/packages/core';

type OrderEvent = { readonly eventType: string; readonly occurredAt: string };
function refundCutoff(env: Readonly<Record<string, string | undefined>>): number | null {
  const value = env.REFUND_NOTIFICATIONS_SINCE;
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
export function orderEventTypesForWorker(
  env: Readonly<Record<string, string | undefined>>,
): string[] {
  return ORDER_NOTIFICATION_EVENT_TYPES.filter(
    (eventType: string): boolean =>
      (eventType !== 'OrderShipmentUpdatedEvent' ||
        env.SHIPMENT_NOTIFICATIONS_ENABLED === 'true') &&
      (eventType !== 'OrderRefundedEvent' ||
        (env.REFUND_NOTIFICATIONS_ENABLED === 'true' && refundCutoff(env) !== null)),
  );
}
export function shouldPublishOrderEvent(
  event: OrderEvent,
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  if (event.eventType !== 'OrderRefundedEvent') return true;
  const cutoff = refundCutoff(env);
  const occurredAt = Date.parse(event.occurredAt);
  if (cutoff === null || !Number.isFinite(occurredAt))
    throw new Error('Invalid refund notification cutoff or event time.');
  return occurredAt >= cutoff;
}
