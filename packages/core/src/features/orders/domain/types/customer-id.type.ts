import { Brand } from '@/shared/domain/types/brand.type';

export type CustomerId = Brand<string, 'CustomerId'>;

export function createCustomerId(id: string): CustomerId {
  return id as CustomerId;
}
