import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';

export type CartItemId = Brand<string, 'CartItemId'>;

export function createCartItemId(id: string): CartItemId {
  if (!id || id.trim().length === 0) {
    throw new InvalidCartAttributeException('Cart Item ID cannot be empty');
  }
  return id as CartItemId;
}
