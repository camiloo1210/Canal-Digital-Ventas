import type {
  IngestPaymentWebhookDto,
  PaymentWebhookInboxPort,
  PaymentWebhookReceipt,
} from '@/payments/application/ports/out/payment-webhook-inbox.port';
import type { PaymentEnvironment } from '@/payments/application/ports/out/provider-checkout.port';

/** Durability and authentication belong to the inbox adapter, never to an unverified browser. */
export class IngestPaymentWebhookUseCase {
  public constructor(
    private readonly inbox: PaymentWebhookInboxPort,
    private readonly environment: PaymentEnvironment,
  ) {}

  public async execute(input: IngestPaymentWebhookDto): Promise<PaymentWebhookReceipt> {
    return this.inbox.ingest(input, this.environment);
  }
}
