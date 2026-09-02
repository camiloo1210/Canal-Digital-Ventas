import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidProductAttributeException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProductAttributeException';
  }
}
