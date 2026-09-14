import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidStoreCustomerAttributeException } from '@/sales/domain/exceptions/invalid-store-customer-attribute.exception';

export type GlobalAuthId = Brand<string, 'GlobalAuthId'>;

export function createGlobalAuthId(id: string): GlobalAuthId {
  if (!id || id.trim().length === 0) {
    throw new InvalidStoreCustomerAttributeException('Global Auth ID cannot be empty');
  }
  return id as GlobalAuthId;
}
