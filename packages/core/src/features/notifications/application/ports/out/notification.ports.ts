import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type { OrderNotificationType } from '@/notifications/application/notification-events';

export type NotificationLocale = 'es' | 'en';
export interface OrderNotificationRecipient {
  email: string;
  orderNumber: string;
  tenantName: string;
}
export interface OrderNotificationReadPort {
  findRecipient(tenantId: string, orderId: string): Promise<OrderNotificationRecipient | null>;
}
export interface NotificationEmail extends OrderNotificationRecipient {
  messageId: string;
  type: OrderNotificationType;
  locale: NotificationLocale;
}
export interface NotificationEmailPort {
  send(email: NotificationEmail): Promise<void>;
}
export type DeliveryClaim = 'CLAIMED' | 'SENT' | 'BUSY' | 'DEAD';
export interface NotificationDeliveryPort {
  claim(event: IntegrationEvent): Promise<DeliveryClaim>;
  complete(messageId: string): Promise<void>;
  fail(messageId: string, terminal: boolean): Promise<void>;
}
export interface NotificationCopy {
  subjects: Record<OrderNotificationType, string>;
  body: string;
}
export type NotificationCopies = Record<NotificationLocale, NotificationCopy>;
