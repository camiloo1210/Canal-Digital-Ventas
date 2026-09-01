import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidPaymentAttributeException } from '@/payments/domain/exceptions/invalid-payment-attribute.exception';

export type CustomerId = Brand<string, 'CustomerId'>;

export function createCustomerId(id: string): CustomerId {
  if (!id || id.trim().length === 0) {
    throw new InvalidPaymentAttributeException('Customer ID cannot be empty');
  }
  return id as CustomerId;
}
