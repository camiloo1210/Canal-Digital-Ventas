import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidPaymentAttributeException } from '@/payments/domain/exceptions/invalid-payment-attribute.exception';

export type PaymentId = Brand<string, 'PaymentId'>;

export function createPaymentId(id: string): PaymentId {
  if (!id || id.trim().length === 0) {
    throw new InvalidPaymentAttributeException('Payment ID cannot be empty');
  }
  return id as PaymentId;
}
