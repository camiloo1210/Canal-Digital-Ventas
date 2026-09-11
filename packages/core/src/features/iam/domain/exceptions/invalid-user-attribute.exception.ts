import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidUserAttributeException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserAttributeException';
  }
}
