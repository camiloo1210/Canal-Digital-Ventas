import { Brand } from '@/shared/domain/types/brand.type';

export type OrderItemId = Brand<string, 'OrderItemId'>;

export function createOrderItemId(id: string): OrderItemId {
  return id as OrderItemId;
}
