import { Payment } from '@/payments/domain/entities/payment.entity';
import { PaymentId } from '@/payments/domain/types/payment-id.type';
import { PaymentStatus } from '@/payments/domain/enums/payment-status.enum';

export interface WebhookResult {
  eventId: string;
  paymentId: PaymentId;
  status: PaymentStatus;
  failureReason?: string;
}

export interface PaymentGatewayPort {
  createCheckoutSession(payment: Payment): Promise<string>;
  processWebhook(payload: string, signature: string): Promise<WebhookResult>;
}
