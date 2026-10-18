export const ORDER_NOTIFICATION_EVENTS = {
  OrderConfirmedEvent: 'confirmed',
  OrderPaidEvent: 'paid',
  OrderProcessingEvent: 'processing',
  OrderShippedEvent: 'shipped',
  OrderDeliveredEvent: 'delivered',
  OrderCancelledEvent: 'cancelled',
} as const;

export type OrderNotificationType =
  (typeof ORDER_NOTIFICATION_EVENTS)[keyof typeof ORDER_NOTIFICATION_EVENTS];
export const ORDER_NOTIFICATION_EVENT_TYPES: string[] = Object.keys(ORDER_NOTIFICATION_EVENTS);

export function resolveOrderNotificationType(eventType: string): OrderNotificationType | null {
  if (!Object.hasOwn(ORDER_NOTIFICATION_EVENTS, eventType)) return null;
  return ORDER_NOTIFICATION_EVENTS[eventType as keyof typeof ORDER_NOTIFICATION_EVENTS];
}
