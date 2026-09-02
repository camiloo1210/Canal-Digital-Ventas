import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';

export type ProductId = Brand<string, 'ProductId'>;

export function createProductId(id: string): ProductId {
  if (!id || id.trim().length === 0) {
    throw new InvalidCartAttributeException('Product ID cannot be empty');
  }
  return id as ProductId;
}
