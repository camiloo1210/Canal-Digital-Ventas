import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidPaymentAttributeException } from '@/payments/domain/exceptions/invalid-payment-attribute.exception';

export type OrderId = Brand<string, 'OrderId'>;

export function createOrderId(id: string): OrderId {
  if (!id || id.trim().length === 0) {
    throw new InvalidPaymentAttributeException('Order ID cannot be empty');
  }
  return id as OrderId;
}
