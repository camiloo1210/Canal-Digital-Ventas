import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';

export type ProductId = Brand<string, 'ProductId'>;

export function createProductId(id: string): ProductId {
  if (!id || id.trim().length === 0) {
    throw new InvalidProductAttributeException('Product ID cannot be empty');
  }
  return id as ProductId;
}
