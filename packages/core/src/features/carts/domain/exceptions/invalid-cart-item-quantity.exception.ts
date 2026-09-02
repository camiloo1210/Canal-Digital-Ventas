import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidCartItemQuantityException extends DomainException {
  constructor(reason: string = 'Quantity must be greater than zero') {
    super(`Invalid cart item quantity: ${reason}`);
  }
}
