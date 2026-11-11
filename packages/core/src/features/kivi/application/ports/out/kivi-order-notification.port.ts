import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';

export interface KiviOrderNotificationSource {
  target: KiviTarget;
  phone: string;
  orderNumber: string;
  /** Ready-to-send WhatsApp text (no Meta template). Absent: Kivi writes its own short text. */
  message?: string;
}
export interface KiviOrderNotificationReadPort {
  find(event: IntegrationEvent): Promise<KiviOrderNotificationSource | null>;
}
export interface KiviOrderNotificationGatewayPort {
  deliver(source: KiviOrderNotificationSource, event: IntegrationEvent): Promise<void>;
}
