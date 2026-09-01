import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidCustomerAttributeException } from '@/customers/domain/exceptions/invalid-customer-attribute.exception';

export type CustomerId = Brand<string, 'CustomerId'>;

export function createCustomerId(id: string): CustomerId {
  if (!id || id.trim().length === 0) {
    throw new InvalidCustomerAttributeException('Customer ID cannot be empty');
  }
  return id as CustomerId;
}
