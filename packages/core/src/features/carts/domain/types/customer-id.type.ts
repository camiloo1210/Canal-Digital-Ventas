import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';

export type CustomerId = Brand<string, 'CustomerId'>;

export function createCustomerId(id: string): CustomerId {
  if (!id || id.trim().length === 0) {
    throw new InvalidCartAttributeException('Customer ID cannot be empty');
  }
  return id as CustomerId;
}
