import {
  PaymentGatewayPort,
  WebhookResult,
} from '@/payments/application/ports/out/payment-gateway.port';
import { Payment } from '@/payments/domain/entities/payment.entity';
import { PaymentStatus } from '@/payments/domain/enums/payment-status.enum';
import { PaymentId } from '@/payments/domain/types/payment-id.type';
import { InvalidWebhookSignatureException } from '@/payments/application/exceptions/invalid-webhook-signature.exception';
import { PaymentGatewayException } from '@/payments/infrastructure/exceptions/payment-gateway.exception';
import * as crypto from 'crypto';

export class LemonSqueezyAdapter implements PaymentGatewayPort {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly webhookSecret: string,
    private readonly storeId: string,
    private readonly genericVariantId: string,
  ) {}

  async createCheckoutSession(payment: Payment): Promise<string> {
    const amountInCents = Math.round(payment.getAmount().getValue() * 100);

    const response = await fetch(`${this.apiUrl}/v1/checkouts`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            custom_price: amountInCents,
            checkout_data: {
              custom: {
                payment_id: payment.getId(),
                order_id: payment.getOrderId(),
                tenant_id: payment.getTenantId(),
              },
            },
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: this.storeId,
              },
            },
            variant: {
              data: {
                type: 'variants',
                id: this.genericVariantId,
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new PaymentGatewayException(
        `Failed to create Lemon Squeezy checkout session: ${response.statusText} - ${errorData}`,
      );
    }

    const data = await response.json();
    return data.data.attributes.url;
  }

  async processWebhook(payload: string, signature: string): Promise<WebhookResult> {
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const digest = Buffer.from(hmac.update(payload).digest('hex'), 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (
      digest.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(digest, signatureBuffer)
    ) {
      throw new InvalidWebhookSignatureException('Invalid Lemon Squeezy webhook signature');
    }

    const event = JSON.parse(payload);
    const eventName = event.meta.event_name;
    const customData = event.data.attributes.meta?.custom_data || event.meta.custom_data;

    // custom_data from checkout is usually present in the order/subscription objects
    const paymentId = customData?.payment_id as PaymentId;

    if (!paymentId) {
      throw new PaymentGatewayException('Webhook payload missing payment_id in custom_data');
    }

    let status = PaymentStatus.PENDING;
    let failureReason: string | undefined;

    switch (eventName) {
      case 'order_created':
        status = PaymentStatus.COMPLETED;
        break;
      case 'order_refunded':
        status = PaymentStatus.REFUNDED;
        break;
      case 'subscription_payment_failed':
        status = PaymentStatus.FAILED;
        failureReason = 'Subscription payment failed via Lemon Squeezy';
        break;
      // Add other relevant events as needed
      default:
        // By default we don't change state for irrelevant webhooks
        break;
    }

    return {
      eventId: event.meta.webhook_id || event.data.id,
      paymentId,
      status,
      failureReason,
    };
  }
}
