import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidStoreCustomerAttributeException } from '@/sales/domain/exceptions/invalid-store-customer-attribute.exception';

export type StoreCustomerId = Brand<string, 'StoreCustomerId'>;

export function createStoreCustomerId(id: string): StoreCustomerId {
  if (!id || id.trim().length === 0) {
    throw new InvalidStoreCustomerAttributeException('Store Customer ID cannot be empty');
  }
  return id as StoreCustomerId;
}
