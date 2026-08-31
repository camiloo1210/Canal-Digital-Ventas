import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';

export type CartId = Brand<string, 'CartId'>;

export function createCartId(id: string): CartId {
  if (!id || id.trim().length === 0) {
    throw new InvalidCartAttributeException('Cart ID cannot be empty');
  }
  return id as CartId;
}
