import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';

export type VariantId = Brand<string, 'VariantId'>;

export function createVariantId(id: string): VariantId {
  if (!id || id.trim().length === 0) {
    throw new InvalidCartAttributeException('Variant ID cannot be empty');
  }
  return id as VariantId;
}
