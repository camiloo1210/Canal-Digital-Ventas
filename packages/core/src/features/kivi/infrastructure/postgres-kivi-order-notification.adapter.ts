import type postgres from 'postgres';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type {
  KiviOrderNotificationReadPort,
  KiviOrderNotificationSource,
} from '@/kivi/application/ports/out/kivi-order-notification.port';
import type { KiviTokenCipherPort } from '@/kivi/application/ports/out/kivi-token-cipher.port';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';
import { KiviNotificationRecipient } from '@/kivi/domain/value-objects/kivi-notification-recipient.vo';
import { InvalidKiviNotificationRecipientException } from '@/kivi/domain/exceptions/invalid-kivi-notification-recipient.exception';

export class PostgresKiviOrderNotificationAdapter implements KiviOrderNotificationReadPort {
  public constructor(
    private readonly sql: postgres.Sql<Record<string, unknown>>,
    private readonly cipher: KiviTokenCipherPort,
  ) {}
  public async find(event: IntegrationEvent): Promise<KiviOrderNotificationSource | null> {
    try {
      const [row] = await this.sql<
        {
          base_url: string;
          connection_id: string;
          token_ciphertext: string;
          token_key_version: number;
          phone: string;
          order_number: string;
          payload_ciphertext: string | null;
          payload_key_version: number | null;
        }[]
      >`
        SELECT * FROM core.read_kivi_order_notification(${event.messageId}::uuid, ${event.tenantId}::uuid, ${event.aggregateId}::uuid, ${event.eventType})
      `;
      if (!row) return null;
      const aad = `kivi-notification:${event.tenantId}:${event.messageId}`;
      let snapshot = row.payload_ciphertext
        ? { ciphertext: row.payload_ciphertext, keyVersion: row.payload_key_version ?? 1 }
        : null;
      if (!snapshot) {
        const recipient = KiviNotificationRecipient.capture(row.phone, row.order_number);
        const encrypted = this.cipher.encrypt(JSON.stringify(recipient.toSnapshot()), aad);
        const [prepared] = await this.sql<
          { payload_ciphertext: string; payload_key_version: number }[]
        >`
          SELECT * FROM core.prepare_kivi_order_notification(${event.messageId}::uuid, ${event.tenantId}::uuid, ${event.aggregateId}::uuid, ${event.eventType}, ${encrypted.ciphertext}, ${encrypted.keyVersion}::smallint)
        `;
        if (!prepared) throw new MessagingException('Kivi notification preparation is unavailable');
        snapshot = {
          ciphertext: prepared.payload_ciphertext,
          keyVersion: prepared.payload_key_version,
        };
      }
      const captured: unknown = JSON.parse(this.cipher.decrypt(snapshot, aad));
      const recipient = KiviNotificationRecipient.reconstitute(captured);
      return {
        target: {
          baseUrl: row.base_url,
          connectionId: row.connection_id,
          token: this.cipher.decrypt(
            { ciphertext: row.token_ciphertext, keyVersion: row.token_key_version },
            event.tenantId,
          ),
        },
        ...recipient.toSnapshot(),
      };
    } catch (error: unknown) {
      if (error instanceof InvalidKiviNotificationRecipientException) {
        throw new NotificationPermanentException(`KIVI_RECIPIENT_${error.reason}`);
      }
      if (error instanceof NotificationPermanentException) throw error;
      throw new MessagingException('Unable to read Kivi notification source');
    }
  }
}
