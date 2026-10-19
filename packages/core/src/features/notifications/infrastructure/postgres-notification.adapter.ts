import type postgres from 'postgres';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';
import { parseNotificationOrder } from '@/notifications/infrastructure/notification-order-projection';
import type {
  DeliveryClaim,
  NotificationDeliveryPort,
  OrderNotificationReadPort,
  OrderNotificationRecipient,
} from '@/notifications/application/ports/out/notification.ports';

export class PostgresNotificationAdapter
  implements NotificationDeliveryPort, OrderNotificationReadPort
{
  constructor(
    private readonly sql: postgres.Sql<Record<string, unknown>>,
    private readonly owner: string,
  ) {}

  public async claim(event: IntegrationEvent): Promise<DeliveryClaim> {
    try {
      const [row] = await this.sql<{ result: DeliveryClaim | 'INVALID' }[]>`
        SELECT core.claim_notification_delivery(${event.messageId}::uuid, ${event.tenantId}::uuid,
          ${event.aggregateId}::uuid, ${event.eventType}, ${this.owner}::uuid) AS result
      `;
      if (!row || row.result === 'INVALID')
        throw new NotificationPermanentException('INVALID_NOTIFICATION_EVENT');
      return row.result;
    } catch (error: unknown) {
      if (error instanceof NotificationPermanentException) throw error;
      throw new MessagingException('Unable to claim notification delivery', error);
    }
  }

  public async findRecipient(
    tenantId: string,
    orderId: string,
  ): Promise<OrderNotificationRecipient | null> {
    try {
      const [row] = await this.sql<
        { email: string; order_number: string; tenant_name: string; details: unknown }[]
      >`
        SELECT r.*, core.read_order_notification_details(${tenantId}::uuid, ${orderId}::uuid) AS details
        FROM core.read_order_notification(${tenantId}::uuid, ${orderId}::uuid) r
      `;
      return row
        ? {
            email: row.email,
            orderNumber: row.order_number,
            tenantName: row.tenant_name,
            order: parseNotificationOrder(row.details),
          }
        : null;
    } catch (error: unknown) {
      throw new MessagingException('Unable to read notification recipient', error);
    }
  }

  public async complete(messageId: string): Promise<void> {
    await this.finish(messageId, 'SENT');
  }
  public async fail(messageId: string, terminal: boolean): Promise<void> {
    await this.finish(messageId, terminal ? 'DEAD' : 'RETRY');
  }

  private async finish(messageId: string, state: string): Promise<void> {
    try {
      const [row] = await this.sql<{ accepted: boolean }[]>`
        SELECT core.finish_notification_delivery(${messageId}::uuid, ${this.owner}::uuid, ${state}) AS accepted
      `;
      if (!row?.accepted) throw new MessagingException('Notification delivery lease was lost');
    } catch (error: unknown) {
      if (error instanceof MessagingException) throw error;
      throw new MessagingException('Unable to update notification delivery', error);
    }
  }
}
