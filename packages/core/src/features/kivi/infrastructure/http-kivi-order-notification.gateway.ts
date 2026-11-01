import { HttpKiviCatalogGateway } from '@/kivi/infrastructure/http-kivi-catalog.gateway';
import type {
  KiviOrderNotificationGatewayPort,
  KiviOrderNotificationSource,
} from '@/kivi/application/ports/out/kivi-order-notification.port';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';

export class HttpKiviOrderNotificationGateway
  extends HttpKiviCatalogGateway
  implements KiviOrderNotificationGatewayPort
{
  public async deliver(
    source: KiviOrderNotificationSource,
    event: IntegrationEvent,
  ): Promise<void> {
    const result = await this.request(source.target, 'POST', '/notifications/order-status', {
      event_id: event.messageId,
      external_order_id: event.aggregateId,
      event_type: event.eventType,
      occurred_at: event.occurredAt,
      phone: source.phone,
      order_number: source.orderNumber,
    });
    if (
      typeof result !== 'object' ||
      result === null ||
      !('status' in result) ||
      (result.status !== 'processed' && result.status !== 'disabled')
    )
      throw new KiviGatewayException('transient', 200);
  }
}
