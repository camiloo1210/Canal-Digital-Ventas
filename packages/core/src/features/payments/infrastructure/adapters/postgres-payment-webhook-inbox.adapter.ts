import type postgres from 'postgres';
import type {
  IngestPaymentWebhookDto,
  PaymentWebhookInboxPort,
  PaymentWebhookReceipt,
} from '@/payments/application/ports/out/payment-webhook-inbox.port';
import type { PaymentEnvironment } from '@/payments/application/ports/out/provider-checkout.port';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

export class PostgresPaymentWebhookInboxAdapter implements PaymentWebhookInboxPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async ingest(
    input: IngestPaymentWebhookDto,
    environment: PaymentEnvironment,
  ): Promise<PaymentWebhookReceipt> {
    try {
      const rows = await this.sql<
        { outcome: PaymentWebhookReceipt['outcome']; event_id: string | null }[]
      >`
        SELECT * FROM sales.ingest_payment_webhook_event(
          decode(${input.payloadBase64}, 'base64'), ${input.signature}::text, ${input.eventName}::text, ${environment}::text
        )
      `;
      const row = rows[0];
      if (
        !row ||
        ![
          'ACCEPTED',
          'DUPLICATE',
          'IGNORED',
          'INVALID_SIGNATURE',
          'MALFORMED',
          'CHANNEL_MISMATCH',
        ].includes(row.outcome) ||
        (['ACCEPTED', 'DUPLICATE'].includes(row.outcome) && !row.event_id)
      ) {
        throw new PaymentRepositoryException('Invalid durable webhook receipt.');
      }
      return { outcome: row.outcome, eventId: row.event_id };
    } catch (error: unknown) {
      if (error instanceof PaymentRepositoryException) throw error;
      throw new PaymentRepositoryException('Unable to persist the payment webhook.', error);
    }
  }
}
