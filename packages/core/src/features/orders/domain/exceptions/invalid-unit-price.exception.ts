import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidUnitPriceException extends DomainException {
  constructor(message: string = 'Unit price must be greater than 0') {
    super(message);
  }
}
