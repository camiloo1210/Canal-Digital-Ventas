import type { PaymentEnvironment } from '@/payments/application/ports/out/provider-checkout.port';

export interface IngestPaymentWebhookDto {
  readonly payloadBase64: string;
  readonly signature: string;
  readonly eventName: string;
}

export interface PaymentWebhookReceipt {
  readonly outcome:
    'ACCEPTED' | 'DUPLICATE' | 'IGNORED' | 'INVALID_SIGNATURE' | 'MALFORMED' | 'CHANNEL_MISMATCH';
  readonly eventId: string | null;
}

export interface PaymentWebhookInboxPort {
  ingest(
    input: IngestPaymentWebhookDto,
    environment: PaymentEnvironment,
  ): Promise<PaymentWebhookReceipt>;
}
