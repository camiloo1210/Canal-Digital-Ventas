import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';

export type OrderId = Brand<string, 'OrderId'>;

export function createOrderId(id: string): OrderId {
  if (!id || id.trim().length === 0) {
    throw new InvalidOrderAttributeException('Order ID cannot be empty');
  }
  return id as OrderId;
}
