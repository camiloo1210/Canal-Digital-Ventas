import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';

export enum CartStatus {
  ACTIVE = 'active',
  ABANDONED = 'abandoned',
  COMPLETED = 'completed',
}

export function parseCartStatus(value: string): CartStatus {
  const isValid = Object.values(CartStatus).includes(value as CartStatus);
  if (!isValid) {
    throw new InvalidCartAttributeException(`'${value}' no es un estado de carrito válido.`);
  }
  return value as CartStatus;
}
