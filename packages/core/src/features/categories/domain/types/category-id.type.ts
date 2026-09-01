import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidCategoryAttributeException } from '@/categories/domain/exceptions/invalid-category-attribute.exception';

export type CategoryId = Brand<string, 'CategoryId'>;

export function createCategoryId(id: string): CategoryId {
  if (!id || id.trim().length === 0) {
    throw new InvalidCategoryAttributeException('Category ID cannot be empty');
  }
  return id as CategoryId;
}
