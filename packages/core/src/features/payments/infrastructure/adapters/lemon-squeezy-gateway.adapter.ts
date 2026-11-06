import {
  PaymentGatewayPort,
  WebhookResult,
} from '@/payments/application/ports/out/payment-gateway.port';
import { Payment } from '@/payments/domain/entities/payment.entity';
import { PaymentStatus } from '@/payments/domain/enums/payment-status.enum';
import { createPaymentId } from '@/payments/domain/types/payment-id.type';
import { InvalidWebhookSignatureException } from '@/payments/application/exceptions/invalid-webhook-signature.exception';
import { PaymentGatewayException } from '@/payments/application/exceptions/payment-gateway.exception';
import * as crypto from 'crypto';
import { toProviderMinorUnits } from '@/payments/infrastructure/lemon-squeezy-amount';
import { Currency } from '@/shared/domain/enums/currency.enum';

function providerRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PaymentGatewayException('Malformed payment provider response.');
  }
  return value as Record<string, unknown>;
}

export class LemonSqueezyAdapter implements PaymentGatewayPort {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly webhookSecret: string,
    private readonly storeId: string,
    private readonly genericVariantId: string,
    private readonly storeCurrency: Currency,
  ) {}

  async createCheckoutSession(payment: Payment): Promise<string> {
    const amountInCents = toProviderMinorUnits(
      payment.getAmount().getValue(),
      payment.getAmount().getCurrency(),
    );
    if (payment.getAmount().getCurrency() !== this.storeCurrency) {
      throw new PaymentGatewayException('Payment currency does not match the configured store.');
    }

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
            // Smallest currency unit (see toProviderMinorUnits).
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

    const body: unknown = await response.json();
    const attributes = providerRecord(providerRecord(providerRecord(body).data).attributes);
    if (typeof attributes.url !== 'string') {
      throw new PaymentGatewayException('Checkout response is missing its URL.');
    }
    return attributes.url;
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

    const parsed: unknown = JSON.parse(payload);
    const event = providerRecord(parsed);
    const meta = providerRecord(event.meta);
    const data = providerRecord(event.data);
    const attributes = providerRecord(data.attributes);
    const eventName = meta.event_name;
    const customData = providerRecord(
      (attributes.meta ? providerRecord(attributes.meta).custom_data : undefined) ??
        meta.custom_data,
    );

    // custom_data from checkout is usually present in the order/subscription objects
    if (typeof customData.payment_id !== 'string' || customData.payment_id.trim() === '') {
      throw new PaymentGatewayException('Webhook payload missing payment_id in custom_data');
    }
    const paymentId = createPaymentId(customData.payment_id);
    const eventId = meta.webhook_id ?? data.id;
    if (typeof eventId !== 'string' || eventId.length === 0) {
      throw new PaymentGatewayException('Webhook payload missing its event ID.');
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

    // order_created carries the amount actually charged (smallest currency unit) and its currency;
    // the use case compares them with the stored payment before completing it.
    const paidAmount =
      typeof attributes.total === 'number' && Number.isSafeInteger(attributes.total)
        ? attributes.total
        : undefined;
    const paidCurrency =
      typeof attributes.currency === 'string' ? attributes.currency.toUpperCase() : undefined;

    return {
      eventId,
      paymentId,
      status,
      failureReason,
      paidAmount,
      paidCurrency,
    };
  }
}
