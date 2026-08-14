import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidQuantityException extends DomainException {
  constructor(message: string = 'Quantity must be greater than 0') {
    super(message);
  }
}
