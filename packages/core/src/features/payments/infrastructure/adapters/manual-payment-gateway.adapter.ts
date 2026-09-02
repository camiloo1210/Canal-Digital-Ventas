import {
  PaymentGatewayPort,
  WebhookResult,
} from '@/payments/application/ports/out/payment-gateway.port';
import { Payment } from '@/payments/domain/entities/payment.entity';
import { PaymentGatewayException } from '@/payments/infrastructure/exceptions/payment-gateway.exception';

export class ManualPaymentGatewayAdapter implements PaymentGatewayPort {
  constructor(private readonly appUrl: string) {}

  async createCheckoutSession(payment: Payment): Promise<string> {
    return `${this.appUrl}/checkout/manual/${payment.getId()}`;
  }

  async processWebhook(): Promise<WebhookResult> {
    throw new PaymentGatewayException('Manual payment gateway does not support external webhooks');
  }
}
