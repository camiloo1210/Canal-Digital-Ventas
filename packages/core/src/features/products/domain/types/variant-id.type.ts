import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';

export type VariantId = Brand<string, 'VariantId'>;

export function createVariantId(id: string): VariantId {
  if (!id || id.trim().length === 0) {
    throw new InvalidProductAttributeException('Variant ID is required.');
  }
  return id as VariantId;
}
