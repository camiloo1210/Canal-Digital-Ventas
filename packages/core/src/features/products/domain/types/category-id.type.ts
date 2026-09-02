import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';

export type CategoryId = Brand<string, 'CategoryId'>;

export function createCategoryId(id: string): CategoryId {
  if (!id || id.trim().length === 0) {
    throw new InvalidProductAttributeException('Category ID cannot be empty');
  }
  return id as CategoryId;
}
